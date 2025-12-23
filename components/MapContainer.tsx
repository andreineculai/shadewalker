import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GoogleMap, DirectionsRenderer, Polyline, Marker, Polygon } from '@react-google-maps/api';
import { Coordinates, ShadeAnalysisDebug, ShadeFeature } from '../types';
import { Layers, Eye, EyeOff, Sun } from 'lucide-react';

const containerStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '1rem'
};

const defaultCenter = {
    lat: 47.1585, // Iași, Romania - homebase for testing
    lng: 27.6014
};

interface MapContainerProps {
    routes?: google.maps.DirectionsResult | null;
    selectedRouteIndex?: number;
    userLocation?: Coordinates;
    analyzedRoutes?: any[]; // RouteOption[]
    debugData?: ShadeAnalysisDebug | null;
    highlightedFeature?: ShadeFeature | null;
    selectedFeatureIds?: number[];
    onMapClick?: () => void; // Clear highlight when clicking map
    onUserLocationChange?: (location: Coordinates) => void; // Update user location
}

export const MapContainer: React.FC<MapContainerProps> = ({
    routes,
    selectedRouteIndex = 0,
    userLocation,
    analyzedRoutes,
    debugData,
    highlightedFeature,
    selectedFeatureIds,
    onMapClick,
    onUserLocationChange
}) => {
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [showShadeOverlay, setShowShadeOverlay] = useState(true);

    const onLoad = useCallback(function callback(map: google.maps.Map) {
        setMap(map);
    }, []);

    const onUnmount = useCallback(function callback(map: google.maps.Map) {
        setMap(null);
    }, []);

    // Update map center when user location changes
    useEffect(() => {
        if (map && userLocation) {
            map.panTo(userLocation);
            map.setZoom(15);
        }
    }, [map, userLocation]);

    // Pan to highlighted feature
    useEffect(() => {
        if (map && highlightedFeature && highlightedFeature.coordinates.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            highlightedFeature.coordinates.forEach(c => bounds.extend(c));
            map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
        }
    }, [map, highlightedFeature]);

    // Center map on selected route when it changes
    useEffect(() => {
        if (map && routes && routes.routes[selectedRouteIndex]) {
            const route = routes.routes[selectedRouteIndex];
            if (route.bounds) {
                map.fitBounds(route.bounds, { top: 50, bottom: 50, left: 50, right: 50 });
            }
        }
    }, [map, routes, selectedRouteIndex]);

    // Helpers for coloring
    const getSegmentColor = (shadeLevel: number) => {
        if (shadeLevel > 70) return '#2563eb'; // Blue 600
        if (shadeLevel < 30) return '#ea580c'; // Orange 600
        return '#ca8a04'; // Yellow 600
    };

    // Get color based on feature type
    const getFeatureColor = (type: ShadeFeature['type']) => {
        switch (type) {
            case 'building': return '#64748b'; // Slate
            case 'tree': return '#22c55e'; // Green
            case 'tree_row': return '#16a34a'; // Green-600
            case 'park': return '#10b981'; // Emerald
            case 'forest': return '#15803d'; // Green-700
            case 'covered': return '#8b5cf6'; // Violet
            default: return '#94a3b8';
        }
    };

    // Prepare polyline segments if we have analysis
    const renderPolylines = () => {
        if (!routes || !analyzedRoutes || !analyzedRoutes[selectedRouteIndex]) return null;

        const routeData = analyzedRoutes[selectedRouteIndex];
        const path = routes.routes[selectedRouteIndex].overview_path;
        const profile = routeData.shadeProfile;

        if (!profile || profile.length !== path.length) {
            // Fallback if mismatch
        }

        const segments = [];
        for (let i = 0; i < path.length - 1; i++) {
            const shade = profile && profile[i] ? profile[i].shadeLevel : 0;
            const color = getSegmentColor(shade);

            segments.push(
                <Polyline
                    key={`seg-${i}`}
                    path={[path[i], path[i + 1]]}
                    options={{
                        strokeColor: color,
                        strokeWeight: 6,
                        strokeOpacity: 0.9,
                        clickable: false,
                        geodesic: true
                    }}
                />
            );
        }
        return segments;
    };

    // Render shadow polygons from debug data
    const renderShadowOverlay = useMemo(() => {
        if (!debugData || !showShadeOverlay) return null;

        const components = [];

        // 1. Render Base Shadows (Unified or Individual)
        if (debugData.unifiedShadows && debugData.unifiedShadows.length > 0) {
            components.push(...debugData.unifiedShadows.map((poly, idx) => (
                <Polygon
                    key={`unified-shadow-${idx}`}
                    paths={poly}
                    options={{
                        fillColor: '#2563eb', // Blue-600
                        fillOpacity: 0.3,
                        strokeColor: '#1d4ed8',
                        strokeWeight: 0.5,
                        clickable: false,
                        zIndex: 20
                    }}
                />
            )));
        } else {
            // Fallback: Individual shadows
            components.push(...debugData.shadows.map((s, idx) => {
                if (!s.shadow) return null;
                return (
                    <Polygon
                        key={`shadow-${s.feature.id}-${idx}`}
                        paths={s.shadow.polygon}
                        options={{
                            fillColor: '#2563eb', // Blue
                            fillOpacity: s.shadow.opacity * 0.3,
                            strokeColor: '#1d4ed8',
                            strokeWeight: 0.5,
                            strokeOpacity: 0.2,
                            zIndex: 20,
                            clickable: false
                        }}
                    />
                );
            }));
        }

        // 2. Render Highlighted Feature Shadow (Ephemeral hover)
        if (highlightedFeature) {
            const shadowEntry = debugData.shadows.find(s => s.feature.id === highlightedFeature.id);
            if (shadowEntry && shadowEntry.shadow) {
                components.push(
                    <Polygon
                        key={`highlight-shadow-${highlightedFeature.id}`}
                        paths={shadowEntry.shadow.polygon}
                        options={{
                            fillColor: '#f97316', // Orange-500
                            fillOpacity: 0.6,
                            strokeColor: '#ea580c',
                            strokeWeight: 2,
                            clickable: false,
                            zIndex: 100
                        }}
                    />
                );
            }
        }

        // 3. Render Selected Features Shadows (Persistent selection)
        if (selectedFeatureIds && selectedFeatureIds.length > 0) {
            components.push(...debugData.shadows
                .filter(s => selectedFeatureIds.includes(s.feature.id))
                .map((s, idx) => {
                    if (!s.shadow) return null;
                    return (
                        <Polygon
                            key={`selected-shadow-${s.feature.id}-${idx}`}
                            paths={s.shadow.polygon}
                            options={{
                                fillColor: '#f97316', // Orange-500
                                fillOpacity: 0.6,
                                strokeColor: '#ea580c',
                                strokeWeight: 2,
                                clickable: false,
                                zIndex: 110
                            }}
                        />
                    );
                }));
        }

        return components;
    }, [debugData, showShadeOverlay, highlightedFeature, selectedFeatureIds]);

    // Render highlighted feature footprint
    const renderHighlightedFeature = useMemo(() => {
        if (!highlightedFeature) return null;

        return (
            <Polygon
                paths={highlightedFeature.coordinates}
                options={{
                    fillColor: getFeatureColor(highlightedFeature.type),
                    fillOpacity: 0.4,
                    strokeColor: '#facc15', // Yellow-400
                    strokeWeight: 3,
                    strokeOpacity: 1,
                    zIndex: 150,
                    clickable: false
                }}
            />
        );
    }, [highlightedFeature]);

    // Sun position overlay - fixed position compass style
    const renderSunOverlay = useMemo(() => {
        if (!debugData || debugData.sunPosition.altitude <= 0) return null;

        const { azimuthDeg, altitudeDeg } = debugData.sunPosition;
        // Convert SunCalc azimuth (0=South, increases clockwise) to compass bearing (0=North)
        // SunCalc: 0=S, 90=W, 180=N, -90=E
        // We want arrow to point FROM the sun direction, so add 180 for shadow direction
        const compassBearing = (azimuthDeg + 180) % 360;

        return (
            <div
                className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-3 z-[50] flex items-center gap-3"
                title="Sun direction indicator"
            >
                {/* Compass with arrow */}
                <div className="relative w-12 h-12">
                    {/* Outer ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100" />

                    {/* Cardinal directions */}
                    <span className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-500">N</span>
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-slate-400">S</span>
                    <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">W</span>
                    <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">E</span>

                    {/* Sun direction arrow */}
                    <div
                        className="absolute inset-2 flex items-center justify-center"
                        style={{ transform: `rotate(${compassBearing}deg)` }}
                    >
                        <div className="w-0.5 h-4 bg-gradient-to-t from-amber-500 to-amber-300 rounded-full origin-bottom" />
                        <svg
                            className="absolute -top-0.5 w-3 h-3 text-amber-500"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                        >
                            <circle cx="12" cy="12" r="6" />
                        </svg>
                    </div>
                </div>

                {/* Text info */}
                <div className="text-xs">
                    <div className="flex items-center gap-1 text-amber-600 font-semibold">
                        <Sun size={12} />
                        <span>Sun</span>
                    </div>
                    <div className="text-slate-500 mt-0.5">
                        {altitudeDeg.toFixed(0)}° altitude
                    </div>
                </div>
            </div>
        );
    }, [debugData]);

    return (
        <div className="relative w-full h-full">
            {renderSunOverlay}
            <GoogleMap
                mapContainerStyle={containerStyle}
                center={userLocation || defaultCenter}
                zoom={14}
                onLoad={onLoad}
                onUnmount={onUnmount}
                onClick={onMapClick}
                options={{
                    mapTypeControl: false,
                    streetViewControl: false,
                    fullscreenControl: false,
                    zoomControl: true,
                    styles: [
                        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] }
                    ]
                }}
            >
                {/* Shadow Overlay (rendered first, below routes) */}
                {renderShadowOverlay}

                {/* Highlighted Feature Footprint */}
                {renderHighlightedFeature}

                {/* Sun Position is now rendered as overlay outside GoogleMap */}

                {/* Render ALL routes */}
                {routes && routes.routes.map((_, index) => {
                    const isSelected = index === selectedRouteIndex;
                    const routeKey = `route-${index}`;

                    return (
                        <React.Fragment key={routeKey}>
                            <DirectionsRenderer
                                directions={routes}
                                routeIndex={index}
                                options={{
                                    suppressPolylines: isSelected && analyzedRoutes && analyzedRoutes[index] ? true : false,
                                    suppressMarkers: !isSelected,
                                    preserveViewport: true,
                                    polylineOptions: {
                                        strokeColor: isSelected ? '#2563eb' : '#94a3b8',
                                        strokeWeight: isSelected ? 6 : 5,
                                        strokeOpacity: isSelected ? 0.8 : 0.4,
                                        zIndex: isSelected ? 50 : 10
                                    }
                                }}
                            />
                            {isSelected && analyzedRoutes && analyzedRoutes[index] && renderPolylines()}
                        </React.Fragment>
                    );
                })}

                {userLocation && (
                    <Marker
                        position={userLocation}
                        icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 8,
                            fillColor: "#3b82f6",
                            fillOpacity: 1,
                            strokeColor: "white",
                            strokeWeight: 2,
                        }}
                    />
                )}

                {/* Overlay Toggle Button */}
                {debugData && (
                    <button
                        onClick={() => setShowShadeOverlay(!showShadeOverlay)}
                        className={`absolute top-4 right-4 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg transition-all z-[50] cursor-pointer text-sm font-medium ${showShadeOverlay
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                        title={showShadeOverlay ? "Hide shade overlay" : "Show shade overlay"}
                        type="button"
                    >
                        {showShadeOverlay ? <Eye size={16} /> : <EyeOff size={16} />}
                        <Layers size={16} />
                    </button>
                )}

                {/* Locate Me Button */}
                <button
                    onClick={() => {
                        if (userLocation && map) {
                            map.panTo(userLocation);
                            map.setZoom(16);
                        } else if (navigator.geolocation && map) {
                            navigator.geolocation.getCurrentPosition((position) => {
                                const pos = {
                                    lat: position.coords.latitude,
                                    lng: position.coords.longitude,
                                };
                                map.panTo(pos);
                                map.setZoom(16);
                                // Update parent state so marker appears
                                onUserLocationChange?.(pos);
                            }, () => {
                                console.error("Error getting location");
                            });
                        }
                    }}
                    className="absolute top-20 right-4 bg-white p-3 rounded-full shadow-md text-slate-600 hover:text-blue-600 transition-colors z-[50] cursor-pointer"
                    title="Pan to my location"
                    type="button"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
                </button>
            </GoogleMap>
        </div>
    );
};
