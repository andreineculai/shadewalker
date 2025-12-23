import React, { useState } from 'react';
import { ShadeAnalysisDebug, ShadeFeature } from '../types';
import { Bug, X, ChevronDown, ChevronRight, Building2, TreePine, Trees, Flower2, Tent, MapPin, Sun, Search, CheckSquare, Square } from 'lucide-react';
import clsx from 'clsx';

interface DebugPanelProps {
    debug: ShadeAnalysisDebug | null;
    onClose: () => void;
    onFeatureHover?: (feature: ShadeFeature | null) => void;
    onFeatureClick?: (feature: ShadeFeature) => void;
    highlightedFeatureId?: number;
    selectedFeatureIds?: number[];
    onSelectionChange?: (ids: number[]) => void;
}

const FeatureTypeIcon = ({ type }: { type: ShadeFeature['type'] }) => {
    switch (type) {
        case 'building': return <Building2 size={14} className="text-slate-600" />;
        case 'tree': return <TreePine size={14} className="text-green-600" />;
        case 'tree_row': return <Trees size={14} className="text-green-500" />;
        case 'park': return <Flower2 size={14} className="text-emerald-500" />;
        case 'forest': return <Trees size={14} className="text-green-700" />;
        case 'covered': return <Tent size={14} className="text-purple-500" />;
        default: return <MapPin size={14} />;
    }
};

const FeatureTypeLabel = ({ type }: { type: ShadeFeature['type'] }) => {
    const labels: Record<ShadeFeature['type'], string> = {
        building: 'Buildings',
        tree: 'Trees',
        tree_row: 'Tree Rows',
        park: 'Parks & Gardens',
        forest: 'Forests & Woods',
        covered: 'Covered Paths'
    };
    return <span>{labels[type] || type}</span>;
};

export const DebugPanel: React.FC<DebugPanelProps> = ({
    debug,
    onClose,
    onFeatureHover,
    onFeatureClick,
    highlightedFeatureId,
    selectedFeatureIds = [],
    onSelectionChange
}) => {
    const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set(['building']));
    const [searchQuery, setSearchQuery] = useState('');

    if (!debug) return null;

    const toggleType = (type: string) => {
        const newExpanded = new Set(expandedTypes);
        if (newExpanded.has(type)) {
            newExpanded.delete(type);
        } else {
            newExpanded.add(type);
        }
        setExpandedTypes(newExpanded);
    };

    const toggleSelection = (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onSelectionChange) return;

        const newSelection = selectedFeatureIds.includes(id)
            ? selectedFeatureIds.filter(sid => sid !== id)
            : [...selectedFeatureIds, id];

        onSelectionChange(newSelection);
    };

    // Filter features based on search
    const filteredFeatures = debug.features.filter(f =>
        !searchQuery || f.name?.toLowerCase().includes(searchQuery.toLowerCase()) || f.id.toString().includes(searchQuery)
    );

    // Group features by type
    const featuresByType = filteredFeatures.reduce((acc, feature) => {
        if (!acc[feature.type]) acc[feature.type] = [];
        acc[feature.type].push(feature);
        return acc;
    }, {} as Record<string, ShadeFeature[]>);

    const typeOrder: ShadeFeature['type'][] = ['building', 'tree', 'tree_row', 'park', 'forest', 'covered'];

    return (
        <div className="fixed bottom-4 right-4 w-96 max-h-[70vh] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[100] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-2">
                    <div className="bg-amber-100 p-2 rounded-lg">
                        <Bug size={16} className="text-amber-600" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm">Shade Debug</h3>
                        <p className="text-[10px] text-slate-500">OSM Data Inspector</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                >
                    <X size={18} className="text-slate-400" />
                </button>
            </div>

            {/* Search Bar */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/50">
                <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search features..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-200 transaction-all"
                    />
                </div>
            </div>

            {/* Sun Position */}
            <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 border-b border-amber-100">
                <div className="flex items-center gap-2 mb-2">
                    <Sun size={14} className="text-orange-500" />
                    <span className="text-xs font-semibold text-orange-700">Sun Position</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/80 rounded-lg px-2 py-1">
                        <span className="text-slate-500">Azimuth:</span>
                        <span className="ml-1 font-mono text-slate-800">
                            {debug.sunPosition.azimuthDeg.toFixed(1)}°
                        </span>
                    </div>
                    <div className="bg-white/80 rounded-lg px-2 py-1">
                        <span className="text-slate-500">Altitude:</span>
                        <span className="ml-1 font-mono text-slate-800">
                            {debug.sunPosition.altitudeDeg.toFixed(1)}°
                        </span>
                    </div>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="p-3 bg-slate-50 border-b border-slate-100">
                <div className="text-xs font-semibold text-slate-600 mb-2">Features Found</div>
                <div className="flex flex-wrap gap-1">
                    {typeOrder.map(type => {
                        const count = featuresByType[type]?.length || 0;
                        if (count === 0) return null;
                        return (
                            <span
                                key={type}
                                className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-md text-xs border border-slate-200"
                            >
                                <FeatureTypeIcon type={type} />
                                <span className="font-medium">{count}</span>
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Feature List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {typeOrder.map(type => {
                    const features = featuresByType[type];
                    if (!features || features.length === 0) return null;

                    const isExpanded = expandedTypes.has(type);

                    return (
                        <div key={type} className="border border-slate-100 rounded-lg overflow-hidden">
                            <button
                                onClick={() => toggleType(type)}
                                className="w-full flex items-center justify-between p-2 hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <FeatureTypeIcon type={type} />
                                    <span className="text-xs font-medium text-slate-700">
                                        <FeatureTypeLabel type={type} />
                                    </span>
                                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                        {features.length}
                                    </span>
                                </div>
                                {isExpanded ? (
                                    <ChevronDown size={14} className="text-slate-400" />
                                ) : (
                                    <ChevronRight size={14} className="text-slate-400" />
                                )}
                            </button>

                            {isExpanded && (
                                <div className="border-t border-slate-100 max-h-40 overflow-y-auto">
                                    {features.slice(0, 50).map(feature => {
                                        const isHighlighted = highlightedFeatureId === feature.id; // From map click
                                        const isSelected = selectedFeatureIds.includes(feature.id); // From checkbox

                                        return (
                                            <div
                                                key={feature.id}
                                                className={clsx(
                                                    "flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs border-b border-slate-50 last:border-0 transition-colors group",
                                                    isHighlighted || isSelected
                                                        ? "bg-amber-50"
                                                        : "hover:bg-blue-50"
                                                )}
                                                onClick={() => onFeatureClick?.(feature)}
                                                onMouseEnter={() => onFeatureHover?.(feature)}
                                                onMouseLeave={() => onFeatureHover?.(null)}
                                            >
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <button
                                                        onClick={(e) => toggleSelection(feature.id, e)}
                                                        className="text-slate-400 hover:text-amber-500 transition-colors"
                                                    >
                                                        {isSelected ? (
                                                            <CheckSquare size={14} className="text-amber-600" />
                                                        ) : (
                                                            <Square size={14} />
                                                        )}
                                                    </button>
                                                    <span className={clsx(
                                                        "truncate max-w-[140px]",
                                                        isHighlighted ? "text-amber-800 font-medium" : "text-slate-600",
                                                        isSelected && "font-semibold text-slate-900"
                                                    )} title={feature.name}>
                                                        {feature.name || `#${feature.id}`}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <span title="Height">{feature.height.toFixed(0)}m</span>
                                                    <span title="Foliage Density" className="text-green-600">
                                                        {(feature.foliageDensity * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {features.length > 50 && (
                                        <div className="px-3 py-1.5 text-[10px] text-slate-400 text-center">
                                            ...and {features.length - 50} more
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Bounding Box Info */}
            <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                Bbox: {debug.bbox.south.toFixed(4)},{debug.bbox.west.toFixed(4)} to {debug.bbox.north.toFixed(4)},{debug.bbox.east.toFixed(4)}
            </div>
        </div>
    );
};
