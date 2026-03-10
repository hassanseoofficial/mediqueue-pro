import { create } from 'zustand';

export const useQueueStore = create((set, get) => ({
    // Queue state
    queue: [],
    currentToken: null,
    threshold: null,
    isPaused: false,
    hasEmergency: false,

    // Auth state
    user: null,
    token: null,

    // UI state
    doctorId: null,
    clinicId: null,

    // ── Queue actions ──────────────────────────────────────────────
    setQueue: (queue) => {
        const currentCalled = queue.find(t =>
            ['called', 'present', 'in_consultation'].includes(t.status)
        );
        const hasEmergency = queue.some(t => t.is_emergency && t.status === 'called');

        // Only keep the previous currentToken if it still exists in the new queue
        // AND is still in an active state — prevents stale card after complete/no-show
        const prev = get().currentToken;
        const prevStillActive = prev && queue.some(
            t => t.id === prev.id && ['called', 'present', 'in_consultation'].includes(t.status)
        );

        set({
            queue,
            currentToken: currentCalled ?? (prevStillActive ? prev : null),
            hasEmergency,
        });
    },

    updateToken: (update) => {
        const TERMINAL = ['completed', 'no_show'];
        set(state => {
            const isCurrent = state.currentToken?.id === update.id;
            const updatedCurrent = isCurrent
                ? { ...state.currentToken, ...update }
                : state.currentToken;
            // Clear NowServingCard immediately on terminal status
            const shouldClear = isCurrent && TERMINAL.includes(update.status);
            return {
                queue: state.queue.map(t => t.id === update.id ? { ...t, ...update } : t),
                currentToken: shouldClear ? null : updatedCurrent,
            };
        });
    },

    setCurrentServing: (token) => set({ currentToken: token }),

    setThreshold: (data) => set({ threshold: data }),

    setIsPaused: (paused) => set({ isPaused: paused }),

    addEmergencyToken: (token) => set(state => ({
        queue: [token, ...state.queue],
        hasEmergency: true,
        currentToken: token,
    })),

    // ── Auth actions ───────────────────────────────────────────────
    setAuth: (user, token) => {
        localStorage.setItem('mq_token', token);
        localStorage.setItem('mq_user', JSON.stringify(user));
        set({ user, token });
    },

    logout: () => {
        localStorage.removeItem('mq_token');
        localStorage.removeItem('mq_user');
        set({ user: null, token: null, queue: [], currentToken: null });
    },

    initFromStorage: () => {
        const token = localStorage.getItem('mq_token');
        const userStr = localStorage.getItem('mq_user');
        if (token && userStr) {
            try {
                const user = JSON.parse(userStr);
                set({ user, token });
            } catch {
                localStorage.clear();
            }
        }
    },

    setClinicContext: (clinicId, doctorId) => set({ clinicId, doctorId }),
}));
