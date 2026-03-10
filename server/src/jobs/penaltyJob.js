/**
 * BullMQ Penalty Job — fires after grace period if patient hasn't been marked Present.
 * Falls back to setTimeout when Redis (and thus BullMQ) is not available.
 */

const redis = require('../services/redis');
let Queue, Worker;
const pendingTimers = new Map(); // fallback timers

const initBullMQ = () => {
    if (redis.isMemory) return false; // use setTimeout fallback
    try {
        ({ Queue, Worker } = require('bullmq'));
        return true;
    } catch {
        return false;
    }
};

const hasBullMQ = initBullMQ();

let penaltyQueue;

if (hasBullMQ) {
    penaltyQueue = new Queue('penalty', {
        connection: { url: process.env.REDIS_URL },
        defaultJobOptions: { removeOnComplete: true, removeOnFail: 100 },
    });
}

/**
 * Schedule a penalty job for a token after grace period.
 */
const addPenaltyJob = async (tokenId, clinicId, doctorId, gracePeriodMinutes = 5) => {
    const delayMs = gracePeriodMinutes * 60 * 1000;
    const jobId = `penalty:${tokenId}`;

    if (hasBullMQ && penaltyQueue) {
        await penaltyQueue.add(
            'apply-penalty',
            { tokenId, clinicId, doctorId },
            { delay: delayMs, jobId }
        );
    } else {
        // setTimeout fallback for local dev without Redis
        const timer = setTimeout(() => firePenalty({ tokenId, clinicId, doctorId }), delayMs);
        pendingTimers.set(jobId, timer);
    }
};

/**
 * Cancel a scheduled penalty (called when patient is marked Present).
 */
const cancelPenaltyJob = async (tokenId) => {
    const jobId = `penalty:${tokenId}`;

    if (hasBullMQ && penaltyQueue) {
        const job = await penaltyQueue.getJob(jobId);
        if (job) await job.remove();
    } else {
        const timer = pendingTimers.get(jobId);
        if (timer) {
            clearTimeout(timer);
            pendingTimers.delete(jobId);
        }
    }
};

/**
 * Execute the penalty logic.
 */
const firePenalty = async ({ tokenId, clinicId, doctorId }) => {
    const { query } = require('../db');
    const {
        emitPenalty, emitQueueUpdate, emitTokenStatus,
    } = require('../sockets/queueSocket');
    const { activeQueue } = require('../routes/queue');
    const smsService = require('../services/sms');

    try {
        // Verify token is still in 'called' state — not already marked present
        const tokenResult = await query(
            'SELECT * FROM tokens WHERE id = $1 AND status = $2',
            [tokenId, 'called']
        );
        if (!tokenResult.rows.length) return; // patient arrived or already penalized

        const token = tokenResult.rows[0];

        // Fetch threshold config
        const cfgResult = await query(
            'SELECT positions_back, max_penalties_before_noshow FROM doctor_thresholds WHERE doctor_id = $1',
            [token.doctor_id]
        );
        const cfg = cfgResult.rows[0];
        const positionsBack = cfg?.positions_back || 2;
        const maxPenalties = cfg?.max_penalties_before_noshow || 3;

        if (token.penalty_count + 1 >= maxPenalties) {
            await query(
                `UPDATE tokens SET status = 'no_show', penalty_count = penalty_count + 1 WHERE id = $1`,
                [tokenId]
            );
            emitTokenStatus(tokenId, { status: 'no_show' });
            if (token.phone) smsService.sendNoShow(token.phone, token.token_number).catch(() => { });
        } else {
            const newPos = token.position + positionsBack;
            await query(
                `UPDATE tokens SET status = 'penalized', penalty_count = penalty_count + 1, position = $1 WHERE id = $2`,
                [newPos, tokenId]
            );
            emitPenalty(tokenId, { new_position: newPos, penalty_count: token.penalty_count + 1 });
            emitTokenStatus(tokenId, { status: 'penalized', position: newPos });

            // Schedule next penalty job for next round
            await addPenaltyJob(tokenId, clinicId, doctorId, cfg?.grace_period_minutes || 5);

            if (token.phone) smsService.sendPenalty(token.phone, token.token_number, newPos).catch(() => { });
        }

        // Broadcast updated queue
        const queue = await activeQueue(clinicId, doctorId);
        emitQueueUpdate(clinicId, doctorId, queue);

    } catch (err) {
        console.error('Penalty job error:', err);
    }
};

// Start BullMQ worker if Redis is available
if (hasBullMQ) {
    try {
        const worker = new Worker('penalty', async (job) => firePenalty(job.data), {
            connection: { url: process.env.REDIS_URL },
        });
        worker.on('completed', (job) => console.log(`Penalty job ${job.id} completed`));
        worker.on('failed', (job, err) => console.error(`Penalty job ${job?.id} failed:`, err));
    } catch (err) {
        console.warn('BullMQ worker could not start:', err.message);
    }
}

module.exports = { addPenaltyJob, cancelPenaltyJob };
