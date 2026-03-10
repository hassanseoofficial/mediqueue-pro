const ThresholdMeter = ({ threshold }) => {
    if (!threshold) return null;
    const { used = 0, max = 30, remaining = 30 } = threshold;
    const pct = Math.min(Math.round((used / max) * 100), 100);
    const color = pct < 70 ? '#27AE60' : pct < 90 ? '#E67E22' : '#C0392B';
    const label = pct >= 100 ? '🔴 FULL' : `${remaining} left`;

    return (
        <div className="mx-3 mb-2 px-4 py-3 rounded-xl glass">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                <span className="font-medium">Capacity: {used} / {max}</span>
                <span className="font-bold" style={{ color }}>{label}</span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
                <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                />
            </div>
        </div>
    );
};

export default ThresholdMeter;
