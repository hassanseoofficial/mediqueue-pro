import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { queueApi } from '../../hooks/useQueueActions';

const QueueJoin = () => {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        patient_name: '',
        phone: '',
        type: 'walkin',
    });
    const [companions, setCompanions] = useState([]);
    const [addCompanions, setAddCompanions] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [thresholdInfo, setThresholdInfo] = useState(null);

    // For demo: hardcoded clinic/doctor. In production, derive from URL slug.
    const clinicId = 1;
    const doctorId = 1;

    useEffect(() => {
        queueApi.threshold(doctorId).then(r => setThresholdInfo(r.data)).catch(() => { });
    }, [doctorId]);

    const addCompanion = () => {
        if (companions.length < 4) setCompanions(c => [...c, { name: '', relationship: '' }]);
    };
    const removeCompanion = (i) => setCompanions(c => c.filter((_, idx) => idx !== i));
    const updateCompanion = (i, field, val) => setCompanions(c => c.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const res = await queueApi.join({
                clinic_id: clinicId,
                doctor_id: doctorId,
                patient_name: form.patient_name,
                phone: form.phone,
                type: form.type,
                sub_patients: addCompanions ? companions.filter(c => c.name.trim()) : [],
            });
            navigate(`/token/${res.data.token_id}`);
        } catch (err) {
            setError(err.response?.data?.message || err.response?.data?.error || 'Failed to get ticket.');
        } finally {
            setLoading(false);
        }
    };

    const isFull = thresholdInfo?.is_full;
    const isClosed = thresholdInfo && !thresholdInfo.is_open;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4"
            style={{ background: 'radial-gradient(ellipse at 50% -20%, #0f2040 0%, #0a0a0f 60%)' }}>
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="text-5xl mb-3">🏥</div>
                    <h1 className="text-2xl font-black text-white">Get Your Queue Ticket</h1>
                    <p className="text-gray-500 text-sm mt-1">City Medical Center · Dr. Ahmed Khan</p>
                </div>

                {/* Threshold Status Banner */}
                {thresholdInfo && (
                    <div className={`rounded-xl px-4 py-3 mb-4 flex items-center gap-3 ${isFull ? 'bg-red-900/50 border border-red-700' : isClosed ? 'bg-gray-800 border border-gray-700' : 'bg-green-900/30 border border-green-800'}`}>
                        <span className="text-xl">{isFull ? '🔴' : isClosed ? '🕐' : '🟢'}</span>
                        <div>
                            {isFull ? (
                                <p className="text-red-200 font-bold text-sm">Queue Full — No more slots available today</p>
                            ) : isClosed ? (
                                <p className="text-gray-300 font-bold text-sm">Session Closed · Opens: {thresholdInfo.session_start}</p>
                            ) : (
                                <p className="text-green-200 font-bold text-sm">Open · {thresholdInfo.remaining} slots remaining</p>
                            )}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-4">
                    {error && (
                        <div className="bg-red-900/50 border border-red-700 text-red-200 text-sm px-4 py-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Your Full Name *</label>
                        <input
                            required
                            className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-blue-500 outline-none transition-colors"
                            placeholder="e.g. Ali Hassan"
                            value={form.patient_name}
                            onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))}
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-1.5">Phone Number</label>
                        <input
                            type="tel"
                            className="w-full bg-gray-900 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-blue-500 outline-none transition-colors"
                            placeholder="+92-300-1234567"
                            value={form.phone}
                            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        />
                    </div>

                    {/* Add companions */}
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setAddCompanions(a => !a)}
                            className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-xl transition-colors ${addCompanions ? 'bg-blue-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                            <span>{addCompanions ? '✓' : '+'}</span>
                            Add Companions
                        </button>
                        <span className="text-xs text-gray-600">For family visits (max 4)</span>
                    </div>

                    {addCompanions && (
                        <div className="space-y-2">
                            {companions.map((c, i) => (
                                <div key={i} className="flex gap-2 items-center">
                                    <input
                                        required
                                        className="flex-1 bg-gray-900 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-blue-500 outline-none"
                                        placeholder={`Companion ${i + 1} name`}
                                        value={c.name}
                                        onChange={e => updateCompanion(i, 'name', e.target.value)}
                                    />
                                    <input
                                        className="w-28 bg-gray-900 text-white rounded-xl px-3 py-2.5 text-sm border border-gray-700 focus:border-blue-500 outline-none"
                                        placeholder="Relation"
                                        value={c.relationship}
                                        onChange={e => updateCompanion(i, 'relationship', e.target.value)}
                                    />
                                    <button type="button" onClick={() => removeCompanion(i)}
                                        className="text-red-500 hover:text-red-400 text-lg font-bold">×</button>
                                </div>
                            ))}
                            {companions.length < 4 && (
                                <button type="button" onClick={addCompanion}
                                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                                    + Add another
                                </button>
                            )}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || isFull || isClosed}
                        className="w-full py-4 rounded-xl font-black text-white text-base tracking-wide transition-all disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #27AE60, #1E8449)', boxShadow: '0 6px 0 rgba(0,0,0,0.3)' }}
                    >
                        {loading ? 'Getting Your Ticket...' : isFull ? 'Queue Full' : isClosed ? 'Session Closed' : '🎫 Get My Ticket'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default QueueJoin;
