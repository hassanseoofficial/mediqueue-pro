const jwt = require('jsonwebtoken');

/**
 * Verify JWT and attach user + clinicId to req.
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        req.clinicId = decoded.clinic_id; // injected from JWT — cannot be spoofed
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

/**
 * Role-based access control middleware.
 * @param {...string} roles - allowed roles
 */
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (!roles.includes(req.user.role)) {
        return res.status(403).json({ error: `Access denied — required role: ${roles.join(' or ')}` });
    }
    next();
};

/**
 * Superadmin bypass — allows access to any clinic's data.
 * For all others, clinicId comes from JWT (cannot be tampered with).
 */
const clinicScope = (req, res, next) => {
    if (req.user.role === 'superadmin') {
        // Superadmin can scope to any clinic via query param
        req.clinicId = req.query.clinic_id ? parseInt(req.query.clinic_id) : null;
    } else {
        req.clinicId = req.user.clinic_id;
    }
    next();
};

/**
 * Optional auth — attaches user if token present, continues if not.
 */
const optionalAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    try {
        req.user = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
        req.clinicId = req.user.clinic_id;
    } catch {
        // ignore invalid token
    }
    next();
};

module.exports = { authenticate, requireRole, clinicScope, optionalAuth };
