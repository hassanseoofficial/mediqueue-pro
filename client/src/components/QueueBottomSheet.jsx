import { useState } from 'react';

const STATUS_COLORS = {
    waiting: 'bg-slate-700 text-slate-200',
    called: 'bg-blue-600 text-white',
    present: 'bg-green-600 text-white',
    in_consultation: 'bg-emerald-500 text-white',
    penalized: 'bg-amber-600 text-white',
    no_show: 'bg-red-700 text-white',
    completed: 'bg-gray-600 text-gray-300',
    on_hold: 'bg-orange-600 text-white',
};

const QueueItem = ({ token, pos }) => {
    const statusClass = STATUS_COLORS[token.status] || 'bg-slate-700 text-slate-300';
    return (
        <div className={`flex items-center gap-3 px-4 py-3 border-b border-white/5 ${token.is_emergency ? 'bg-purple-900/30' : ''}`}>
            <span className="text-gray-500 text-xs w-5 text-center font-bold">{pos}</span>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">
                    {token.is_emergency && '⚡ '}{token.token_number}
                    {token.total_sub_patients > 1 && (
                        <span className="ml-1 text-xs text-blue-400">({token.total_sub_patients} pts)</span>
                    )}
                </p>
                <p className="text-xs text-gray-400 truncate">{token.patient_name}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${statusClass}`}>
                {token.status?.replace('_', ' ')}
            </span>
        </div>
    );
};

const QueueBottomSheet = ({ queue }) => {
    const [expanded, setExpanded] = useState(false);
    const activeQueue = queue.filter(t => !['completed', 'no_show'].includes(t.status));
    const waiting = activeQueue.filter(t => t.status === 'waiting');

    return (
        <div className={`fixed bottom-0 left-0 right-0 glass rounded-t-2xl transition-all duration-300 ${expanded ? 'h-[60vh]' : 'h-16'}`}
            style={{ zIndex: 40 }}>
            {/* Handle */}
            <button
                className="w-full flex flex-col items-center pt-2 pb-1 touch-none"
                onClick={() => setExpanded(e => !e)}
                aria-label="Toggle queue list"
            >
                <div className="w-10 h-1 rounded-full bg-gray-600 mb-1" />
                <p className="text-xs text-gray-400 font-medium">
                    {expanded ? 'Hide' : 'Queue'}
                    <span className="ml-2 bg-blue-700 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                        {waiting.length} waiting
                    </span>
                </p>
            </button>

            {/* Queue list */}
            {expanded && (
                <div className="overflow-y-auto h-full pb-4">
                    {activeQueue.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">Queue is empty</p>
                    ) : (
                        activeQueue.map((token, i) => (
                            <QueueItem key={token.id} token={token} pos={i + 1} />
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default QueueBottomSheet;
