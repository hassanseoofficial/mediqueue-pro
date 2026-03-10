import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { queueApi } from '../../hooks/useQueueActions';
import { usePatientSocket } from '../../hooks/useQueueSocket';

const STATUS_CONFIG = {
    waiting: { label: 'Waiting', color: '#64748b', icon: '⏳', desc: 'Please wait for your number to be called.' },
    called: { label: 'Called!', color: '#3b82f6', icon: '📣', desc: 'Your number has been called! Please proceed to the counter.' },
    present: { label: 'Present', color: '#22c55e', icon: '✅', desc: 'You have been marked as arrived.' },
    in_consultation: { label: 'In Consultation', color: '#10b981', icon: '🩺', desc: 'You are currently with the doctor.' },
    penalized: { label: 'Penalized', color: '#d97706', icon: '⚠️', desc: 'You missed the call. Your position has been moved back.' },
    no_show: { label: 'No-Show', color: '#dc2626', icon: '❌', desc: 'Marked as no-show. Please visit the reception desk.' },
    completed: { label: 'Completed', color: '#6b7280', icon: '✓', desc: 'Your consultation is complete. Thank you!' },
    on_hold: { label: 'On Hold', color: '#ea580c', icon: '⏸', desc: 'Your token is on hold. Please stay nearby.' },
};

const TokenStatus = () => {
    const { tokenId } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStatus = async () => {
        try {
            const res = await queueApi.status(tokenId);
            setData(res.data);
        } catch (err) {
            setError('Token not found.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStatus(); }, [tokenId]);

    // WebSocket: update status live
    usePatientSocket(tokenId, (update) => {
        setData(prev => prev ? { ...prev, ...update } : prev);
    });

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <div className="text-gray-400 text-center">
                <div className="text-4xl animate-spin mb-4">⚙</div>
                <p>Loading your ticket...</p>
            </div>
        </div>
    );

    if (error || !data) return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="text-center">
                <p className="text-6xl mb-4">🔍</p>
                <p className="text-red-400 font-bold">{error || 'Token not found'}</p>
            </div>
        </div>
    );

    const cfg = STATUS_CONFIG[data.status] || STATUS_CONFIG.waiting;

    return (
        <div className="min-h-screen flex flex-col items-center justify-start pt-8 p-4"
            style={{ background: 'radial-gradient(ellipse at 50% -20%, #0f2040 0%, #0a0a0f 60%)' }}>
            <div className="w-full max-w-sm">
                {/* Clinic Header */}
                <div className="text-center mb-6">
                    <p className="text-gray-500 text-xs uppercase tracking-widest">City Medical Center</p>
                    <p className="text-gray-400 text-sm">Dr. Queue Status</p>
                </div>

                {/* Token Number */}
                <div className="glass rounded-3xl p-8 text-center mb-4"
                    style={{ border: `2px solid ${cfg.color}40` }}>
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">Your Token</p>
                    <p className="text-7xl font-black tracking-tight mb-2" style={{ color: cfg.color }}>
                        {data.token_number}
                    </p>
                    <p className="text-gray-300 font-semibold">{data.patient_name}</p>
                    {data.total_sub_patients > 1 && (
                        <p className="text-xs text-blue-400 mt-1">+{data.total_sub_patients - 1} companions</p>
                    )}
                </div>

                {/* Status Badge */}
                <div className="rounded-2xl p-4 mb-4 text-center"
                    style={{ backgroundColor: `${cfg.color}20`, border: `1px solid ${cfg.color}50` }}>
                    <p className="text-4xl mb-2">{cfg.icon}</p>
                    <p className="text-xl font-black" style={{ color: cfg.color }}>{cfg.label}</p>
                    <p className="text-gray-400 text-sm mt-1">{cfg.desc}</p>
                </div>

                {/* Stats Row */}
                {data.status === 'waiting' && (
                    <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="glass rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-white">{data.ahead ?? '—'}</p>
                            <p className="text-xs text-gray-500 mt-1">People Ahead</p>
                        </div>
                        <div className="glass rounded-2xl p-4 text-center">
                            <p className="text-3xl font-black text-white">
                                {data.est_wait_min ? `~${data.est_wait_min}m` : '—'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">Est. Wait</p>
                        </div>
                    </div>
                )}

                {/* Sub-patients */}
                {data.sub_patients?.length > 0 && (
                    <div className="glass rounded-2xl p-4 mb-4">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">Companions</p>
                        <div className="space-y-2">
                            {data.sub_patients.map((sp) => (
                                <div key={sp.id} className="flex justify-between items-center">
                                    <span className="text-sm text-white font-medium">{sp.name}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold status-${sp.status}`}>
                                        {sp.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Slots Remaining */}
                {data.slots_remaining !== null && (
                    <p className="text-center text-xs text-gray-600">
                        {data.slots_remaining} slots remaining today
                    </p>
                )}

                {/* Live indicator */}
                <div className="flex items-center justify-center gap-1.5 mt-4">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <p className="text-xs text-gray-600">Live updates · No refresh needed</p>
                </div>
            </div>
        </div>
    );
};

export default TokenStatus;
