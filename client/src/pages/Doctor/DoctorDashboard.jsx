import { useState, useEffect } from 'react';
import { doctorApi } from '../../hooks/useQueueActions';
import { useQueueStore } from '../../store/queueStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard = ({ label, value, sub, color }) => (
    <div className="glass rounded-2xl p-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">{label}</p>
        <p className="text-3xl font-black" style={{ color: color || '#fff' }}>{value ?? '—'}</p>
        {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
);

const DoctorDashboard = () => {
    const { user, logout } = useQueueStore();
    const [stats, setStats] = useState(null);
    const [weekly, setWeekly] = useState([]);
    const [loading, setLoading] = useState(true);
    const [threshold, setThreshold] = useState(null);
    const [thresholdForm, setThresholdForm] = useState(null);
    const [savingThreshold, setSavingThreshold] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                const [dashRes, weeklyRes] = await Promise.all([
                    doctorApi.dashboard(),
                    doctorApi.reportWeekly(),
                ]);
                setStats(dashRes.data);
                setThreshold(dashRes.data.threshold);
                setWeekly(weeklyRes.data.map(d => ({
                    day: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
                    patients: parseInt(d.patients_seen) || 0,
                    noShows: parseInt(d.no_show_count) || 0,
                })));
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const today = new Date().toISOString().split('T')[0];

    const handleSaveThreshold = async () => {
        if (!thresholdForm) return;
        setSavingThreshold(true);
        try {
            await doctorApi.updateThreshold(thresholdForm);
        } catch (err) {
            console.error(err);
        } finally {
            setSavingThreshold(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-gray-400 animate-pulse">Loading dashboard...</p>
        </div>
    );

    return (
        <div className="min-h-screen p-4 pb-10" style={{ background: '#0a0a0f' }}>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-black text-white">Doctor Portal</h1>
                    <p className="text-gray-500 text-sm">{user?.name} · {today}</p>
                </div>
                <button onClick={logout}
                    className="text-xs text-gray-500 hover:text-white px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors font-semibold">
                    Sign Out
                </button>
            </div>

            {/* Today's Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <StatCard label="Patients Seen" value={stats?.patients_seen} color="#27AE60" />
                <StatCard label="Sub-Patients" value={stats?.sub_patients_seen} color="#3b82f6" />
                <StatCard label="No-Shows" value={stats?.no_show_count} color="#E67E22" />
                <StatCard label="Avg Wait" value={stats?.avg_wait_min ? `${stats.avg_wait_min}m` : null} color="#f1f5f9" />
                <StatCard label="Avg Consult" value={stats?.avg_consult_min ? `${stats.avg_consult_min}m` : null} color="#f1f5f9" />
                <StatCard label="Emergencies" value={stats?.emergency_count} color="#C0392B" />
            </div>

            {/* Threshold */}
            {threshold && (
                <div className="glass rounded-2xl p-4 mb-6">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3 font-semibold">Today's Capacity</p>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Used: <strong className="text-white">{threshold.used}</strong> / {threshold.max}</span>
                        <span className="font-bold" style={{ color: threshold.utilization_pct > 90 ? '#E74C3C' : threshold.utilization_pct > 70 ? '#E67E22' : '#27AE60' }}>
                            {threshold.utilization_pct}%
                        </span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${threshold.utilization_pct}%`,
                                backgroundColor: threshold.utilization_pct > 90 ? '#E74C3C' : threshold.utilization_pct > 70 ? '#E67E22' : '#27AE60',
                            }} />
                    </div>
                </div>
            )}

            {/* Weekly Chart */}
            {weekly.length > 0 && (
                <div className="glass rounded-2xl p-4 mb-6">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 font-semibold">7-Day Trend</p>
                    <ResponsiveContainer width="100%" height={160}>
                        <LineChart data={weekly}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="day" stroke="#475569" tick={{ fontSize: 11 }} />
                            <YAxis stroke="#475569" tick={{ fontSize: 11 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                                labelStyle={{ color: '#f1f5f9' }}
                            />
                            <Line type="monotone" dataKey="patients" stroke="#27AE60" strokeWidth={2} dot={{ r: 4 }} name="Patients" />
                            <Line type="monotone" dataKey="noShows" stroke="#E67E22" strokeWidth={2} dot={{ r: 4 }} name="No-Shows" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Threshold Settings */}
            <div className="glass rounded-2xl p-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-4 font-semibold">Session Settings</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                    {[
                        { label: 'Session Start', key: 'session_start', type: 'time' },
                        { label: 'Session End', key: 'session_end', type: 'time' },
                        { label: 'Max Patients', key: 'max_patients', type: 'number' },
                        { label: 'Buffer Slots', key: 'buffer_slots', type: 'number' },
                    ].map(({ label, key, type }) => (
                        <div key={key}>
                            <label className="text-xs text-gray-500 block mb-1">{label}</label>
                            <input type={type}
                                className="w-full bg-gray-900 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-blue-500 outline-none"
                                onChange={e => setThresholdForm(f => ({ ...(f || {}), [key]: type === 'number' ? parseInt(e.target.value) : e.target.value }))}
                            />
                        </div>
                    ))}
                </div>
                <button onClick={handleSaveThreshold} disabled={savingThreshold || !thresholdForm}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40 transition-colors"
                    style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
                    {savingThreshold ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
};

export default DoctorDashboard;
