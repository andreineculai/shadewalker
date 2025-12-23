import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import clsx from 'clsx';

interface TimeScrubberProps {
    currentTime: string; // HH:MM format
    onTimeChange: (time: string) => void;
    isPlaying?: boolean;
    onPlayToggle?: (playing: boolean) => void;
}

export const TimeScrubber: React.FC<TimeScrubberProps> = ({
    currentTime,
    onTimeChange,
    isPlaying = false,
    onPlayToggle
}) => {
    const [internalTime, setInternalTime] = useState(() => {
        const [h, m] = currentTime.split(':').map(Number);
        return h * 60 + m; // Convert to minutes since midnight
    });
    const [playing, setPlaying] = useState(isPlaying);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sync external time changes
    useEffect(() => {
        const [h, m] = currentTime.split(':').map(Number);
        setInternalTime(h * 60 + m);
    }, [currentTime]);

    // Animation loop
    useEffect(() => {
        if (playing) {
            intervalRef.current = setInterval(() => {
                setInternalTime(prev => {
                    const next = prev + 15; // Advance 15 minutes per tick
                    if (next >= 21 * 60) { // Stop at 21:00
                        setPlaying(false);
                        onPlayToggle?.(false);
                        return 6 * 60; // Reset to 6:00
                    }
                    return next;
                });
            }, 500); // 500ms per step
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [playing, onPlayToggle]);

    // Emit time changes
    useEffect(() => {
        const hours = Math.floor(internalTime / 60);
        const minutes = internalTime % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        onTimeChange(timeStr);
    }, [internalTime, onTimeChange]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value, 10);
        setInternalTime(value);
        if (playing) {
            setPlaying(false);
            onPlayToggle?.(false);
        }
    };

    const togglePlay = () => {
        const newPlaying = !playing;
        setPlaying(newPlaying);
        onPlayToggle?.(newPlaying);
        if (newPlaying && internalTime >= 21 * 60) {
            setInternalTime(6 * 60); // Reset if at end
        }
    };

    const reset = () => {
        setPlaying(false);
        onPlayToggle?.(false);
        setInternalTime(12 * 60); // Reset to noon
    };

    const formatTime = (minutes: number) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
        return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
    };

    // Calculate sun arc position (simple visual representation)
    const progress = (internalTime - 6 * 60) / (15 * 60); // 6 AM to 9 PM = 15 hours
    const sunX = progress * 100;

    return (
        <div className="bg-gradient-to-r from-sky-50 to-amber-50 rounded-xl border border-sky-200 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Clock size={14} className="text-sky-600" />
                    <span className="text-xs font-bold text-sky-700 uppercase tracking-wider">
                        Time Simulator
                    </span>
                </div>
                <span className="text-sm font-mono font-bold text-sky-900">
                    {formatTime(internalTime)}
                </span>
            </div>

            {/* Sun arc visualization */}
            <div className="relative h-8 mb-2 overflow-hidden">
                <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-sky-100 to-transparent rounded-t-full" />
                <div
                    className="absolute bottom-1 w-6 h-6 -translate-x-1/2 transition-all duration-300"
                    style={{ left: `${Math.max(5, Math.min(95, sunX))}%` }}
                >
                    <div className="w-full h-full bg-amber-400 rounded-full shadow-lg shadow-amber-300/50 flex items-center justify-center">
                        <div className="w-4 h-4 bg-yellow-300 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Slider */}
            <input
                type="range"
                min={6 * 60}  // 6 AM
                max={21 * 60} // 9 PM
                step={15}     // 15 minute increments
                value={internalTime}
                onChange={handleSliderChange}
                className="w-full h-2 bg-sky-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
            />

            {/* Time labels */}
            <div className="flex justify-between text-[10px] text-sky-500 mt-1 px-1">
                <span>6 AM</span>
                <span>12 PM</span>
                <span>9 PM</span>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 mt-3">
                <button
                    onClick={togglePlay}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                        playing
                            ? "bg-sky-600 text-white"
                            : "bg-white text-sky-600 border border-sky-200 hover:bg-sky-50"
                    )}
                >
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                    {playing ? 'Pause' : 'Animate Day'}
                </button>
                <button
                    onClick={reset}
                    className="p-2 bg-white text-sky-600 border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors"
                    title="Reset to noon"
                >
                    <RotateCcw size={14} />
                </button>
            </div>
        </div>
    );
};
