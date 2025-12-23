import React from 'react';
import { Sun, Cloud as CloudIcon, CloudRain, Thermometer } from 'lucide-react';
import clsx from 'clsx';

interface WeatherControlsProps {
    cloudCoverage: number;
    onChange: (coverage: number) => void;
    debugMode?: boolean;
    useSummerDate?: boolean;
    onSummerToggle?: (enabled: boolean) => void;
}

export const WeatherControls: React.FC<WeatherControlsProps> = ({
    cloudCoverage,
    onChange,
    debugMode = false,
    useSummerDate = false,
    onSummerToggle
}) => {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4 shadow-sm">
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weather Conditions</span>
                <span className="text-xs font-medium text-slate-400">
                    {cloudCoverage < 30 ? 'Sunny' : cloudCoverage < 70 ? 'Partly Cloudy' : 'Overcast'}
                </span>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-lg gap-1">
                <button
                    onClick={() => onChange(0)}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all",
                        cloudCoverage < 30 ? "bg-white text-orange-600 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                    )}
                >
                    <Sun size={14} /> Sunny
                </button>
                <button
                    onClick={() => onChange(50)}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all",
                        cloudCoverage >= 30 && cloudCoverage < 70 ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                    )}
                >
                    <CloudIcon size={14} /> Partly
                </button>
                <button
                    onClick={() => onChange(100)}
                    className={clsx(
                        "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium transition-all",
                        cloudCoverage >= 70 ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:bg-slate-200"
                    )}
                >
                    <CloudRain size={14} /> Cloudy
                </button>
            </div>

            {/* July Mode Toggle (Debug only) */}
            {debugMode && onSummerToggle && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <button
                        onClick={() => onSummerToggle(!useSummerDate)}
                        className={clsx(
                            "w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all",
                            useSummerDate
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"
                        )}
                    >
                        <Thermometer size={14} />
                        {useSummerDate ? '☀️ July 20th Mode ON' : 'Enable July Mode'}
                    </button>
                    {useSummerDate && (
                        <p className="text-[10px] text-amber-600 text-center mt-1">
                            Simulating summer sun position (July 20th)
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};
