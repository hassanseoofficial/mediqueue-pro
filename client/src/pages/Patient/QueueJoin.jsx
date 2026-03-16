import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { queueApi } from '../../hooks/useQueueActions';

const QueueJoin = () => {
    const navigate = useNavigate();
    const { clinicSlug } = useParams();
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

    // Dynamic clinic/doctor from URL slug
    const [clinicData, setClinicData] = useState(null);
    const [selectedDoctor, setSelectedDoctor] = useState(null);
    const [loadingClinic, setLoadingClinic] = useState(true);
    const [clinicError, setClinicError] = useState('');

    // Fetch clinic data by slug
    useEffect(() => {
        if (!clinicSlug) {
            setClinicError('No clinic specified in URL');
            setLoadingClinic(false);
            return;
        }

        setLoadingClinic(true);
        queueApi.clinicBySlug(clinicSlug)
            .then(res => {
                setClinicData(res.data);
                // Auto-select first doctor if only one
                if (res.data.doctors?.length === 1) {
                    setSelectedDoctor(res.data.doctors[0]);
                }
                setClinicError('');
            })
            .catch(err => {
                setClinicError(err.response?.data?.error || 'Clinic not found');
            })
            .finally(() => setLoadingClinic(false));
    }, [clinicSlug]);

    // Fetch threshold info when doctor is selected
    useEffect(() => {
        if (selectedDoctor?.id) {
            queueApi.threshold(selectedDoctor.id)
                .then(r => setThresholdInfo(r.data))
                .catch(() => setThresholdInfo(null));
        }
    }, [selectedDoctor]);

    const addCompanion = () => {
        if (companions.length < 4) setCompanions(c => [...c, { name: '', relationship: '' }]);
    };
    const removeCompanion = (i) => setCompanions(c => c.filter((_, idx) => idx !== i));
    const updateCompanion = (i, field, val) => setCompanions(c => c.map((x, idx) => idx === i ? { ...x, [field]: val } : x));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!clinicData?.clinic?.id || !selectedDoctor?.id) {
            setError('Please select a doctor');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await queueApi.join({
                clinic_id: clinicData.clinic.id,
                doctor_id: selectedDoctor.id,
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

    const isFull = selectedDoctor?.is_full || thresholdInfo?.is_full;
    const isClosed = thresholdInfo && !thresholdInfo.is_open;

    // Loading state
    if (loadingClinic) {
        return (
            <div className="min-h-screen flex items-center justify-center"
                style={{ background: 'radial-gradient(ellipse at 50% -20%, #0f2040 0%, #0a0a0f 60%)' }}>
                <div className="text-center">
                    <div className="animate-spin text-4xl mb-4">⏳</div>
                    <p className="text-gray-400">Loading clinic...</p>
                </div>
            </div>
        );
    }

    // No clinic slug provided
    if (!clinicSlug) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4"
                style={{ background: 'radial-gradient(ellipse at 50% -20%, #0f2040 0%, #0a0a0f 60%)' }}>
                <div className="glass rounded-2xl p-8 text-center max-w-md">
                    <div className="text-5xl mb-4">🏥</div>
                    <h1 className="text-xl font-bold text-white mb-2">Welcome to MediQueue</h1>
                    <p className="text-gray-400 mb-4">Please use your clinic's queue URL to get a ticket.</p>
                    <div className="bg-gray-800 rounded-xl p-4 text-left">
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Example URL Format</p>
                        <code className="text-green-400 text-sm">/queue/your-clinic-slug</code>
                    </div>
                    <p className="text-gray-600 text-xs mt-4">
                        Contact your clinic for the correct queue link.
                    </p>
                </div>
            </div>
        );
    }

    // Clinic not found
    if (clinicError) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4"
                style={{ background: 'radial-gradient(ellipse at 50% -20%, #0f2040 0%, #0a0a0f 60%)' }}>
                <div className="glass rounded-2xl p-8 text-center max-w-md">
                    <div className="text-5xl mb-4">❌</div>
                    <h1 className="text-xl font-bold text-white mb-2">Clinic Not Found</h1>
                    <p className="text-gray-400 mb-4">{clinicError}</p>
                    <p className="text-gray-500 text-sm">
                        URL: <code className="bg-gray-800 px-2 py-1 rounded">/queue/{clinicSlug}</code>
                    </p>
                    <p className="text-gray-600 text-xs mt-4">
                        Please check the URL or contact your clinic.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4"
            style={{ background: 'radial-gradient(ellipse at 50% -20%, #0f2040 0%, #0a0a0f 60%)' }}>
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-6">
                    <div className="text-5xl mb-3">🏥</div>
                    <h1 className="text-2xl font-black text-white">Get Your Queue Ticket</h1>
                    <p className="text-gray-500 text-sm mt-1">{clinicData?.clinic?.name || 'Clinic'}</p>
                </div>

                {/* Doctor Selection (if multiple doctors) */}
                {clinicData?.doctors?.length > 1 && (
                    <div className="glass rounded-2xl p-4 mb-4">
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider block mb-2">
                            Select Doctor *
                        </label>
                        <div className="space-y-2">
                            {clinicData.doctors.map(doc => (
                                <button
                                    key={doc.id}
                                    type="button"
                                    onClick={() => setSelectedDoctor(doc)}
                                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                                        selectedDoctor?.id === doc.id
                                            ? 'bg-blue-900/50 border-blue-500'
                                            : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                    } ${doc.is_full ? 'opacity-50' : ''}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-white font-semibold">{doc.name}</p>
                                            {doc.specialty && <p className="text-gray-400 text-xs">{doc.specialty}</p>}
                                        </div>
                                        <div className="text-right">
                                            {doc.is_full ? (
                                                <span className="text-red-400 text-xs font-bold">FULL</span>
                                            ) : doc.slots_remaining != null ? (
                                                <span className="text-green-400 text-xs">{doc.slots_remaining} slots</span>
                                            ) : null}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Single doctor display */}
                {clinicData?.doctors?.length === 1 && (
                    <p className="text-center text-gray-400 text-sm mb-4">
                        Doctor: <span className="text-white font-semibold">{selectedDoctor?.name}</span>
                        {selectedDoctor?.specialty && <span className="text-gray-500"> · {selectedDoctor.specialty}</span>}
                    </p>
                )}

                {/* No doctors available */}
                {clinicData?.doctors?.length === 0 && (
                    <div className="glass rounded-2xl p-6 text-center mb-4">
                        <p className="text-yellow-400">No doctors available at this clinic</p>
                    </div>
                )}

                {/* Threshold Status Banner */}
                {selectedDoctor && thresholdInfo && (
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
                        disabled={loading || isFull || isClosed || !selectedDoctor}
                        className="w-full py-4 rounded-xl font-black text-white text-base tracking-wide transition-all disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #27AE60, #1E8449)', boxShadow: '0 6px 0 rgba(0,0,0,0.3)' }}
                    >
                        {loading ? 'Getting Your Ticket...' : !selectedDoctor ? 'Select a Doctor' : isFull ? 'Queue Full' : isClosed ? 'Session Closed' : '🎫 Get My Ticket'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default QueueJoin;
