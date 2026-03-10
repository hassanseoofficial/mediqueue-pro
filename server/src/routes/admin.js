const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const { query, transaction } = require('../db');
const { authenticate, requireRole, clinicScope } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const {
    emitQueueUpdate,
    emitTokenCalled,
    emitTokenStatus,
    emitThresholdUpdate,
    emitEmergency,
    emitQueuePaused,
    emitPenalty,
} = require('../sockets/queueSocket');
const redis = require('../services/redis');
const { addPenaltyJob, cancelPenaltyJob } = require('../jobs/penaltyJob');
const smsService = require('../services/sms');
const { activeQueue } = require('./queue');

const router = express.Router();

// All admin routes require authentication
router.use(authenticate, clinicScope);

// ─── Helpers ──────────────────────────────────────────────────────

const logEvent = async (client, { clinicId, tokenId, userId, eventType, oldPos, newPos, oldStatus, newStatus, reason, ip }) => {
    await client.query(
        `INSERT INTO queue_events (clinic_id, token_id, user_id, event_type, old_position, new_position, old_status, new_status, reason, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [clinicId, tokenId, userId, eventType, oldPos || null, newPos || null, oldStatus || null, newStatus || null, reason || null, ip || null]
    );
};

const broadcastQueue = async (clinicId, doctorId) => {
    const queue = await activeQueue(clinicId, doctorId);
    emitQueueUpdate(clinicId, doctorId, queue);
    return queue;
};

// ─── GET /api/admin/queue/:doctor_id ─────────────────────────────
router.get('/queue/:doctor_id', requireRole('admin', 'staff', 'superadmin', 'doctor'), async (req, res) => {
    try {
        const queue = await activeQueue(req.clinicId, req.params.doctor_id);
        res.json(queue);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/queue/call-next ─────────────────────────────
router.post('/queue/call-next', authLimiter, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { doctor_id } = req.body;

        // Find next waiting token
        const nextResult = await query(
            `SELECT * FROM tokens 
       WHERE clinic_id = $1 AND doctor_id = $2 AND status = 'waiting'
         AND joined_at::DATE = CURRENT_DATE
       ORDER BY is_emergency DESC, position ASC LIMIT 1`,
            [req.clinicId, doctor_id]
        );

        if (!nextResult.rows.length) {
            return res.status(404).json({ error: 'No waiting tokens in queue' });
        }

        const token = nextResult.rows[0];

        await transaction(async (client) => {
            // Update token status
            await client.query(
                `UPDATE tokens SET status = 'called', called_at = NOW() WHERE id = $1`,
                [token.id]
            );
            await logEvent(client, {
                clinicId: req.clinicId,
                tokenId: token.id,
                userId: req.user.id,
                eventType: 'call_next',
                oldStatus: 'waiting',
                newStatus: 'called',
                ip: req.ip,
            });
        });

        // Fetch threshold settings for penalty scheduling
        const thresholdResult = await query(
            'SELECT grace_period_minutes, penalty_enabled FROM doctor_thresholds WHERE doctor_id = $1',
            [doctor_id]
        );
        const threshold = thresholdResult.rows[0];

        // Schedule penalty job if enabled
        if (threshold && threshold.penalty_enabled) {
            await addPenaltyJob(token.id, req.clinicId, doctor_id, threshold.grace_period_minutes);
        }

        // Emit events
        emitTokenCalled(req.clinicId, doctor_id, token);
        await broadcastQueue(req.clinicId, doctor_id);

        res.json({ success: true, token });
    } catch (err) {
        console.error('Call next error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/admin/token/:id/present ──────────────────────────
router.patch('/token/:id/present', authLimiter, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE tokens SET status = 'present', present_at = NOW()
       WHERE id = $1 AND clinic_id = $2 AND status IN ('called','penalized')
       RETURNING *`,
            [id, req.clinicId]
        );

        if (!result.rows.length) return res.status(404).json({ error: 'Token not found or not in called state' });

        const token = result.rows[0];

        // Cancel penalty job
        await cancelPenaltyJob(id);

        // Log event
        await query(
            `INSERT INTO queue_events (clinic_id, token_id, user_id, event_type, old_status, new_status, ip_address)
       VALUES ($1, $2, $3, 'mark_present', 'called', 'present', $4)`,
            [req.clinicId, id, req.user.id, req.ip]
        );

        emitTokenStatus(id, { status: 'present' });
        await broadcastQueue(req.clinicId, token.doctor_id);
        res.json({ success: true, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/admin/token/:id/complete ─────────────────────────
router.patch('/token/:id/complete', authLimiter, requireRole('admin', 'staff', 'doctor'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE tokens SET status = 'completed', completed_at = NOW()
       WHERE id = $1 AND clinic_id = $2 AND status NOT IN ('completed','no_show')
       RETURNING *`,
            [id, req.clinicId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Token not found' });

        const token = result.rows[0];

        // Update session stats
        await query(
            `INSERT INTO doctor_session_stats (doctor_id, clinic_id, session_date, total_seen, total_sub_patients)
       VALUES ($1, $2, CURRENT_DATE, 1, $3)
       ON CONFLICT (doctor_id, session_date)
       DO UPDATE SET
         total_seen = doctor_session_stats.total_seen + 1,
         total_sub_patients = doctor_session_stats.total_sub_patients + EXCLUDED.total_sub_patients`,
            [token.doctor_id, req.clinicId, token.total_sub_patients]
        );

        await query(
            `INSERT INTO queue_events (clinic_id, token_id, user_id, event_type, old_status, new_status, ip_address)
       VALUES ($1, $2, $3, 'complete', $4, 'completed', $5)`,
            [req.clinicId, id, req.user.id, token.status, req.ip]
        );

        emitTokenStatus(id, { status: 'completed' });
        await broadcastQueue(req.clinicId, token.doctor_id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/admin/token/:id/hold ─────────────────────────────
router.patch('/token/:id/hold', authLimiter, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `UPDATE tokens SET status = 'on_hold'
       WHERE id = $1 AND clinic_id = $2 RETURNING *`,
            [id, req.clinicId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Token not found' });
        const token = result.rows[0];
        emitTokenStatus(id, { status: 'on_hold' });
        await broadcastQueue(req.clinicId, token.doctor_id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/admin/token/:id/recall ───────────────────────────
// Re-call a patient who is currently on_hold or penalized
router.patch('/token/:id/recall', authLimiter, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(
            `UPDATE tokens SET status = 'called', called_at = NOW()
       WHERE id = $1 AND clinic_id = $2 AND status IN ('on_hold','penalized')
       RETURNING *`,
            [id, req.clinicId]
        );

        if (!result.rows.length) return res.status(404).json({ error: 'Token not found or not in on_hold/penalized state' });

        const token = result.rows[0];

        await query(
            `INSERT INTO queue_events (clinic_id, token_id, user_id, event_type, old_status, new_status, ip_address)
       VALUES ($1, $2, $3, 'recall', 'on_hold', 'called', $4)`,
            [req.clinicId, id, req.user.id, req.ip]
        );

        // Re-schedule penalty grace timer
        const thresholdResult = await query(
            'SELECT grace_period_minutes, penalty_enabled FROM doctor_thresholds WHERE doctor_id = $1',
            [token.doctor_id]
        );
        const threshold = thresholdResult.rows[0];
        if (threshold && threshold.penalty_enabled) {
            await addPenaltyJob(token.id, req.clinicId, token.doctor_id, threshold.grace_period_minutes);
        }

        emitTokenCalled(req.clinicId, token.doctor_id, token);
        await broadcastQueue(req.clinicId, token.doctor_id);
        res.json({ success: true, token });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/token/:id/penalty (manual) ──────────────────
router.post('/token/:id/penalty', authLimiter, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { id } = req.params;

        const tokenResult = await query(
            'SELECT * FROM tokens WHERE id = $1 AND clinic_id = $2',
            [id, req.clinicId]
        );
        if (!tokenResult.rows.length) return res.status(404).json({ error: 'Token not found' });

        const token = tokenResult.rows[0];
        const thresholdResult = await query(
            'SELECT * FROM doctor_thresholds WHERE doctor_id = $1',
            [token.doctor_id]
        );
        const cfg = thresholdResult.rows[0];
        const positionsBack = cfg?.positions_back || 2;
        const maxPenalties = cfg?.max_penalties_before_noshow || 3;

        if (token.penalty_count + 1 >= maxPenalties) {
            // Auto no-show on third penalty
            await query(
                `UPDATE tokens SET status = 'no_show', penalty_count = penalty_count + 1 WHERE id = $1`,
                [id]
            );
            emitTokenStatus(id, { status: 'no_show' });
            if (token.phone) smsService.sendNoShow(token.phone, token.token_number).catch(() => { });
        } else {
            const newPos = Math.min(token.position + positionsBack, 9999);
            await query(
                `UPDATE tokens SET status = 'penalized', penalty_count = penalty_count + 1, position = $1 WHERE id = $2`,
                [newPos, id]
            );
            emitPenalty(id, { new_position: newPos, penalty_count: token.penalty_count + 1 });
            emitTokenStatus(id, { status: 'penalized', position: newPos });
            if (token.phone) smsService.sendPenalty(token.phone, token.token_number, newPos).catch(() => { });
        }

        await broadcastQueue(req.clinicId, token.doctor_id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/token/:id/noshow ────────────────────────────
router.post('/token/:id/noshow', authLimiter, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `UPDATE tokens SET status = 'no_show' WHERE id = $1 AND clinic_id = $2 RETURNING *`,
            [id, req.clinicId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Token not found' });
        const token = result.rows[0];

        await cancelPenaltyJob(id);
        await query(
            `INSERT INTO doctor_session_stats (doctor_id, clinic_id, session_date, no_show_count)
       VALUES ($1, $2, CURRENT_DATE, 1) ON CONFLICT (doctor_id, session_date)
       DO UPDATE SET no_show_count = doctor_session_stats.no_show_count + 1`,
            [token.doctor_id, req.clinicId]
        );

        emitTokenStatus(id, { status: 'no_show' });
        await broadcastQueue(req.clinicId, token.doctor_id);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/token/emergency ─────────────────────────────
const emergencySchema = z.object({
    doctor_id: z.number().int().positive(),
    patient_name: z.string().min(2),
    phone: z.string().optional(),
    reason: z.string().min(3),
});

router.post('/token/emergency', authLimiter, requireRole('admin', 'staff'), async (req, res) => {
    try {
        const { doctor_id, patient_name, phone, reason } = emergencySchema.parse(req.body);

        const emergencyToken = await transaction(async (client) => {
            // Shift all active tokens back by 1
            await client.query(
                `UPDATE tokens SET position = position + 1
         WHERE clinic_id = $1 AND doctor_id = $2
           AND status NOT IN ('completed','no_show','called','present','in_consultation')
           AND joined_at::DATE = CURRENT_DATE`,
                [req.clinicId, doctor_id]
            );

            const tokenResult = await client.query(
                `INSERT INTO tokens (clinic_id, doctor_id, token_number, patient_name, phone, type, status, position, is_emergency, total_sub_patients)
         VALUES ($1, $2, 'EMG', $3, $4, 'walkin', 'called', 0, TRUE, 1)
         RETURNING *`,
                [req.clinicId, doctor_id, patient_name, phone || null]
            );

            const token = tokenResult.rows[0];

            await logEvent(client, {
                clinicId: req.clinicId,
                tokenId: token.id,
                userId: req.user.id,
                eventType: 'emergency_insert',
                reason,
                ip: req.ip,
            });

            await client.query(
                `INSERT INTO doctor_session_stats (doctor_id, clinic_id, session_date, emergency_count)
         VALUES ($1, $2, CURRENT_DATE, 1) ON CONFLICT (doctor_id, session_date)
         DO UPDATE SET emergency_count = doctor_session_stats.emergency_count + 1`,
                [doctor_id, req.clinicId]
            );

            return token;
        });

        emitEmergency(req.clinicId, doctor_id, { ...emergencyToken, reason });
        await broadcastQueue(req.clinicId, doctor_id);

        res.status(201).json({ success: true, token: emergencyToken });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/admin/sub-patient/:id/status ─────────────────────
router.patch('/sub-patient/:id/status', authLimiter, requireRole('admin', 'staff', 'doctor'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = z.object({ status: z.enum(['waiting', 'in_consultation', 'done']) }).parse(req.body);

        const now = new Date();
        let updateSQL = 'UPDATE sub_patients SET status = $1 WHERE id = $2 AND clinic_id = $3 RETURNING *';
        let params = [status, id, req.clinicId];

        if (status === 'in_consultation') {
            updateSQL = 'UPDATE sub_patients SET status = $1, consultation_start_at = $4 WHERE id = $2 AND clinic_id = $3 RETURNING *';
            params = [status, id, req.clinicId, now];
        } else if (status === 'done') {
            updateSQL = 'UPDATE sub_patients SET status = $1, consultation_end_at = $4 WHERE id = $2 AND clinic_id = $3 RETURNING *';
            params = [status, id, req.clinicId, now];
        }

        const result = await query(updateSQL, params);
        if (!result.rows.length) return res.status(404).json({ error: 'Sub-patient not found' });

        res.json({ success: true, sub_patient: result.rows[0] });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/queue/pause ─────────────────────────────────
router.post('/queue/pause', authLimiter, requireRole('admin'), async (req, res) => {
    try {
        const { doctor_id, paused } = req.body;
        await redis.set(`clinic:${req.clinicId}:doctor:${doctor_id}:paused`, paused ? '1' : '0');
        emitQueuePaused(req.clinicId, doctor_id, paused);
        res.json({ success: true, paused });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/admin/audit-log ────────────────────────────────────
router.get('/audit-log', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { doctor_id, limit = 50, offset = 0 } = req.query;
        let queryStr = `
      SELECT qe.*, t.token_number, u.name as user_name
      FROM queue_events qe
      LEFT JOIN tokens t ON t.id = qe.token_id
      LEFT JOIN users u ON u.id = qe.user_id
      WHERE qe.clinic_id = $1
    `;
        const params = [req.clinicId];
        if (doctor_id) {
            queryStr += ` AND t.doctor_id = $${params.length + 1}`;
            params.push(doctor_id);
        }
        queryStr += ` ORDER BY qe.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryStr, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════════════════════
// DOCTOR MANAGEMENT (admin + superadmin)
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/admin/doctors ───────────────────────────────────
router.get('/doctors', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const result = await query(
            `SELECT d.*, 
               dt.session_start, dt.session_end, dt.max_patients, dt.buffer_slots,
               dt.grace_period_minutes, dt.penalty_enabled,
               u.email, u.id as user_id, u.is_active as user_active
             FROM doctors d
             LEFT JOIN doctor_thresholds dt ON dt.doctor_id = d.id
             LEFT JOIN users u ON u.doctor_id = d.id AND u.role = 'doctor'
             WHERE d.clinic_id = $1
             ORDER BY d.id`,
            [req.clinicId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/doctors ──────────────────────────────────
const createDoctorSchema = z.object({
    name: z.string().min(2).max(200),
    specialization: z.string().max(100).optional().default('General Physician'),
    avg_consultation_min: z.number().int().min(1).max(120).optional().default(8),
    email: z.string().email(),
    password: z.string().min(6),
    session_start: z.string().regex(/^\d{2}:\d{2}$/).optional().default('09:00'),
    session_end: z.string().regex(/^\d{2}:\d{2}$/).optional().default('14:00'),
    max_patients: z.number().int().min(1).optional().default(30),
    buffer_slots: z.number().int().min(0).optional().default(2),
});

router.post('/doctors', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const data = createDoctorSchema.parse(req.body);
        const passwordHash = await bcrypt.hash(data.password, 10);

        const result = await transaction(async (client) => {
            // 1. Create doctor
            const docResult = await client.query(
                `INSERT INTO doctors (clinic_id, name, specialization, avg_consultation_min)
         VALUES ($1, $2, $3, $4) RETURNING *`,
                [req.clinicId, data.name, data.specialization, data.avg_consultation_min]
            );
            const doctor = docResult.rows[0];

            // 2. Create user login
            await client.query(
                `INSERT INTO users (clinic_id, name, email, password_hash, role, doctor_id)
         VALUES ($1, $2, $3, $4, 'doctor', $5)`,
                [req.clinicId, data.name, data.email.toLowerCase(), passwordHash, doctor.id]
            );

            // 3. Create default threshold
            await client.query(
                `INSERT INTO doctor_thresholds (doctor_id, clinic_id, session_start, session_end, max_patients, buffer_slots)
         VALUES ($1, $2, $3, $4, $5, $6)`,
                [doctor.id, req.clinicId, data.session_start, data.session_end, data.max_patients, data.buffer_slots]
            );

            return doctor;
        });

        res.status(201).json({ success: true, doctor: result });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
        if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/admin/doctors/:id ────────────────────────────
const updateDoctorSchema = z.object({
    name: z.string().min(2).max(200).optional(),
    specialization: z.string().max(100).optional(),
    avg_consultation_min: z.number().int().min(1).max(120).optional(),
    is_active: z.boolean().optional(),
});

router.patch('/doctors/:id', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateDoctorSchema.parse(req.body);
        const fields = Object.entries(data);
        if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

        const setClause = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ');
        const values = [id, req.clinicId, ...fields.map(([, v]) => v)];

        const result = await query(
            `UPDATE doctors SET ${setClause} WHERE id = $1 AND clinic_id = $2 RETURNING *`,
            values
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Doctor not found' });

        // Sync doctor name to user record
        if (data.name) {
            await query('UPDATE users SET name = $1 WHERE doctor_id = $2 AND clinic_id = $3', [data.name, id, req.clinicId]);
        }

        res.json({ success: true, doctor: result.rows[0] });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/admin/doctors/:id/password ───────────────────
router.patch('/doctors/:id/password', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { password } = z.object({ password: z.string().min(6) }).parse(req.body);
        const hash = await bcrypt.hash(password, 10);

        const result = await query(
            `UPDATE users SET password_hash = $1
       WHERE doctor_id = $2 AND clinic_id = $3 AND role = 'doctor'
       RETURNING id`,
            [hash, id, req.clinicId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Doctor user account not found' });
        res.json({ success: true });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/admin/doctors/:id/threshold ──────────────────
const thresholdSchema = z.object({
    session_start: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    session_end: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    max_patients: z.number().int().min(1).optional(),
    buffer_slots: z.number().int().min(0).optional(),
    grace_period_minutes: z.number().int().min(0).optional(),
    positions_back: z.number().int().min(1).optional(),
    max_penalties_before_noshow: z.number().int().min(1).optional(),
    penalty_enabled: z.boolean().optional(),
    avg_consultation_min: z.number().int().min(1).max(120).optional(),
});

router.patch('/doctors/:id/threshold', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const data = thresholdSchema.parse(req.body);
        const fields = Object.entries(data);
        if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

        const setClause = fields.map(([k], i) => `${k} = $${i + 3}`).join(', ');
        const values = [id, req.clinicId, ...fields.map(([, v]) => v)];

        const result = await query(
            `UPDATE doctor_thresholds SET ${setClause}, updated_at = NOW()
       WHERE doctor_id = $1 AND clinic_id = $2 RETURNING *`,
            values
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Threshold not found for doctor' });
        res.json({ success: true, threshold: result.rows[0] });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DELETE /api/admin/doctors/:id ───────────────────────────
router.delete('/doctors/:id', requireRole('admin', 'superadmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query(
            `UPDATE doctors SET is_active = FALSE WHERE id = $1 AND clinic_id = $2 RETURNING id`,
            [id, req.clinicId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Doctor not found' });
        // Also deactivate their user account
        await query('UPDATE users SET is_active = FALSE WHERE doctor_id = $1 AND clinic_id = $2', [id, req.clinicId]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════════════════════
// SUPERADMIN — Clinic Provisioning
// ═══════════════════════════════════════════════════════════════

// ─── GET /api/admin/clinics ───────────────────────────────────
router.get('/clinics', requireRole('superadmin'), async (req, res) => {
    try {
        const result = await query(
            `SELECT c.*, 
               COUNT(DISTINCT d.id) FILTER (WHERE d.is_active) AS doctor_count,
               COUNT(DISTINCT u.id) AS user_count
             FROM clinics c
             LEFT JOIN doctors d ON d.clinic_id = c.id
             LEFT JOIN users u ON u.clinic_id = c.id
             GROUP BY c.id ORDER BY c.id`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── POST /api/admin/clinics ──────────────────────────────────
const createClinicSchema = z.object({
    name: z.string().min(2).max(200),
    slug: z.string().min(2).max(100).regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, hyphens'),
    address: z.string().optional(),
    phone: z.string().optional(),
    admin_name: z.string().min(2),
    admin_email: z.string().email(),
    admin_password: z.string().min(6),
});

router.post('/clinics', requireRole('superadmin'), async (req, res) => {
    try {
        const data = createClinicSchema.parse(req.body);
        const passwordHash = await bcrypt.hash(data.admin_password, 10);

        const result = await transaction(async (client) => {
            const clinicResult = await client.query(
                `INSERT INTO clinics (name, slug, address, phone) VALUES ($1, $2, $3, $4) RETURNING *`,
                [data.name, data.slug, data.address || null, data.phone || null]
            );
            const clinic = clinicResult.rows[0];

            await client.query(
                `INSERT INTO users (clinic_id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, 'admin')`,
                [clinic.id, data.admin_name, data.admin_email.toLowerCase(), passwordHash]
            );

            return clinic;
        });

        res.status(201).json({ success: true, clinic: result });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
        if (err.code === '23505') return res.status(409).json({ error: 'Slug or email already in use' });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/admin/clinics/:id ────────────────────────────
router.patch('/clinics/:id', requireRole('superadmin'), async (req, res) => {
    try {
        const { id } = req.params;
        const data = z.object({
            name: z.string().min(2).max(200).optional(),
            address: z.string().optional(),
            phone: z.string().optional(),
            is_active: z.boolean().optional(),
        }).parse(req.body);
        const fields = Object.entries(data);
        if (!fields.length) return res.status(400).json({ error: 'No fields to update' });

        const setClause = fields.map(([k], i) => `${k} = $${i + 2}`).join(', ');
        const values = [id, ...fields.map(([, v]) => v)];

        const result = await query(`UPDATE clinics SET ${setClause} WHERE id = $1 RETURNING *`, values);
        if (!result.rows.length) return res.status(404).json({ error: 'Clinic not found' });
        res.json({ success: true, clinic: result.rows[0] });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
