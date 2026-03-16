import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQueueStore } from '../store/queueStore';

// Use same URL as API, fallback to localhost for dev
const SOCKET_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export const useQueueSocket = (clinicId, doctorId) => {
    const { setQueue, setCurrentServing, setThreshold, addEmergencyToken, setIsPaused, updateToken, token } = useQueueStore();
    const socketRef = useRef(null);

    useEffect(() => {
        if (!clinicId || !doctorId) return;

        const socket = io(SOCKET_URL, {
            auth: token ? { token } : {},
            transports: ['websocket', 'polling'],
            reconnectionDelay: 1000,
            reconnectionAttempts: 10,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join:queue', { clinicId, doctorId });
            socket.emit('join:display', { clinicId, doctorId });
        });

        socket.on('queue:updated', (queue) => setQueue(queue));
        socket.on('token:called', (t) => setCurrentServing(t));
        socket.on('token:status', (update) => updateToken(update));
        socket.on('threshold:update', (data) => setThreshold(data));
        socket.on('emergency:insert', (t) => addEmergencyToken(t));
        socket.on('queue:paused', ({ paused }) => setIsPaused(paused));

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [clinicId, doctorId]);

    return socketRef;
};

/**
 * Hook for patient status page — joins personal token room.
 */
export const usePatientSocket = (tokenId, onStatusUpdate) => {
    const socketRef = useRef(null);

    useEffect(() => {
        if (!tokenId) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 20,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join:patient', { tokenId });
        });

        socket.on('token:status', (data) => onStatusUpdate(data));
        socket.on('penalty:applied', (data) => onStatusUpdate({ ...data, type: 'penalty' }));

        return () => socket.disconnect();
    }, [tokenId]);

    return socketRef;
};

/**
 * Hook for display board.
 */
export const useDisplaySocket = (clinicId, doctorId, onUpdate) => {
    useEffect(() => {
        if (!clinicId || !doctorId) return;

        const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
        socket.on('connect', () => socket.emit('join:display', { clinicId, doctorId }));
        socket.on('queue:updated', onUpdate);
        socket.on('token:called', onUpdate);
        socket.on('emergency:insert', onUpdate);

        return () => socket.disconnect();
    }, [clinicId, doctorId]);
};
