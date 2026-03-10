import { ElapsedTimer } from './ElapsedTimer';

const NowServingCard = ({ token }) => (
    <div className="mx-3 mb-2 rounded-2xl p-4 shadow-xl"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d1b69 100%)', border: '1px solid rgba(99,102,241,0.3)' }}>
        <p className="text-xs uppercase tracking-widest text-blue-400 mb-2 font-semibold">
            🩺 Now Serving
        </p>
        {token ? (
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-5xl font-black tracking-tight text-white leading-none mb-1">
                        {token.is_emergency ? '⚡ EMG' : token.token_number}
                    </p>
                    <p className="text-base text-blue-200 font-medium">
                        {token.patient_name}
                        {token.total_sub_patients > 1 && (
                            <span className="ml-2 text-xs bg-blue-700 px-2 py-0.5 rounded-full">
                                {token.total_sub_patients} patients
                            </span>
                        )}
                    </p>
                    <p className="text-xs text-blue-400 mt-1 capitalize">
                        Status: <span className="font-semibold text-blue-200">{token.status?.replace('_', ' ')}</span>
                    </p>
                </div>
                <ElapsedTimer startTime={token.called_at} />
            </div>
        ) : (
            <p className="text-3xl font-black text-slate-500">—</p>
        )}
    </div>
);

export default NowServingCard;
