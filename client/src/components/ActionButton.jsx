import { useState, useRef, useCallback } from 'react';

const HOLD_MS = 1500;

const sizeMap = {
    sm: 'w-16 h-16 text-xs',
    md: 'w-20 h-20 text-sm',
    lg: 'w-24 h-24 text-sm sm:w-28 sm:h-28 sm:text-base',
};

const ActionButton = ({
    label,
    icon,
    color,
    textColor = '#FFFFFF',
    onTap,
    onHoldConfirm,
    disabled = false,
    size = 'lg',
    pulse = false,
}) => {
    const [holdProgress, setHoldProgress] = useState(0);
    const [isPressed, setIsPressed] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);
    const progressRef = useRef(null);

    const handleTap = useCallback(() => {
        if (disabled || onHoldConfirm) return;
        if (navigator.vibrate) navigator.vibrate(50);
        onTap?.();
    }, [disabled, onTap, onHoldConfirm]);

    const startHold = useCallback((e) => {
        e.preventDefault();
        if (!onHoldConfirm || disabled) return;
        setIsPressed(true);
        const startTime = Date.now();

        progressRef.current = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min((elapsed / HOLD_MS) * 100, 100);
            setHoldProgress(progress);

            if (elapsed >= HOLD_MS) {
                clearInterval(progressRef.current);
                setIsCompleted(true);
                setHoldProgress(0);
                setIsPressed(false);
                if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                setTimeout(() => setIsCompleted(false), 600);
                onHoldConfirm();
            }
        }, 16);
    }, [onHoldConfirm, disabled]);

    const cancelHold = useCallback(() => {
        clearInterval(progressRef.current);
        setHoldProgress(0);
        setIsPressed(false);
    }, []);

    return (
        <button
            className={`
        relative flex flex-col items-center justify-center gap-1
        rounded-2xl font-bold select-none cursor-pointer
        transition-all duration-75 btn-3d
        ${sizeMap[size]}
        ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
        ${pulse ? 'emergency-pulse' : ''}
        ${isCompleted ? 'scale-110' : ''}
      `}
            style={{
                backgroundColor: disabled ? '#374151' : color,
                color: textColor,
                boxShadow: isPressed
                    ? '0 2px 0 rgba(0,0,0,0.4)'
                    : '0 6px 0 rgba(0,0,0,0.4)',
                transform: isPressed ? 'translateY(4px)' : 'translateY(0)',
            }}
            onPointerDown={onHoldConfirm ? startHold : undefined}
            onPointerUp={onHoldConfirm ? cancelHold : undefined}
            onPointerLeave={onHoldConfirm ? cancelHold : undefined}
            onPointerCancel={onHoldConfirm ? cancelHold : undefined}
            onClick={onTap && !onHoldConfirm ? handleTap : undefined}
            disabled={disabled}
            aria-label={label}
        >
            {/* Hold progress ring */}
            {onHoldConfirm && holdProgress > 0 && (
                <div
                    className="absolute inset-0 rounded-2xl"
                    style={{
                        background: `conic-gradient(rgba(255,255,255,0.5) ${holdProgress * 3.6}deg, transparent ${holdProgress * 3.6}deg)`,
                    }}
                />
            )}

            {/* Icon */}
            <span className="text-xl sm:text-2xl leading-none z-10 pointer-events-none" aria-hidden>
                {icon}
            </span>

            {/* Label */}
            <span className="text-center leading-tight z-10 px-1 pointer-events-none font-bold tracking-wide">
                {onHoldConfirm && holdProgress > 0
                    ? `${Math.round(holdProgress)}%`
                    : label}
            </span>
        </button>
    );
};

export default ActionButton;
