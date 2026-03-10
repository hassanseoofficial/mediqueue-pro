import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../hooks/useQueueActions';
import { useQueueStore } from '../../store/queueStore';

// ─── Helpers ────────────────────────────────────────────────────────────────

const Field = ({ label, children }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</label>
        {children}
    </div>
);

const Input = ({ className = '', ...props }) => (
    <input
        className={`bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                    focus:outline-none focus:border-blue-500 placeholder-gray-600 ${className}`}
        {...props}
    />
);

const Badge = ({ active }) => (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${active ? 'bg-green-800 text-green-200' : 'bg-red-900 text-red-300'}`}>
        {active ? 'Active' : 'Inactive'}
    </span>
);

// ─── Add Doctor Modal ────────────────────────────────────────────────────────

const AddDoctorModal = ({ onClose, onCreated }) => {
    const [form, setForm] = useState({
        name: '', specialization: 'General Physician', email: '', password: '',
        avg_consultation_min: 8, session_start: '09:00', session_end: '14:00',
        max_patients: 30, buffer_slots: 2,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
    const setNum = (k) => (e) => setForm(f => ({ ...f, [k]: parseInt(e.target.value) || 0 }));

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await adminApi.createDoctor(form);
            onCreated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create doctor');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h2 className="text-white font-bold text-lg">➕ Add New Doctor</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
                </div>
                <form onSubmit={submit} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {error && <div className="col-span-2 bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}

                    <Field label="Full Name"><Input value={form.name} onChange={set('name')} placeholder="Dr. Ahmed Khan" required /></Field>
                    <Field label="Specialization"><Input value={form.specialization} onChange={set('specialization')} placeholder="General Physician" /></Field>
                    <Field label="Login Email"><Input type="email" value={form.email} onChange={set('email')} placeholder="doctor@clinic.com" required /></Field>
                    <Field label="Login Password"><Input type="password" value={form.password} onChange={set('password')} placeholder="Min 6 characters" minLength={6} required /></Field>
                    <Field label="Session Start"><Input type="time" value={form.session_start} onChange={set('session_start')} required /></Field>
                    <Field label="Session End"><Input type="time" value={form.session_end} onChange={set('session_end')} required /></Field>
                    <Field label="Max Patients/Day"><Input type="number" min={1} max={200} value={form.max_patients} onChange={setNum('max_patients')} /></Field>
                    <Field label="Avg Consult (min)"><Input type="number" min={1} max={120} value={form.avg_consultation_min} onChange={setNum('avg_consultation_min')} /></Field>

                    <div className="col-span-2 flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl bg-gray-800 text-gray-400 font-bold hover:bg-gray-700 transition-colors">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-2 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors disabled:opacity-50">
                            {loading ? 'Creating…' : 'Create Doctor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Edit Doctor Drawer ──────────────────────────────────────────────────────

const EditDrawer = ({ doctor, onClose, onSaved }) => {
    const [tab, setTab] = useState('info'); // 'info' | 'schedule' | 'password'
    const [form, setForm] = useState({
        name: doctor.name,
        specialization: doctor.specialization || '',
        avg_consultation_min: doctor.avg_consultation_min || 8,
    });
    const [threshold, setThreshold] = useState({
        session_start: doctor.session_start?.slice(0, 5) || '09:00',
        session_end: doctor.session_end?.slice(0, 5) || '14:00',
        max_patients: doctor.max_patients || 30,
        buffer_slots: doctor.buffer_slots || 2,
        grace_period_minutes: doctor.grace_period_minutes || 5,
        penalty_enabled: doctor.penalty_enabled ?? true,
    });
    const [password, setPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [error, setError] = useState('');

    const saveInfo = async () => {
        setSaving(true); setMsg(''); setError('');
        try {
            await adminApi.updateDoctor(doctor.id, form);
            setMsg('✓ Profile updated');
            onSaved();
        } catch (err) { setError(err.response?.data?.error || 'Failed'); }
        finally { setSaving(false); }
    };

    const saveThreshold = async () => {
        setSaving(true); setMsg(''); setError('');
        try {
            const data = { ...threshold, avg_consultation_min: parseInt(form.avg_consultation_min) };
            await adminApi.updateDoctorThreshold(doctor.id, data);
            setMsg('✓ Schedule updated');
            onSaved();
        } catch (err) { setError(err.response?.data?.error || 'Failed'); }
        finally { setSaving(false); }
    };

    const savePassword = async () => {
        if (password.length < 6) return setError('Password must be at least 6 characters');
        setSaving(true); setMsg(''); setError('');
        try {
            await adminApi.changeDoctorPassword(doctor.id, password);
            setMsg('✓ Password changed');
            setPassword('');
        } catch (err) { setError(err.response?.data?.error || 'Failed'); }
        finally { setSaving(false); }
    };

    const deactivate = async () => {
        if (!confirm(`Deactivate ${doctor.name}? They won't be able to log in.`)) return;
        try {
            await adminApi.updateDoctor(doctor.id, { is_active: false });
            onSaved(); onClose();
        } catch { setError('Failed to deactivate'); }
    };

    const tabs = [
        { id: 'info', label: '👤 Profile' },
        { id: 'schedule', label: '🕐 Schedule' },
        { id: 'password', label: '🔑 Password' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                    <div>
                        <p className="text-white font-bold">{doctor.name}</p>
                        <p className="text-xs text-gray-400">{doctor.specialization}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10 shrink-0">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => { setTab(t.id); setMsg(''); setError(''); }}
                            className={`flex-1 py-2.5 text-xs font-bold transition-colors ${tab === t.id ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="overflow-y-auto flex-1 p-5 space-y-4">
                    {msg && <div className="bg-green-900/40 border border-green-700 rounded-lg px-3 py-2 text-green-300 text-sm">{msg}</div>}
                    {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}

                    {tab === 'info' && (
                        <>
                            <Field label="Full Name"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
                            <Field label="Specialization"><Input value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} /></Field>
                            <p className="text-xs text-gray-500">Login email: <span className="text-gray-300">{doctor.email}</span></p>
                            <button onClick={saveInfo} disabled={saving} className="w-full py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-colors disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save Profile'}
                            </button>
                            {doctor.is_active && (
                                <button onClick={deactivate} className="w-full py-2 rounded-xl bg-red-900/40 border border-red-700 text-red-300 font-bold text-sm hover:bg-red-800/50 transition-colors">
                                    Deactivate Doctor
                                </button>
                            )}
                        </>
                    )}

                    {tab === 'schedule' && (
                        <>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Session Start"><Input type="time" value={threshold.session_start} onChange={e => setThreshold(t => ({ ...t, session_start: e.target.value }))} /></Field>
                                <Field label="Session End"><Input type="time" value={threshold.session_end} onChange={e => setThreshold(t => ({ ...t, session_end: e.target.value }))} /></Field>
                                <Field label="Max Patients"><Input type="number" min={1} value={threshold.max_patients} onChange={e => setThreshold(t => ({ ...t, max_patients: parseInt(e.target.value) || 1 }))} /></Field>
                                <Field label="Buffer Slots"><Input type="number" min={0} value={threshold.buffer_slots} onChange={e => setThreshold(t => ({ ...t, buffer_slots: parseInt(e.target.value) || 0 }))} /></Field>
                                <Field label="Avg Consult (min)"><Input type="number" min={1} max={120} value={form.avg_consultation_min} onChange={e => setForm(f => ({ ...f, avg_consultation_min: parseInt(e.target.value) || 8 }))} /></Field>
                                <Field label="Grace Period (min)"><Input type="number" min={0} value={threshold.grace_period_minutes} onChange={e => setThreshold(t => ({ ...t, grace_period_minutes: parseInt(e.target.value) || 0 }))} /></Field>
                            </div>
                            <div className="flex items-center gap-3">
                                <input type="checkbox" id="pen" checked={threshold.penalty_enabled} onChange={e => setThreshold(t => ({ ...t, penalty_enabled: e.target.checked }))} className="accent-blue-500 w-4 h-4" />
                                <label htmlFor="pen" className="text-sm text-gray-300">Enable no-show penalty system</label>
                            </div>
                            <button onClick={saveThreshold} disabled={saving} className="w-full py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-colors disabled:opacity-50">
                                {saving ? 'Saving…' : 'Save Schedule'}
                            </button>
                        </>
                    )}

                    {tab === 'password' && (
                        <>
                            <p className="text-sm text-gray-400">Set a new login password for <strong className="text-white">{doctor.name}</strong>. You don't need to know the old password.</p>
                            <Field label="New Password">
                                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" minLength={6} />
                            </Field>
                            <button onClick={savePassword} disabled={saving || password.length < 6} className="w-full py-2 rounded-xl bg-amber-600 text-white font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50">
                                {saving ? 'Saving…' : 'Change Password'}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Doctor Card ─────────────────────────────────────────────────────────────

const DoctorCard = ({ doctor, onEdit }) => (
    <div className={`glass rounded-2xl p-4 border ${doctor.is_active ? 'border-white/10' : 'border-red-800/30 opacity-60'}`}>
        <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-bold truncate">{doctor.name}</p>
                    <Badge active={doctor.is_active} />
                </div>
                <p className="text-xs text-blue-400 mt-0.5">{doctor.specialization}</p>
                <p className="text-xs text-gray-500 mt-1">{doctor.email}</p>
            </div>
            <button onClick={() => onEdit(doctor)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 font-bold shrink-0">
                Edit ✏
            </button>
        </div>
        <div className="mt-3 flex gap-3 text-xs text-gray-400 flex-wrap">
            <span>🕐 {doctor.session_start?.slice(0, 5)} – {doctor.session_end?.slice(0, 5)}</span>
            <span>👥 Max {doctor.max_patients} pts</span>
            <span>⏱ ~{doctor.avg_consultation_min} min/pt</span>
        </div>
    </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────

const DoctorManagement = () => {
    const { user } = useQueueStore();
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editDoctor, setEditDoctor] = useState(null);
    const [error, setError] = useState('');

    const loadDoctors = useCallback(async () => {
        try {
            setLoading(true);
            const res = await adminApi.getDoctors();
            setDoctors(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load doctors');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadDoctors(); }, [loadDoctors]);

    const active = doctors.filter(d => d.is_active);
    const inactive = doctors.filter(d => !d.is_active);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0f' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 sticky top-0 z-10" style={{ background: '#0a0a0f' }}>
                <div className="flex items-center gap-3">
                    <Link to="/admin" className="text-gray-400 hover:text-white text-xl transition-colors">←</Link>
                    <div>
                        <h1 className="text-white font-black text-lg">⚕ Doctor Management</h1>
                        <p className="text-xs text-gray-500">{active.length} active doctors</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 transition-colors"
                >
                    ➕ Add Doctor
                </button>
            </div>

            <div className="flex-1 p-4 space-y-3 pb-10">
                {error && <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}

                {loading ? (
                    <div className="text-center py-16">
                        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Loading doctors…</p>
                    </div>
                ) : doctors.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-5xl mb-4">🩺</p>
                        <p className="text-gray-400 font-bold">No doctors yet</p>
                        <p className="text-gray-600 text-sm mt-1">Click "Add Doctor" to get started</p>
                    </div>
                ) : (
                    <>
                        {active.map(d => <DoctorCard key={d.id} doctor={d} onEdit={setEditDoctor} />)}
                        {inactive.length > 0 && (
                            <>
                                <p className="text-xs text-gray-600 uppercase tracking-widest pt-2 px-1 font-semibold">Inactive Doctors</p>
                                {inactive.map(d => <DoctorCard key={d.id} doctor={d} onEdit={setEditDoctor} />)}
                            </>
                        )}
                    </>
                )}
            </div>

            {showAdd && <AddDoctorModal onClose={() => setShowAdd(false)} onCreated={loadDoctors} />}
            {editDoctor && <EditDrawer doctor={editDoctor} onClose={() => setEditDoctor(null)} onSaved={loadDoctors} />}
        </div>
    );
};

export default DoctorManagement;
