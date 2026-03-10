/**
 * Redis service with graceful in-memory fallback when Redis is unavailable.
 * This allows local development without running Redis.
 */

let client;
const inMemoryStore = new Map();

const createMemoryClient = () => ({
    get: async (key) => inMemoryStore.get(key) ?? null,
    set: async (key, value) => { inMemoryStore.set(key, String(value)); return 'OK'; },
    del: async (key) => { inMemoryStore.delete(key); return 1; },
    incr: async (key) => {
        const val = parseInt(inMemoryStore.get(key) || '0') + 1;
        inMemoryStore.set(key, String(val));
        return val;
    },
    incrby: async (key, amount) => {
        const val = parseInt(inMemoryStore.get(key) || '0') + amount;
        inMemoryStore.set(key, String(val));
        return val;
    },
    decr: async (key) => {
        const val = parseInt(inMemoryStore.get(key) || '0') - 1;
        inMemoryStore.set(key, String(val));
        return val;
    },
    decrby: async (key, amount) => {
        const val = parseInt(inMemoryStore.get(key) || '0') - amount;
        inMemoryStore.set(key, String(val));
        return val;
    },
    expire: async () => 1,
    setex: async (key, _ttl, value) => { inMemoryStore.set(key, String(value)); return 'OK'; },
    disconnect: async () => { },
    isMemory: true,
});

const getClient = () => {
    if (client) return client;

    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
        console.warn('⚠️  REDIS_URL not set — using in-memory fallback (not suitable for production)');
        client = createMemoryClient();
        return client;
    }

    try {
        const Redis = require('ioredis');
        const ioClient = new Redis(redisUrl, {
            maxRetriesPerRequest: 0,   // don't retry queued commands
            enableReadyCheck: false,
            lazyConnect: true,
            retryStrategy: () => null, // disable auto-reconnect loop entirely
        });

        ioClient.on('connect', () => console.log('✅ Redis connected'));
        ioClient.on('error', (err) => {
            if (client && client.isMemory) return; // already swapped — silence further events
            console.warn('⚠️  Redis unavailable, switching to in-memory fallback:', err.message);
            client = createMemoryClient(); // swap FIRST so proxy uses memory from here on
            try { ioClient.disconnect(); } catch (_) { } // stop reconnect spam
        });

        // Connect eagerly so the error fires at startup, not mid-request
        ioClient.connect().catch(() => { /* handled by error event */ });

        client = ioClient;
    } catch {
        console.warn('⚠️  ioredis not available, using in-memory fallback');
        client = createMemoryClient();
    }

    return client;
};


// Proxy object that always delegates to the current client
const redis = new Proxy({}, {
    get(_, prop) {
        const c = getClient();
        if (typeof c[prop] === 'function') return c[prop].bind(c);
        return c[prop];
    }
});

module.exports = redis;
