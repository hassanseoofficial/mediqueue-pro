import { useState, useEffect } from 'react';

export const ElapsedTimer = ({ startTime }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!startTime) return;
        const start = new Date(startTime).getTime();
        const update = () => setElapsed(Math.floor((Date.now() - start) / 1000));
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    if (!startTime) return null;
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    return (
        <div className="text-right">
            <p className="text-xs text-blue-400 uppercase tracking-widest mb-1">Elapsed</p>
            <p className="text-2xl font-black tabular-nums text-blue-200">
                {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </p>
        </div>
    );
};
