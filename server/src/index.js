require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const { testConnection } = require('./db');
const { initSocket } = require('./sockets/queueSocket');
const authRouter = require('./routes/auth');
const queueRouter = require('./routes/queue');
const adminRouter = require('./routes/admin');
const doctorRouter = require('./routes/doctor');
const { authLimiter } = require('./middleware/rateLimit');

const app = express();
const httpServer = http.createServer(app);

// ─── Trust Proxy (required for Render, Railway, etc.) ─────────────
app.set('trust proxy', 1);

// ─── CORS ──────────────────────────────────────────────────────────
const corsOptions = {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
};
app.use(cors(corsOptions));

// ─── Middlewares ───────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());

// ─── Socket.IO ────────────────────────────────────────────────────
const io = new Server(httpServer, {
    cors: corsOptions,
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
});

// Optionally attach Redis adapter for multi-process (production)
const redisUrl = process.env.REDIS_URL;
if (redisUrl) {
    try {
        const { createAdapter } = require('@socket.io/redis-adapter');
        const { createClient } = require('ioredis');
        const pubClient = createClient(redisUrl);
        const subClient = pubClient.duplicate();
        Promise.all([pubClient.connect?.() || Promise.resolve(), subClient.connect?.() || Promise.resolve()])
            .then(() => {
                io.adapter(createAdapter(pubClient, subClient));
                console.log('✅ Socket.IO Redis adapter enabled');
            })
            .catch((err) => console.warn('Socket.IO Redis adapter failed:', err.message));
    } catch {
        console.warn('⚠️  Socket.IO Redis adapter not available — using default (single-process OK)');
    }
}

initSocket(io);

// ─── Routes ───────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/queue', queueRouter);
app.use('/api/admin', adminRouter);
app.use('/api/doctor', doctorRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 handler
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

const start = async () => {
    await testConnection();
    httpServer.listen(PORT, () => {
        console.log(`\n🚀 MediQueue Pro server running on http://localhost:${PORT}`);
        console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   Socket.IO ready`);
    });
};

start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
