import { useState } from 'react';

const EmergencyModal = ({ open, onConfirm, onClose }) => {
    const [reason, setReason] = useState('');
    const [patientName, setPatientName] = useState('');

    if (!open) return null;

    const handleConfirm = () => {
        if (!reason.trim() || !patientName.trim()) return;
        onConfirm({ patient_name: patientName, reason });
        setReason('');
        setPatientName('');
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full sm:max-w-md glass rounded-t-3xl sm:rounded-2xl p-6 animate-scale-in"
                style={{ border: '1px solid rgba(124,60,152,0.5)' }}>
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center text-xl emergency-pulse">
                        ★
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white">Emergency Override</h2>
                        <p className="text-xs text-purple-300">Token will be inserted at position #1</p>
                    </div>
                </div>

                <div className="space-y-3 mb-5">
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">
                            Patient Name *
                        </label>
                        <input
                            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-purple-500 outline-none"
                            placeholder="Enter patient name"
                            value={patientName}
                            onChange={e => setPatientName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1 block">
                            Reason for Emergency *
                        </label>
                        <textarea
                            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm border border-gray-700 focus:border-purple-500 outline-none resize-none"
                            placeholder="Describe the emergency..."
                            rows={3}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 font-bold hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!reason.trim() || !patientName.trim()}
                        className="flex-1 py-3 rounded-xl font-black text-white transition-all disabled:opacity-40"
                        style={{ backgroundColor: '#7D3C98', boxShadow: '0 4px 0 rgba(0,0,0,0.3)' }}
                    >
                        CONFIRM EMERGENCY
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmergencyModal;
