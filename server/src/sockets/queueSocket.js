const { queueRoom, patientRoom, displayRoom, adminRoom } = require('./rooms');

let io;

const initSocket = (socketIo) => {
    io = socketIo;

    io.on('connection', (socket) => {
        // Client joins admin/doctor queue view
        socket.on('join:queue', ({ clinicId, doctorId }) => {
            const room = queueRoom(clinicId, doctorId);
            socket.join(room);
        });

        // Patient joins their personal token room
        socket.on('join:patient', ({ tokenId }) => {
            socket.join(patientRoom(tokenId));
        });

        // Display board joins broadcast room
        socket.on('join:display', ({ clinicId, doctorId }) => {
            socket.join(displayRoom(clinicId, doctorId));
        });

        // Admin joins admin-only alerts room
        socket.on('join:admin', ({ clinicId }) => {
            socket.join(adminRoom(clinicId));
        });

        socket.on('disconnect', () => { });
    });
};

/**
 * Emit a full queue update to all admins/doctors on this queue.
 */
const emitQueueUpdate = (clinicId, doctorId, queue) => {
    if (!io) return;
    io.to(queueRoom(clinicId, doctorId)).emit('queue:updated', queue);
    io.to(displayRoom(clinicId, doctorId)).emit('queue:updated', queue);
};

/**
 * Emit token status change to the patient's personal room.
 */
const emitTokenStatus = (tokenId, data) => {
    if (!io) return;
    io.to(patientRoom(tokenId)).emit('token:status', data);
};

/**
 * Emit "token called" event — triggers audio + visual on display board.
 */
const emitTokenCalled = (clinicId, doctorId, tokenData) => {
    if (!io) return;
    io.to(queueRoom(clinicId, doctorId)).emit('token:called', tokenData);
    io.to(displayRoom(clinicId, doctorId)).emit('token:called', tokenData);
    io.to(patientRoom(tokenData.id)).emit('token:status', {
        status: 'called',
        position: 0,
        ahead: 0,
    });
};

/**
 * Emit threshold update.
 */
const emitThresholdUpdate = (clinicId, doctorId, data) => {
    if (!io) return;
    io.to(queueRoom(clinicId, doctorId)).emit('threshold:update', data);
    io.to(displayRoom(clinicId, doctorId)).emit('threshold:update', data);
};

/**
 * Emit emergency insertion event.
 */
const emitEmergency = (clinicId, doctorId, tokenData) => {
    if (!io) return;
    io.to(queueRoom(clinicId, doctorId)).emit('emergency:insert', tokenData);
    io.to(displayRoom(clinicId, doctorId)).emit('emergency:insert', tokenData);
};

/**
 * Emit queue pause/resume.
 */
const emitQueuePaused = (clinicId, doctorId, paused) => {
    if (!io) return;
    io.to(queueRoom(clinicId, doctorId)).emit('queue:paused', { paused });
};

/**
 * Emit penalty applied to patient's room.
 */
const emitPenalty = (tokenId, data) => {
    if (!io) return;
    io.to(patientRoom(tokenId)).emit('penalty:applied', data);
};

module.exports = {
    initSocket,
    emitQueueUpdate,
    emitTokenStatus,
    emitTokenCalled,
    emitThresholdUpdate,
    emitEmergency,
    emitQueuePaused,
    emitPenalty,
    getIo: () => io,
};
