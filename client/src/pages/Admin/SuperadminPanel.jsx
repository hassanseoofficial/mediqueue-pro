import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, queueApi } from '../../hooks/useQueueActions';
import { useQueueStore } from '../../store/queueStore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const Field = ({ label, children }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wide">{label}</label>
        {children}
    </div>
);

const Input = ({ className = '', ...props }) => (
    <input
        className={`bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                    focus:outline-none focus:border-purple-500 placeholder-gray-600 ${className}`}
        {...props}
    />
);

// ─── Create Clinic Modal ──────────────────────────────────────────────────────

const CreateClinicModal = ({ onClose, onCreated }) => {
    const [form, setForm] = useState({
        name: '', slug: '', address: '', phone: '',
        admin_name: '', admin_email: '', admin_password: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const set = (k) => (e) => {
        let v = e.target.value;
        if (k === 'slug') v = v.toLowerCase().replace(/[^a-z0-9-]/g, '-');
        setForm(f => ({ ...f, [k]: v }));
    };

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await adminApi.createClinic(form);
            onCreated();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create clinic');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h2 className="text-white font-bold text-lg">🏥 Create New Clinic</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
                </div>
                <form onSubmit={submit} className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {error && <div className="col-span-2 bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}

                    <p className="col-span-2 text-xs text-purple-400 font-semibold uppercase tracking-widest">Clinic Details</p>
                    <Field label="Clinic Name"><Input value={form.name} onChange={set('name')} placeholder="City Medical Center" required /></Field>
                    <Field label="Slug (URL)">
                        <Input value={form.slug} onChange={set('slug')} placeholder="city-medical" pattern="^[a-z0-9-]+$" required />
                        <p className="text-[10px] text-gray-600">Patients will visit: /queue/{form.slug || 'your-slug'}</p>
                    </Field>
                    <Field label="Address"><Input value={form.address} onChange={set('address')} placeholder="123 Main St, Karachi" /></Field>
                    <Field label="Phone"><Input value={form.phone} onChange={set('phone')} placeholder="+92-21-1234567" /></Field>

                    <p className="col-span-2 text-xs text-purple-400 font-semibold uppercase tracking-widest mt-2">Admin Account</p>
                    <Field label="Admin Name"><Input value={form.admin_name} onChange={set('admin_name')} placeholder="Clinic Admin" required /></Field>
                    <Field label="Admin Email"><Input type="email" value={form.admin_email} onChange={set('admin_email')} placeholder="admin@clinic.com" required /></Field>
                    <Field label="Admin Password" className="col-span-2">
                        <Input type="password" value={form.admin_password} onChange={set('admin_password')} placeholder="Min 6 characters" minLength={6} required />
                    </Field>

                    <div className="col-span-2 flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl bg-gray-800 text-gray-400 font-bold hover:bg-gray-700">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 disabled:opacity-50">
                            {loading ? 'Creating…' : 'Create Clinic'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Edit Clinic Modal ────────────────────────────────────────────────────────

const EditClinicModal = ({ clinic, onClose, onSaved }) => {
    const [form, setForm] = useState({ name: clinic.name, address: clinic.address || '', phone: clinic.phone || '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await adminApi.updateClinic(clinic.id, form);
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to update clinic');
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async () => {
        if (!confirm(`${clinic.is_active ? 'Deactivate' : 'Reactivate'} clinic "${clinic.name}"?`)) return;
        try {
            await adminApi.updateClinic(clinic.id, { is_active: !clinic.is_active });
            onSaved(); onClose();
        } catch { setError('Failed'); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <h2 className="text-white font-bold">Edit: {clinic.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
                </div>
                <form onSubmit={submit} className="p-5 space-y-4">
                    {error && <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>}
                    <Field label="Clinic Name"><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></Field>
                    <Field label="Address"><Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></Field>
                    <Field label="Phone"><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></Field>
                    <div className="flex gap-3 pt-1">
                        <button type="submit" disabled={saving} className="flex-1 py-2 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 disabled:opacity-50">
                            {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button type="button" onClick={toggleActive}
                            className={`flex-1 py-2 rounded-xl font-bold border ${clinic.is_active ? 'border-red-700 text-red-300 hover:bg-red-900/30' : 'border-green-700 text-green-300 hover:bg-green-900/30'}`}>
                            {clinic.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ─── Clinic URLs Modal ────────────────────────────────────────────────────────

const ClinicUrlsModal = ({ clinic, onClose }) => {
    const [urls, setUrls] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const baseUrl = window.location.origin;

    useEffect(() => {
        queueApi.clinicUrls(clinic.slug)
            .then(res => setUrls(res.data))
            .catch(err => setError(err.response?.data?.error || 'Failed to load URLs'))
            .finally(() => setLoading(false));
    }, [clinic.slug]);

    const copyToClipboard = (url) => {
        navigator.clipboard.writeText(url);
    };

    const UrlRow = ({ label, url, description }) => (
        <div className="bg-gray-900/50 rounded-xl p-3 border border-white/5">
            <p className="text-xs text-gray-400 font-semibold mb-1">{label}</p>
            <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-green-400 font-mono break-all">{url}</code>
                <button
                    onClick={() => copyToClipboard(url)}
                    className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-300 hover:bg-gray-700 shrink-0"
                >
                    Copy
                </button>
                <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-xs px-2 py-1 rounded bg-blue-800 text-blue-200 hover:bg-blue-700 shrink-0">
                    Open
                </a>
            </div>
            {description && <p className="text-xs text-gray-600 mt-1">{description}</p>}
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-gray-950 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 sticky top-0 bg-gray-950">
                    <div>
                        <h2 className="text-white font-bold text-lg">🔗 Dynamic URLs</h2>
                        <p className="text-gray-400 text-xs">{clinic.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
                </div>

                <div className="p-5 space-y-4">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                    ) : error ? (
                        <div className="bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">{error}</div>
                    ) : urls ? (
                        <>
                            <div>
                                <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-2">Patient Queue Page</p>
                                <UrlRow
                                    label="Patient Ticket Page"
                                    url={`${baseUrl}/queue/${clinic.slug}`}
                                    description="Share this URL with patients to get queue tickets"
                                />
                            </div>

                            {urls.doctors?.length > 0 && (
                                <div>
                                    <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-2">Display Boards (Per Doctor)</p>
                                    <div className="space-y-2">
                                        {urls.doctors.map(doc => (
                                            <UrlRow
                                                key={doc.doctor_id}
                                                label={`TV Display - ${doc.doctor_name}`}
                                                url={`${baseUrl}/display/${clinic.slug}/${doc.doctor_id}`}
                                                description="Show this on waiting room TV"
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <p className="text-xs text-purple-400 font-semibold uppercase tracking-wider mb-2">Admin & Login</p>
                                <div className="space-y-2">
                                    <UrlRow
                                        label="Admin Login"
                                        url={`${baseUrl}/login`}
                                        description="Admin and doctor login page"
                                    />
                                    <UrlRow
                                        label="Admin Dashboard"
                                        url={`${baseUrl}/admin`}
                                        description="Queue management dashboard"
                                    />
                                </div>
                            </div>

                            {urls.doctors?.length === 0 && (
                                <div className="bg-yellow-900/30 border border-yellow-700 rounded-xl p-4">
                                    <p className="text-yellow-300 text-sm font-semibold">No doctors added yet</p>
                                    <p className="text-yellow-400/70 text-xs mt-1">Add doctors in the Doctors management page to generate display board URLs.</p>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

// ─── Clinic Card ──────────────────────────────────────────────────────────────

const ClinicCard = ({ clinic, onEdit, onViewUrls }) => (
    <div className={`glass rounded-2xl p-4 border ${clinic.is_active ? 'border-white/10' : 'border-red-800/30 opacity-60'}`}>
        <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-bold truncate">{clinic.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${clinic.is_active ? 'bg-green-800 text-green-200' : 'bg-red-900 text-red-300'}`}>
                        {clinic.is_active ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <p className="text-xs text-purple-400 mt-0.5 font-mono">/{clinic.slug}</p>
                {clinic.address && <p className="text-xs text-gray-500 mt-1">{clinic.address}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
                <button onClick={() => onViewUrls(clinic)} className="text-xs px-3 py-1.5 rounded-lg bg-blue-800 text-blue-200 hover:bg-blue-700 font-bold">
                    🔗 URLs
                </button>
                <button onClick={() => onEdit(clinic)} className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 font-bold">
                    Edit ✏
                </button>
            </div>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-gray-400">
            <span>🩺 {clinic.doctor_count || 0} doctors</span>
            <span>👤 {clinic.user_count || 0} users</span>
            {clinic.phone && <span>📞 {clinic.phone}</span>}
        </div>
    </div>
);

// ─── Info Card ────────────────────────────────────────────────────────────────

const InfoCard = ({ icon, title, text }) => (
    <div className="glass rounded-xl p-4 border border-white/10">
        <p className="text-2xl mb-2">{icon}</p>
        <p className="text-white font-bold text-sm">{title}</p>
        <p className="text-gray-400 text-xs mt-1">{text}</p>
    </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const SuperadminPanel = () => {
    const { user } = useQueueStore();
    const [clinics, setClinics] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [editClinic, setEditClinic] = useState(null);
    const [urlsClinic, setUrlsClinic] = useState(null);
    const [error, setError] = useState('');

    const loadClinics = useCallback(async () => {
        try {
            setLoading(true);
            const res = await adminApi.getClinics();
            setClinics(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load clinics');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadClinics(); }, [loadClinics]);

    return (
        <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0f' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 sticky top-0 z-10" style={{ background: '#0a0a0f' }}>
                <div className="flex items-center gap-3">
                    <Link to="/admin" className="text-gray-400 hover:text-white text-xl">←</Link>
                    <div>
                        <h1 className="text-white font-black text-lg">🏥 Superadmin Panel</h1>
                        <p className="text-xs text-gray-500">{clinics.length} clinic{clinics.length !== 1 ? 's' : ''} in system</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white font-bold text-sm hover:bg-purple-500 transition-colors"
                >
                    ➕ New Clinic
                </button>
            </div>

            <div className="flex-1 p-4 space-y-4 pb-10">
                {error && <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>}

                {/* Architecture info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <InfoCard icon="🔒" title="Full Data Isolation" text="Each clinic's data is separated by clinic_id — completely invisible to other clinics." />
                    <InfoCard icon="⚡" title="One Server, Many Clinics" text="Add as many clinics as you want — no extra servers or databases needed." />
                    <InfoCard icon="👥" title="Per-Clinic Admins" text="Each clinic has its own admin who manages their doctors and settings independently." />
                </div>

                <p className="text-xs text-gray-600 uppercase tracking-widest px-1 font-semibold pt-2">All Clinics</p>

                {loading ? (
                    <div className="text-center py-16">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Loading clinics…</p>
                    </div>
                ) : clinics.length === 0 ? (
                    <div className="text-center py-16">
                        <p className="text-5xl mb-4">🏥</p>
                        <p className="text-gray-400 font-bold">No clinics yet</p>
                        <p className="text-gray-600 text-sm mt-1">Create the first clinic to get started</p>
                    </div>
                ) : (
                    clinics.map(c => <ClinicCard key={c.id} clinic={c} onEdit={setEditClinic} onViewUrls={setUrlsClinic} />)
                )}

                {/* How to onboard guide */}
                <div className="glass rounded-2xl p-4 border border-purple-800/30 mt-4">
                    <p className="text-purple-300 font-bold text-sm mb-3">📋 How to Onboard a New Clinic</p>
                    <ol className="space-y-2 text-xs text-gray-400">
                        <li><span className="text-purple-400 font-bold">1.</span> Click "New Clinic" and fill in the clinic details + admin account</li>
                        <li><span className="text-purple-400 font-bold">2.</span> Share the admin email/password with the clinic admin</li>
                        <li><span className="text-purple-400 font-bold">3.</span> The clinic admin logs in at <code className="text-purple-300">/login</code> and goes to <code className="text-purple-300">⚕ Doctors</code> to add their doctors</li>
                        <li><span className="text-purple-400 font-bold">4.</span> Patients join via <code className="text-purple-300">/queue/{'<slug>'}</code> — e.g. <code className="text-purple-300">/queue/city-medical</code></li>
                        <li><span className="text-purple-400 font-bold">5.</span> Display board is at <code className="text-purple-300">/display/{'{clinicId}/{doctorId}'}</code></li>
                    </ol>
                </div>
            </div>

            {showCreate && <CreateClinicModal onClose={() => setShowCreate(false)} onCreated={loadClinics} />}
            {editClinic && <EditClinicModal clinic={editClinic} onClose={() => setEditClinic(null)} onSaved={loadClinics} />}
            {urlsClinic && <ClinicUrlsModal clinic={urlsClinic} onClose={() => setUrlsClinic(null)} />}
        </div>
    );
};

export default SuperadminPanel;
