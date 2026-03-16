const express = require('express');
const { z } = require('zod');
const { query, transaction } = require('../db');
const { optionalAuth } = require('../middleware/auth');
const { publicLimiter } = require('../middleware/rateLimit');
const {
    emitQueueUpdate,
    emitTokenStatus,
    emitThresholdUpdate,
} = require('../sockets/queueSocket');
const redis = require('../services/redis');
const smsService = require('../services/sms');

const router = express.Router();

// ─── GET /api/queue/clinic/:slug ─────────────────────────────────
// Lookup clinic by slug and return clinic info with doctors
router.get('/clinic/:slug', publicLimiter, async (req, res) => {
    try {
        const { slug } = req.params;

        // Get clinic by slug
        const clinicResult = await query(
            'SELECT id, name, slug, address, phone FROM clinics WHERE slug = $1',
            [slug]
        );

        if (!clinicResult.rows.length) {
            return res.status(404).json({ error: 'Clinic not found', slug });
        }

        const clinic = clinicResult.rows[0];

        // Get active doctors for this clinic
        const doctorsResult = await query(
            `SELECT d.id, d.name, d.specialization,
                    dt.session_start, dt.session_end, dt.max_patients, dt.buffer_slots
             FROM doctors d
             LEFT JOIN doctor_thresholds dt ON dt.doctor_id = d.id
             WHERE d.clinic_id = $1 AND d.is_active = TRUE
             ORDER BY d.name`,
            [clinic.id]
        );

        // Get current threshold usage for each doctor
        const doctors = await Promise.all(doctorsResult.rows.map(async (doc) => {
            const redisKey = `clinic:${clinic.id}:doctor:${doc.id}:threshold_count`;
            const used = parseInt(await redis.get(redisKey)) || 0;
            const maxAllowed = doc.max_patients ? doc.max_patients - (doc.buffer_slots || 0) : null;

            return {
                ...doc,
                slots_used: used,
                slots_remaining: maxAllowed ? Math.max(0, maxAllowed - used) : null,
                is_full: maxAllowed ? used >= maxAllowed : false,
            };
        }));

        res.json({
            clinic: {
                id: clinic.id,
                name: clinic.name,
                slug: clinic.slug,
                address: clinic.address,
                phone: clinic.phone,
            },
            doctors,
        });
    } catch (err) {
        console.error('Clinic lookup error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/queue/clinic/:slug/urls ────────────────────────────
// Get all dynamic URLs for a clinic (for admin display)
router.get('/clinic/:slug/urls', publicLimiter, async (req, res) => {
    try {
        const { slug } = req.params;

        const clinicResult = await query(
            'SELECT id, name, slug FROM clinics WHERE slug = $1',
            [slug]
        );

        if (!clinicResult.rows.length) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        const clinic = clinicResult.rows[0];

        const doctorsResult = await query(
            'SELECT id, name FROM doctors WHERE clinic_id = $1 AND is_active = TRUE ORDER BY name',
            [clinic.id]
        );

        const baseUrl = process.env.CLIENT_URL || '';

        const urls = {
            clinic: clinic.name,
            slug: clinic.slug,
            patient_queue: `${baseUrl}/queue/${clinic.slug}`,
            doctors: doctorsResult.rows.map(doc => ({
                doctor_id: doc.id,
                doctor_name: doc.name,
                display_board: `${baseUrl}/display/${clinic.id}/${doc.id}`,
                display_board_by_slug: `${baseUrl}/display/${clinic.slug}/${doc.id}`,
            })),
        };

        res.json(urls);
    } catch (err) {
        console.error('URLs lookup error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── Helpers ─────────────────────────────────────────────────────

const activeQueue = async (clinicId, doctorId) => {
    const result = await query(
        `SELECT t.*, 
       json_agg(sp ORDER BY sp.id) FILTER (WHERE sp.id IS NOT NULL) AS sub_patients
     FROM tokens t
     LEFT JOIN sub_patients sp ON sp.token_id = t.id
     WHERE t.clinic_id = $1 AND t.doctor_id = $2
       AND t.status NOT IN ('completed','no_show')
       AND t.joined_at::DATE = CURRENT_DATE
     GROUP BY t.id
     ORDER BY t.position ASC`,
        [clinicId, doctorId]
    );
    return result.rows;
};

const generateTokenNumber = async (clinicId, doctorId) => {
    const result = await query(
        `SELECT COUNT(*) as total FROM tokens
     WHERE clinic_id = $1 AND doctor_id = $2 AND joined_at::DATE = CURRENT_DATE`,
        [clinicId, doctorId]
    );
    const num = parseInt(result.rows[0].total) + 1;
    return `B-${String(num).padStart(3, '0')}`;
};

const getThresholdSettings = async (doctorId) => {
    const result = await query(
        'SELECT * FROM doctor_thresholds WHERE doctor_id = $1',
        [doctorId]
    );
    return result.rows[0] || null;
};

// ─── POST /api/queue/join ─────────────────────────────────────────
const joinSchema = z.object({
    clinic_id: z.number().int().positive(),
    doctor_id: z.number().int().positive(),
    patient_name: z.string().min(2).max(200),
    phone: z.string().optional(),
    type: z.enum(['walkin', 'online']).default('walkin'),
    sub_patients: z.array(z.object({
        name: z.string().min(1),
        relationship: z.string().optional(),
        age: z.number().int().optional(),
    })).max(4).optional().default([]),
});

router.post('/join', publicLimiter, async (req, res) => {
    try {
        const data = joinSchema.parse(req.body);
        const { clinic_id, doctor_id, patient_name, phone, type, sub_patients } = data;

        // Validate clinic + doctor exist
        const doctorCheck = await query(
            'SELECT d.id FROM doctors d WHERE d.id = $1 AND d.clinic_id = $2 AND d.is_active = TRUE',
            [doctor_id, clinic_id]
        );
        if (!doctorCheck.rows.length) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Get threshold settings
        const threshold = await getThresholdSettings(doctor_id);
        if (!threshold) {
            return res.status(400).json({ error: 'Doctor threshold not configured' });
        }

        // Check session time window
        const now = new Date();
        const nowTime = now.toTimeString().slice(0, 5); // HH:MM
        if (nowTime < threshold.session_start || nowTime > threshold.session_end) {
            return res.status(423).json({
                error: 'Session closed',
                session_start: threshold.session_start,
                session_end: threshold.session_end,
                message: `Ticket generation is closed. Session hours: ${threshold.session_start} – ${threshold.session_end}`
            });
        }

        // Total patients this ticket will use (1 primary + companions)
        const totalSlots = 1 + sub_patients.length;

        // Atomic Redis threshold check
        const redisKey = `clinic:${clinic_id}:doctor:${doctor_id}:threshold_count`;
        const currentCount = await redis.incrby(redisKey, totalSlots);
        const maxAllowed = threshold.max_patients - threshold.buffer_slots;

        if (currentCount > maxAllowed) {
            // Rollback
            await redis.decrby(redisKey, totalSlots);
            return res.status(429).json({
                error: 'Slots full',
                message: 'No more slots available for today. Please try tomorrow.',
                used: currentCount - totalSlots,
                max: maxAllowed,
            });
        }

        // Insert token + sub-patients in a transaction
        const result = await transaction(async (client) => {
            const posResult = await client.query(
                `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
         FROM tokens WHERE clinic_id = $1 AND doctor_id = $2 AND joined_at::DATE = CURRENT_DATE
         AND status NOT IN ('completed','no_show')`,
                [clinic_id, doctor_id]
            );
            const position = posResult.rows[0].next_pos;
            const token_number = await generateTokenNumber(clinic_id, doctor_id);

            const tokenResult = await client.query(
                `INSERT INTO tokens (clinic_id, doctor_id, token_number, patient_name, phone, type, position, total_sub_patients)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
                [clinic_id, doctor_id, token_number, patient_name, phone || null, type, position, totalSlots]
            );
            const token = tokenResult.rows[0];

            // Insert sub-patients
            for (const sp of sub_patients) {
                await client.query(
                    `INSERT INTO sub_patients (token_id, clinic_id, name, relationship, age)
           VALUES ($1, $2, $3, $4, $5)`,
                    [token.id, clinic_id, sp.name, sp.relationship || null, sp.age || null]
                );
            }

            return token;
        });

        // Broadcast queue update
        const queue = await activeQueue(clinic_id, doctor_id);
        emitQueueUpdate(clinic_id, doctor_id, queue);

        // Threshold update broadcast
        const used = parseInt(await redis.get(redisKey)) || 0;
        emitThresholdUpdate(clinic_id, doctor_id, {
            used,
            max: threshold.max_patients,
            remaining: Math.max(0, maxAllowed - used),
        });

        // Send SMS confirmation (non-blocking)
        if (phone) {
            smsService.sendTokenConfirmation(phone, result.token_number, result.id).catch(() => { });
        }

        res.status(201).json({
            token_id: result.id,
            token_number: result.token_number,
            position: result.position,
            total_sub_patients: result.total_sub_patients,
            status: 'waiting',
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        console.error('Queue join error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/queue/status/:token_id ─────────────────────────────
router.get('/status/:token_id', publicLimiter, async (req, res) => {
    try {
        const { token_id } = req.params;

        const result = await query(
            `SELECT t.*, 
         json_agg(sp ORDER BY sp.id) FILTER (WHERE sp.id IS NOT NULL) AS sub_patients
       FROM tokens t
       LEFT JOIN sub_patients sp ON sp.token_id = t.id
       WHERE t.id = $1
       GROUP BY t.id`,
            [token_id]
        );

        if (!result.rows.length) return res.status(404).json({ error: 'Token not found' });

        const token = result.rows[0];

        // Count people ahead
        const aheadResult = await query(
            `SELECT COUNT(*) as ahead FROM tokens
       WHERE clinic_id = $1 AND doctor_id = $2
         AND position < $3 AND status NOT IN ('completed','no_show','called','present','in_consultation')
         AND joined_at::DATE = CURRENT_DATE`,
            [token.clinic_id, token.doctor_id, token.position]
        );
        const ahead = parseInt(aheadResult.rows[0].ahead);

        // Threshold info
        const threshold = await getThresholdSettings(token.doctor_id);
        const redisKey = `clinic:${token.clinic_id}:doctor:${token.doctor_id}:threshold_count`;
        const used = parseInt(await redis.get(redisKey)) || 0;
        const slotsRemaining = threshold ? Math.max(0, threshold.max_patients - threshold.buffer_slots - used) : null;

        const estWaitMin = threshold && ahead > 0
            ? ahead * threshold.avg_consultation_min
            : null;

        res.json({
            token_id: token.id,
            token_number: token.token_number,
            patient_name: token.patient_name,
            status: token.status,
            position: token.position,
            ahead,
            est_wait_min: estWaitMin,
            is_emergency: token.is_emergency,
            total_sub_patients: token.total_sub_patients,
            sub_patients: token.sub_patients || [],
            slots_remaining: slotsRemaining,
            joined_at: token.joined_at,
            called_at: token.called_at,
        });
    } catch (err) {
        console.error('Status error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/queue/display/:clinic_id/:doctor_id ────────────────
router.get('/display/:clinic_id/:doctor_id', publicLimiter, async (req, res) => {
    try {
        const { clinic_id, doctor_id } = req.params;

        // Current (called/present/in_consultation)
        const currentResult = await query(
            `SELECT t.*, 
         json_agg(sp ORDER BY sp.id) FILTER (WHERE sp.id IS NOT NULL) AS sub_patients
       FROM tokens t
       LEFT JOIN sub_patients sp ON sp.token_id = t.id
       WHERE t.clinic_id = $1 AND t.doctor_id = $2
         AND t.status IN ('called','present','in_consultation')
         AND t.joined_at::DATE = CURRENT_DATE
       GROUP BY t.id ORDER BY t.position ASC LIMIT 1`,
            [clinic_id, doctor_id]
        );

        // Last 3 completed
        const last3Result = await query(
            `SELECT token_number, patient_name, total_sub_patients FROM tokens
       WHERE clinic_id = $1 AND doctor_id = $2 AND status = 'completed'
         AND joined_at::DATE = CURRENT_DATE
       ORDER BY completed_at DESC LIMIT 3`,
            [clinic_id, doctor_id]
        );

        // Threshold
        const threshold = await getThresholdSettings(doctor_id);
        const redisKey = `clinic:${clinic_id}:doctor:${doctor_id}:threshold_count`;
        const used = parseInt(await redis.get(redisKey)) || 0;
        const remaining = threshold ? Math.max(0, threshold.max_patients - threshold.buffer_slots - used) : null;

        res.json({
            current: currentResult.rows[0] || null,
            last_3: last3Result.rows,
            threshold_remaining: remaining,
        });
    } catch (err) {
        console.error('Display error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/queue/threshold/:doctor_id ─────────────────────────
router.get('/threshold/:doctor_id', publicLimiter, optionalAuth, async (req, res) => {
    try {
        const { doctor_id } = req.params;
        const threshold = await getThresholdSettings(doctor_id);
        if (!threshold) return res.status(404).json({ error: 'Threshold not configured' });

        const redisKey = `clinic:${threshold.clinic_id}:doctor:${doctor_id}:threshold_count`;
        const used = parseInt(await redis.get(redisKey)) || 0;
        const maxAllowed = threshold.max_patients - threshold.buffer_slots;

        const now = new Date();
        const nowTime = now.toTimeString().slice(0, 5);
        const isOpen = nowTime >= threshold.session_start && nowTime <= threshold.session_end;

        res.json({
            is_open: isOpen,
            session_start: threshold.session_start,
            session_end: threshold.session_end,
            max_patients: threshold.max_patients,
            used,
            remaining: Math.max(0, maxAllowed - used),
            is_full: used >= maxAllowed,
        });
    } catch (err) {
        console.error('Threshold error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
module.exports.activeQueue = activeQueue;
module.exports.getThresholdSettings = getThresholdSettings;
