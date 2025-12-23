import React from 'react';
import { RouteOption } from '../types';
import { ShadeChart } from './ShadeChart';
import { Sun, CloudSun, Cloud, ArrowRight, Navigation, ThermometerSun } from 'lucide-react';
import clsx from 'clsx';

interface RouteListProps {
  routes: RouteOption[];
  selectedRouteId?: string;
  onRouteSelect?: (routeId: string, routeIndex: number) => void;
}

export const RouteList: React.FC<RouteListProps> = ({ routes, selectedRouteId: controlledSelectedId, onRouteSelect }) => {
  // Use controlled selection if provided, otherwise fallback to first route
  const selectedRouteId = controlledSelectedId || routes[0]?.id;

  const selectedRoute = routes.find(r => r.id === selectedRouteId);

  const getShadeIcon = (percentage: number) => {
    if (percentage > 70) return <Cloud className="text-blue-600" />;
    if (percentage > 40) return <CloudSun className="text-blue-400" />;
    return <Sun className="text-orange-500" />;
  };

  const getShadeColor = (percentage: number) => {
    if (percentage > 70) return 'text-blue-600 bg-blue-50 border-blue-100';
    if (percentage > 40) return 'text-blue-500 bg-blue-50 border-blue-100';
    return 'text-orange-500 bg-orange-50 border-orange-100';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* List of Options */}
      <div className="lg:col-span-4 space-y-4">
        <h3 className="text-lg font-bold text-slate-800">Suggested Routes</h3>
        {routes.map((route, index) => (
          <div
            key={route.id}
            onClick={() => onRouteSelect?.(route.id, index)}
            className={clsx(
              "cursor-pointer rounded-xl p-4 border transition-all duration-200",
              selectedRouteId === route.id
                ? "border-blue-500 ring-1 ring-blue-500 bg-white shadow-md"
                : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-semibold text-slate-800">{route.name}</h4>
              <span className={clsx("text-xs font-bold px-2 py-1 rounded-full border", getShadeColor(route.averageShadePercentage))}>
                {route.averageShadePercentage}% Shade
              </span>
            </div>
            <p className="text-sm text-slate-500 line-clamp-2 mb-3">{route.summary}</p>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1">
                <Navigation size={12} />
                {route.totalDistance}
              </span>
              <span className="flex items-center gap-1">
                <ArrowRight size={12} />
                {route.totalDuration}
              </span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mt-3">
              {route.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Details View */}
      <div className="lg:col-span-8">
        {selectedRoute && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 pb-6 border-b border-slate-100">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{selectedRoute.name}</h2>
                <p className="text-slate-500 mt-1">{selectedRoute.summary}</p>
              </div>
              <div className="mt-4 md:mt-0 flex gap-4">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Duration</p>
                  <p className="text-xl font-bold text-slate-800">{selectedRoute.totalDuration}</p>
                </div>
                <div className="text-center pl-4 border-l border-slate-100">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Distance</p>
                  <p className="text-xl font-bold text-slate-800">{selectedRoute.totalDistance}</p>
                </div>
                <div className="text-center pl-4 border-l border-slate-100">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Shade Score</p>
                  <div className="flex items-center gap-1 justify-center">
                    {getShadeIcon(selectedRoute.averageShadePercentage)}
                    <p className={clsx("text-xl font-bold", getShadeColor(selectedRoute.averageShadePercentage).split(' ')[0])}>
                      {selectedRoute.averageShadePercentage}%
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="mb-8">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Shade Comfort Level</h4>
              <div className="h-24 w-full">
                <ShadeChart data={selectedRoute.shadeProfile} color='#3b82f6' />
              </div>
              <p className="text-xs text-slate-400 mt-2 text-center italic">
                *Higher percentage means more shade (cooler).
              </p>
            </div>

            {/* Steps */}
            <div>
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Navigation size={18} className="text-blue-600" />
                Turn-by-Turn Guidance
              </h3>
              <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-4 before:w-0.5 before:bg-slate-100">
                {selectedRoute.steps.map((step, idx) => (
                  <div key={idx} className="relative pl-10">
                    {/* Timeline Dot */}
                    <div className={clsx(
                      "absolute left-2.5 top-1.5 w-3 h-3 -translate-x-1/2 rounded-full border-2 bg-white",
                      step.shadeQuality === 'shady' ? 'border-blue-500' :
                        step.shadeQuality === 'partial' ? 'border-blue-300' : 'border-orange-400'
                    )}></div>

                    <div className="flex justify-between items-start">
                      <p className="font-medium text-slate-800">{step.instruction}</p>
                      <span className="text-xs font-mono text-slate-400 whitespace-nowrap ml-4">{step.duration}</span>
                    </div>

                    <div className="mt-2 flex items-start gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="mt-0.5">
                        {step.shadeQuality === 'shady' && <Cloud size={16} className="text-blue-600" />}
                        {step.shadeQuality === 'partial' && <CloudSun size={16} className="text-blue-400" />}
                        {step.shadeQuality === 'sunny' && <Sun size={16} className="text-orange-500" />}
                      </div>
                      <div>
                        <p className="text-sm text-slate-600 font-medium">
                          {step.shadeQuality === 'shady' ? 'Shaded' : step.shadeQuality === 'partial' ? 'Partially Shaded' : 'Exposed to Sun'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};