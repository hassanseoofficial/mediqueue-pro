const express = require('express');
const { z } = require('zod');
const { query } = require('../db');
const { authenticate, requireRole, clinicScope } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const redis = require('../services/redis');

const router = express.Router();
router.use(authenticate, clinicScope);

// ─── GET /api/doctor/dashboard ───────────────────────────────────
router.get('/dashboard', requireRole('doctor', 'admin', 'superadmin'), async (req, res) => {
    try {
        const doctorId = req.user.doctor_id || req.query.doctor_id;
        if (!doctorId) return res.status(400).json({ error: 'doctor_id required' });

        const stats = await query(
            `SELECT
         COUNT(*) FILTER (WHERE status = 'completed') AS patients_seen,
         COALESCE(SUM(total_sub_patients) FILTER (WHERE status = 'completed'), 0) AS sub_patients_seen,
         COUNT(*) FILTER (WHERE status = 'no_show') AS no_show_count,
         COUNT(*) FILTER (WHERE is_emergency = TRUE) AS emergency_count,
         AVG(EXTRACT(EPOCH FROM (called_at - joined_at))/60) FILTER (WHERE called_at IS NOT NULL) AS avg_wait_min,
         AVG(EXTRACT(EPOCH FROM (completed_at - present_at))/60) FILTER (WHERE completed_at IS NOT NULL AND present_at IS NOT NULL) AS avg_consult_min
       FROM tokens
       WHERE clinic_id = $1 AND doctor_id = $2 AND joined_at::DATE = CURRENT_DATE`,
            [req.clinicId, doctorId]
        );

        const threshold = await query(
            'SELECT * FROM doctor_thresholds WHERE doctor_id = $1',
            [doctorId]
        );

        const cfg = threshold.rows[0];
        const redisKey = `clinic:${req.clinicId}:doctor:${doctorId}:threshold_count`;
        const used = parseInt(await redis.get(redisKey)) || 0;

        const row = stats.rows[0];
        res.json({
            patients_seen: parseInt(row.patients_seen) || 0,
            sub_patients_seen: parseInt(row.sub_patients_seen) || 0,
            no_show_count: parseInt(row.no_show_count) || 0,
            emergency_count: parseInt(row.emergency_count) || 0,
            avg_wait_min: row.avg_wait_min ? parseFloat(row.avg_wait_min).toFixed(1) : null,
            avg_consult_min: row.avg_consult_min ? parseFloat(row.avg_consult_min).toFixed(1) : null,
            threshold: cfg ? {
                used,
                max: cfg.max_patients,
                remaining: Math.max(0, cfg.max_patients - cfg.buffer_slots - used),
                utilization_pct: cfg.max_patients > 0 ? Math.round((used / cfg.max_patients) * 100) : 0,
            } : null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/doctor/reports/daily/:date ─────────────────────────
router.get('/reports/daily/:date', requireRole('doctor', 'admin'), async (req, res) => {
    try {
        const doctorId = req.user.doctor_id || req.query.doctor_id;
        const { date } = req.params;

        const result = await query(
            `SELECT
         COUNT(*) FILTER (WHERE status = 'completed') AS patients_seen,
         COALESCE(SUM(total_sub_patients) FILTER (WHERE status = 'completed'), 0) AS sub_patients_seen,
         COUNT(*) FILTER (WHERE status = 'no_show') AS no_show_count,
         COUNT(*) FILTER (WHERE is_emergency = TRUE) AS emergency_count,
         COUNT(*) FILTER (WHERE type = 'walkin') AS walkin_count,
         COUNT(*) FILTER (WHERE type = 'online') AS online_count,
         COUNT(*) FILTER (WHERE penalty_count > 0) AS penalty_events,
         ROUND((AVG(EXTRACT(EPOCH FROM (called_at - joined_at))/60) FILTER (WHERE called_at IS NOT NULL))::NUMERIC, 1) AS avg_wait_min,
         ROUND((AVG(EXTRACT(EPOCH FROM (completed_at - present_at))/60) FILTER (WHERE completed_at IS NOT NULL AND present_at IS NOT NULL))::NUMERIC, 1) AS avg_consult_min
       FROM tokens
       WHERE clinic_id = $1 AND doctor_id = $2 AND joined_at::DATE = $3`,
            [req.clinicId, doctorId, date]
        );

        res.json({ date, ...result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/doctor/reports/weekly ──────────────────────────────
router.get('/reports/weekly', requireRole('doctor', 'admin'), async (req, res) => {
    try {
        const doctorId = req.user.doctor_id || req.query.doctor_id;

        const result = await query(
            `SELECT
         joined_at::DATE AS date,
         COUNT(*) FILTER (WHERE status = 'completed') AS patients_seen,
         COALESCE(SUM(total_sub_patients) FILTER (WHERE status = 'completed'), 0) AS sub_patients_seen,
         COUNT(*) FILTER (WHERE status = 'no_show') AS no_show_count,
         ROUND((AVG(EXTRACT(EPOCH FROM (called_at - joined_at))/60) FILTER (WHERE called_at IS NOT NULL))::NUMERIC, 1) AS avg_wait_min
       FROM tokens
       WHERE clinic_id = $1 AND doctor_id = $2
         AND joined_at >= CURRENT_DATE - INTERVAL '7 days'
       GROUP BY joined_at::DATE
       ORDER BY date ASC`,
            [req.clinicId, doctorId]
        );

        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/doctor/reports/monthly/:year/:month ────────────────
router.get('/reports/monthly/:year/:month', requireRole('doctor', 'admin'), async (req, res) => {
    try {
        const doctorId = req.user.doctor_id || req.query.doctor_id;
        const { year, month } = req.params;

        const result = await query(
            `SELECT
         joined_at::DATE AS date,
         COUNT(*) FILTER (WHERE status = 'completed') AS patients_seen,
         COUNT(*) FILTER (WHERE status = 'no_show') AS no_show_count,
         ROUND((AVG(EXTRACT(EPOCH FROM (called_at - joined_at))/60) FILTER (WHERE called_at IS NOT NULL))::NUMERIC, 1) AS avg_wait_min
       FROM tokens
       WHERE clinic_id = $1 AND doctor_id = $2
         AND EXTRACT(YEAR FROM joined_at) = $3
         AND EXTRACT(MONTH FROM joined_at) = $4
       GROUP BY joined_at::DATE ORDER BY date ASC`,
            [req.clinicId, doctorId, year, month]
        );

        res.json({ year, month, days: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── GET /api/doctor/reports/history ─────────────────────────────
router.get('/reports/history', requireRole('doctor', 'admin'), async (req, res) => {
    try {
        const doctorId = req.user.doctor_id || req.query.doctor_id;
        const { from, to, limit = 100, offset = 0 } = req.query;

        let queryStr = `
      SELECT t.id, t.token_number, t.patient_name, t.type, t.status,
             t.total_sub_patients, t.joined_at, t.called_at, t.completed_at,
             t.is_emergency, t.penalty_count
      FROM tokens t
      WHERE t.clinic_id = $1 AND t.doctor_id = $2
    `;
        const params = [req.clinicId, doctorId];

        if (from) { params.push(from); queryStr += ` AND t.joined_at::DATE >= $${params.length}`; }
        if (to) { params.push(to); queryStr += ` AND t.joined_at::DATE <= $${params.length}`; }

        queryStr += ` ORDER BY t.joined_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const result = await query(queryStr, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── PATCH /api/doctor/threshold ─────────────────────────────────
const thresholdSchema = z.object({
    session_start: z.string().regex(/^\d{2}:\d{2}$/),
    session_end: z.string().regex(/^\d{2}:\d{2}$/),
    max_patients: z.number().int().min(1).max(200),
    max_walkin: z.number().int().min(0).optional(),
    max_online: z.number().int().min(0).optional(),
    buffer_slots: z.number().int().min(0).max(10).optional(),
    grace_period_minutes: z.number().int().min(1).max(30).optional(),
    penalty_enabled: z.boolean().optional(),
});

router.patch('/threshold', authLimiter, requireRole('doctor', 'admin'), async (req, res) => {
    try {
        const doctorId = req.user.doctor_id || req.body.doctor_id;
        const data = thresholdSchema.parse(req.body);

        await query(
            `UPDATE doctor_thresholds SET
         session_start = $1, session_end = $2, max_patients = $3,
         max_walkin = COALESCE($4, max_walkin), max_online = COALESCE($5, max_online),
         buffer_slots = COALESCE($6, buffer_slots),
         grace_period_minutes = COALESCE($7, grace_period_minutes),
         penalty_enabled = COALESCE($8, penalty_enabled),
         updated_at = NOW()
       WHERE doctor_id = $9 AND clinic_id = $10`,
            [
                data.session_start, data.session_end, data.max_patients,
                data.max_walkin, data.max_online, data.buffer_slots,
                data.grace_period_minutes, data.penalty_enabled,
                doctorId, req.clinicId,
            ]
        );

        res.json({ success: true });
    } catch (err) {
        if (err instanceof z.ZodError) return res.status(400).json({ error: 'Validation failed', details: err.errors });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
