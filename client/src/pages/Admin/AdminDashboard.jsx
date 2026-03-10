import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQueueStore } from '../../store/queueStore';
import { useQueueSocket } from '../../hooks/useQueueSocket';
import { useQueueActions } from '../../hooks/useQueueActions';
import ActionButton from '../../components/ActionButton';
import NowServingCard from '../../components/NowServingCard';
import ThresholdMeter from '../../components/ThresholdMeter';
import QueueBottomSheet from '../../components/QueueBottomSheet';
import EmergencyModal from '../../components/EmergencyModal';

const NextUpStrip = ({ queue }) => {
    const waiting = queue.filter(t => t.status === 'waiting').slice(0, 3);
    if (!waiting.length) return null;

    return (
        <div className="mx-3 mb-2">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1.5 px-1 font-semibold">Next Up</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
                {waiting.map((t, i) => (
                    <div key={t.id}
                        className="flex-shrink-0 glass rounded-xl px-3 py-2 min-w-[80px] text-center">
                        <p className="text-xs text-gray-400">#{i + 1}</p>
                        <p className="font-black text-white text-sm">{t.token_number}</p>
                        <p className="text-xs text-gray-500 truncate max-w-[70px]">{t.patient_name.split(' ')[0]}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StatusBar = ({ user, isPaused, onPause }) => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div>
            <p className="text-xs text-gray-500">Logged in as</p>
            <p className="text-sm font-bold text-white">{user?.name}</p>
        </div>
        <div className="flex items-center gap-3">
            {isPaused && (
                <span className="text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded-full font-bold animate-pulse">
                    ⏸ PAUSED
                </span>
            )}
            {(user?.role === 'admin' || user?.role === 'superadmin') && (
                <Link
                    to="/admin/doctors"
                    className="text-xs px-3 py-1.5 rounded-lg font-bold bg-gray-800 text-blue-400 hover:bg-gray-700 transition-colors"
                >
                    ⚕ Doctors
                </Link>
            )}
            {user?.role === 'superadmin' && (
                <Link
                    to="/superadmin"
                    className="text-xs px-3 py-1.5 rounded-lg font-bold bg-gray-800 text-purple-400 hover:bg-gray-700 transition-colors"
                >
                    🏥 Clinics
                </Link>
            )}
            <button
                onClick={onPause}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${isPaused ? 'bg-green-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
            >
                {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
        </div>
    </div>
);

const AdminDashboard = () => {
    const { clinicId: paramClinic, doctorId: paramDoctor } = useParams();
    const { user, queue, currentToken, threshold, hasEmergency, isPaused } = useQueueStore();
    const actions = useQueueActions();
    const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
    const [doctorId, setDoctorId] = useState(paramDoctor || user?.doctor_id || 1);
    const [clinicId, setClinicId] = useState(paramClinic || user?.clinic_id || 1);
    const [loading, setLoading] = useState(false);

    // Connect Socket.IO and get live queue
    useQueueSocket(clinicId, doctorId);

    // Load initial queue on mount
    useEffect(() => {
        actions.getQueue(doctorId).then(res => {
            useQueueStore.getState().setQueue(res.data);
        }).catch(() => { });
    }, [doctorId]);

    const withLoading = async (fn) => {
        setLoading(true);
        try { await fn(); } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleCallNext = () => withLoading(() => actions.callNext(doctorId));
    const handlePresent = () => currentToken && withLoading(() => actions.markPresent(currentToken.id));
    const handleComplete = () => currentToken && withLoading(() => actions.markComplete(currentToken.id));
    const handleOnHold = () => currentToken && withLoading(() => actions.markOnHold(currentToken.id));
    const handlePenalty = () => currentToken && withLoading(() => actions.applyPenalty(currentToken.id));
    const handleNoShow = () => currentToken && withLoading(() => actions.markNoShow(currentToken.id));
    const handleEmergency = (payload) => actions.insertEmergency(doctorId, payload).catch(console.error);
    const handlePause = () => actions.pauseQueue(doctorId, !isPaused).catch(console.error);

    // RE-CALL: if current patient is on_hold, recall them; otherwise call next waiting
    const isOnHold = currentToken?.status === 'on_hold';
    const handleRecall = () => {
        if (isOnHold) {
            withLoading(() => actions.recallToken(currentToken.id));
        } else {
            handleCallNext();
        }
    };

    return (
        <div className="min-h-screen flex flex-col pb-20" style={{ background: '#0a0a0f' }}>
            {/* Header */}
            <StatusBar user={user} isPaused={isPaused} onPause={handlePause} />

            {/* Threshold Meter */}
            <div className="pt-2">
                <ThresholdMeter threshold={threshold} />
            </div>

            {/* Emergency Banner */}
            {hasEmergency && (
                <div className="mx-3 mb-2 px-4 py-2 rounded-xl bg-purple-900/50 border border-purple-600 flex items-center gap-2 animate-pulse">
                    <span className="text-lg">⚡</span>
                    <p className="text-purple-200 text-sm font-bold">Emergency patient at queue front</p>
                </div>
            )}

            {/* Now Serving */}
            <NowServingCard token={currentToken} />

            {/* Next Up */}
            <NextUpStrip queue={queue} />

            {/* Primary Action Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-3 py-2">
                <ActionButton label="CALL NEXT" icon="▶" color="#27AE60" onTap={handleCallNext} disabled={loading || isPaused} />
                <ActionButton label="PRESENT" icon="✔" color="#2980B9" onTap={handlePresent} disabled={loading || !currentToken} />
                <ActionButton
                    label={isOnHold ? 'RE-CALL' : 'RE-CALL'}
                    icon="↻"
                    color={isOnHold ? '#E67E22' : '#17A589'}
                    onTap={handleRecall}
                    disabled={loading || (!isOnHold && !queue.some(t => t.status === 'waiting'))}
                    pulse={isOnHold}
                />
                <ActionButton label="ON HOLD" icon="⏸" color="#E67E22" onTap={handleOnHold} disabled={loading || !currentToken} />
                <ActionButton label="PENALTY" icon="⚠" color="#D4AC0D" onHoldConfirm={handlePenalty} disabled={loading || !currentToken} />
                <ActionButton label="NO-SHOW" icon="✖" color="#C0392B" onHoldConfirm={handleNoShow} disabled={loading || !currentToken} />
                <ActionButton label="EMERGENCY" icon="★" color="#7D3C98" onTap={() => setEmergencyModalOpen(true)} pulse={hasEmergency} />
                <ActionButton label="COMPLETE" icon="✓✓" color="#1E8449" onTap={handleComplete} disabled={loading || !currentToken} />
            </div>

            {/* Queue bottom sheet */}
            <QueueBottomSheet queue={queue} />

            {/* Emergency Modal */}
            <EmergencyModal
                open={emergencyModalOpen}
                onConfirm={handleEmergency}
                onClose={() => setEmergencyModalOpen(false)}
            />
        </div>
    );
};

export default AdminDashboard;
