const rateLimit = require('express-rate-limit');

const publicLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60,
    message: { error: 'Too many requests, please slow down.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    message: { error: 'Too many requests.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many login attempts. Please wait 15 minutes.' },
    skipSuccessfulRequests: true,
});

module.exports = { publicLimiter, authLimiter, loginLimiter };
