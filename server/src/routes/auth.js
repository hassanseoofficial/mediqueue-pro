const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { query } = require('../db');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);

        const result = await query(
            'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
            [email.toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

        const payload = {
            id: user.id,
            clinic_id: user.clinic_id,
            role: user.role,
            name: user.name,
            email: user.email,
            doctor_id: user.doctor_id,
        };

        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '8h',
        });

        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Set refresh token as HTTP-only cookie
        res.cookie('refresh_token', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        res.json({
            token: accessToken,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                clinic_id: user.clinic_id,
                doctor_id: user.doctor_id,
            },
        });
    } catch (err) {
        if (err instanceof z.ZodError) {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
    const refreshToken = req.cookies.refresh_token;
    if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

    try {
        const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET
        );
        const result = await query(
            'SELECT * FROM users WHERE id = $1 AND is_active = TRUE',
            [decoded.id]
        );
        if (!result.rows.length) return res.status(401).json({ error: 'User not found' });

        const user = result.rows[0];
        const payload = {
            id: user.id,
            clinic_id: user.clinic_id,
            role: user.role,
            name: user.name,
            email: user.email,
            doctor_id: user.doctor_id,
        };
        const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
        res.json({ token: accessToken });
    } catch {
        res.status(401).json({ error: 'Invalid refresh token' });
    }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
    res.clearCookie('refresh_token');
    res.json({ success: true });
});

module.exports = router;
