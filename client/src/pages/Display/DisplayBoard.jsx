import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { queueApi } from '../../hooks/useQueueActions';
import { useDisplaySocket } from '../../hooks/useQueueSocket';

const DisplayBoard = () => {
    const { clinicId: clinicIdParam, doctorId: doctorIdParam } = useParams();
    const [data, setData] = useState(null);
    const [emergencyActive, setEmergencyActive] = useState(false);
    const [clinicInfo, setClinicInfo] = useState(null);
    const [doctorInfo, setDoctorInfo] = useState(null);

    // Determine if clinicIdParam is a slug (non-numeric) or ID
    const isSlug = clinicIdParam && isNaN(Number(clinicIdParam));
    const [resolvedClinicId, setResolvedClinicId] = useState(isSlug ? null : (clinicIdParam || '1'));
    const [resolvedDoctorId, setResolvedDoctorId] = useState(doctorIdParam || '1');

    // Resolve slug to clinic ID and fetch info
    useEffect(() => {
        if (isSlug && clinicIdParam) {
            queueApi.clinicBySlug(clinicIdParam)
                .then(res => {
                    setClinicInfo(res.data.clinic);
                    setResolvedClinicId(res.data.clinic.id);
                    // If doctorIdParam provided, find that doctor
                    const doctor = res.data.doctors?.find(d => String(d.id) === doctorIdParam) || res.data.doctors?.[0];
                    if (doctor) {
                        setDoctorInfo(doctor);
                        setResolvedDoctorId(doctor.id);
                    }
                })
                .catch(() => {});
        }
    }, [clinicIdParam, doctorIdParam, isSlug]);

    const fetchDisplay = useCallback(async () => {
        if (!resolvedClinicId || !resolvedDoctorId) return;
        try {
            const res = await queueApi.display(resolvedClinicId, resolvedDoctorId);
            setData(res.data);
        } catch { }
    }, [resolvedClinicId, resolvedDoctorId]);

    useEffect(() => {
        fetchDisplay();
        const interval = setInterval(fetchDisplay, 15000); // polling fallback
        return () => clearInterval(interval);
    }, [fetchDisplay]);

    useDisplaySocket(resolvedClinicId, resolvedDoctorId, (update) => {
        fetchDisplay();
        if (update?.is_emergency) {
            setEmergencyActive(true);
            setTimeout(() => setEmergencyActive(false), 5000);
            // Audio announcement
            if ('speechSynthesis' in window) {
                const utt = new SpeechSynthesisUtterance('Emergency! Emergency patient has been called.');
                utt.lang = 'en-US';
                window.speechSynthesis.speak(utt);
            }
        } else if (update?.token_number) {
            if ('speechSynthesis' in window) {
                const utt = new SpeechSynthesisUtterance(`Token ${update.token_number}. Please proceed to the counter.`);
                utt.lang = 'en-US';
                window.speechSynthesis.speak(utt);
            }
        }
    });

    const current = data?.current;
    const last3 = data?.last_3 || [];
    const remaining = data?.threshold_remaining;

    return (
        <div className="min-h-screen flex flex-col" style={{ background: '#050510', fontFamily: 'Inter, sans-serif' }}>
            {/* Emergency Banner */}
            {emergencyActive && (
                <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
                    <div className="text-center animate-pulse">
                        <p className="text-8xl font-black text-red-500 tracking-tight">⚡ EMERGENCY</p>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-10 py-6 border-b border-white/5">
                <div>
                    <p className="text-white/40 text-sm uppercase tracking-widest">{clinicInfo?.name || 'Clinic'}</p>
                    <p className="text-white font-bold text-lg">Queue Display — {doctorInfo?.name || 'Doctor'}</p>
                </div>
                <div className="text-right">
                    <p className="text-white/40 text-xs uppercase tracking-widest">Slots Remaining</p>
                    <p className="text-white font-black text-3xl">{remaining ?? '—'}</p>
                </div>
            </div>

            {/* NOW SERVING */}
            <div className="flex-1 flex flex-col items-center justify-center px-10 py-8">
                <p className="text-white/30 text-xl uppercase tracking-[0.5em] mb-4 font-semibold">Now Serving</p>

                {current ? (
                    <div className={`text-center ${current.is_emergency ? 'emergency-pulse' : ''}`}>
                        <p className="font-black text-white leading-none mb-4"
                            style={{ fontSize: 'clamp(80px, 20vw, 200px)', lineHeight: '1', color: current.is_emergency ? '#e74c3c' : '#fff' }}>
                            {current.is_emergency ? '⚡' : ''}{current.token_number}
                        </p>
                        <p className="text-white/60 font-semibold text-3xl mb-2">{current.patient_name}</p>
                        {current.total_sub_patients > 1 && (
                            <div className="inline-flex items-center gap-2 bg-blue-900/50 border border-blue-700 rounded-full px-5 py-2">
                                <span className="text-blue-300 font-bold">{current.total_sub_patients} patients</span>
                                {current.sub_patients?.map(sp => (
                                    <span key={sp.id} className="text-blue-400 text-sm">· {sp.name}</span>
                                ))}
                            </div>
                        )}
                        {current.is_emergency && (
                            <div className="mt-4 inline-flex items-center gap-2 bg-red-900/60 border border-red-600 rounded-full px-6 py-2">
                                <span className="text-red-300 font-black text-xl animate-pulse">EMERGENCY</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-white/20 font-black" style={{ fontSize: 'clamp(60px, 15vw, 140px)' }}>—</p>
                )}
            </div>

            {/* Recently Called */}
            {last3.length > 0 && (
                <div className="border-t border-white/5 px-10 py-6">
                    <p className="text-white/30 text-xs uppercase tracking-widest mb-4 font-semibold">Recently Called</p>
                    <div className="flex gap-6">
                        {last3.map((t, i) => (
                            <div key={i} className="glass rounded-xl px-5 py-3 text-center">
                                <p className="text-2xl font-black text-white/70">{t.token_number}</p>
                                <p className="text-white/40 text-xs mt-0.5 truncate max-w-[100px]">{t.patient_name}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="px-10 py-4 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <p className="text-white/30 text-xs">Live Queue · MediQueue Pro</p>
                </div>
                <p className="text-white/20 text-xs">{new Date().toLocaleDateString()}</p>
            </div>
        </div>
    );
};

export default DisplayBoard;
