import SunCalc from 'suncalc';
import { getDistance, getRhumbLineBearing, computeDestinationPoint } from 'geolib';
import { Coordinates } from '../types';
import * as turf from '@turf/helpers';
import union from '@turf/union';

// Types for shade-producing features
export type ShadeFeatureType = 'building' | 'tree' | 'tree_row' | 'park' | 'forest' | 'covered';

export interface ShadeFeature {
    id: number;
    type: ShadeFeatureType;
    coordinates: Coordinates[]; // Polygon or point approximation
    height: number;
    foliageDensity: number; // 0-1, affects shadow opacity
    name?: string; // For debug display
}

interface Shadow {
    polygon: Coordinates[];
    opacity: number; // 0-1 based on foliage density
}

export interface ShadeAnalysisDebug {
    features: ShadeFeature[];
    shadows: { feature: ShadeFeature; shadow: Shadow | null }[]; // Keep for individual lookup if needed
    unifiedShadows?: Coordinates[][]; // Merged polygons for cleaner display
    sunPosition: { azimuth: number; altitude: number; azimuthDeg: number; altitudeDeg: number };
    bbox: { north: number; south: number; east: number; west: number };
}

/**
 * Get seasonal foliage density based on month
 * Adjusted for Northern Hemisphere - user mentioned summer priority
 */
const getSeasonalFoliageDensity = (date: Date): number => {
    const month = date.getMonth(); // 0-11
    // Summer (June-August): Full foliage
    if (month >= 5 && month <= 7) return 1.0;
    // Late Spring / Early Fall (May, September): Nearly full
    if (month === 4 || month === 8) return 0.85;
    // Spring / Fall (April, October): Partial
    if (month === 3 || month === 9) return 0.6;
    // Late Fall / Early Spring (March, November): Sparse
    if (month === 2 || month === 10) return 0.3;
    // Winter (December-February): Minimal (evergreens only estimate)
    return 0.15;
};

/**
 * Calculates current sun position (azimuth/altitude)
 */
export const getSunPosition = (lat: number, lng: number, date: Date) => {
    const sunPos = SunCalc.getPosition(date, lat, lng);
    return {
        azimuth: sunPos.azimuth, // Radians (South = 0, West = PI/2) - Note: SunCalc uses 0=South
        altitude: sunPos.altitude,  // Radians
        azimuthDeg: (sunPos.azimuth * 180) / Math.PI,
        altitudeDeg: (sunPos.altitude * 180) / Math.PI
    };
};

/**
 * Fetches shade-producing features from Overpass API within a bounding box
 * Enhanced to include: buildings, trees, tree rows, parks, forests, covered walkways
 */
export const fetchShadeFeatures = async (
    boundingBox: { north: number; south: number; east: number; west: number },
    date: Date
): Promise<ShadeFeature[]> => {
    const seasonalDensity = getSeasonalFoliageDensity(date);

    // Comprehensive Overpass query for all shade-producing features
    const jsonQuery = `
        [out:json][timeout:30];
        (
          // Buildings
          way["building"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          relation["building"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          
          // Individual trees
          node["natural"="tree"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          
          // Tree rows (linear tree features)
          way["natural"="tree_row"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          
          // Parks and gardens (partial shade from scattered trees)
          way["leisure"="park"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          way["leisure"="garden"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          relation["leisure"="park"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          
          // Forests and woods (dense canopy)
          way["landuse"="forest"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          way["natural"="wood"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          relation["landuse"="forest"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          relation["natural"="wood"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
          
          // Covered walkways and arcades
          way["covered"="yes"]["highway"](${boundingBox.south},${boundingBox.west},${boundingBox.north},${boundingBox.east});
        );
        out body;
        >;
        out skel qt;
    `;

    try {
        const response = await fetch("https://overpass-api.de/api/interpreter", {
            method: "POST",
            body: jsonQuery
        });

        const data = await response.json();
        return parseOverpassData(data, seasonalDensity);
    } catch (e) {
        console.error("Failed to fetch shade features", e);
        return [];
    }
};

/**
 * Parses Overpass JSON into ShadeFeature objects
 */
const parseOverpassData = (data: any, seasonalDensity: number): ShadeFeature[] => {
    const features: ShadeFeature[] = [];
    const nodes: Record<number, { lat: number; lng: number }> = {};

    if (!data.elements) return features;

    // First pass: cache nodes
    data.elements.forEach((el: any) => {
        if (el.type === 'node') {
            nodes[el.id] = { lat: el.lat, lng: el.lon };

            // Handle individual trees
            if (el.tags?.natural === 'tree') {
                const r = 0.00003; // ~3-4 meters radius
                const treeHeight = el.tags.height ? parseFloat(el.tags.height) : 8;

                if (!isNaN(treeHeight)) {
                    features.push({
                        id: el.id,
                        type: 'tree',
                        height: treeHeight,
                        foliageDensity: seasonalDensity,
                        name: el.tags.name || `Tree #${el.id}`,
                        coordinates: [
                            { lat: el.lat + r, lng: el.lon + r },
                            { lat: el.lat - r, lng: el.lon + r },
                            { lat: el.lat - r, lng: el.lon - r },
                            { lat: el.lat + r, lng: el.lon - r }
                        ]
                    });
                }
            }
        }
    });

    // Second pass: process ways
    data.elements.forEach((el: any) => {
        if (el.type !== 'way' || !el.nodes) return;

        const coords = el.nodes.map((nid: number) => nodes[nid]).filter((n: any) => !!n);
        if (coords.length < 3) return;

        const tags = el.tags || {};

        // Determine feature type and properties
        if (tags.building) {
            // Building
            let height = 10; // Default ~3 stories
            if (tags.height) {
                const h = parseFloat(tags.height);
                if (!isNaN(h)) height = h;
            } else if (tags['building:levels']) {
                const l = parseFloat(tags['building:levels']);
                if (!isNaN(l)) height = l * 3.5;
            }

            features.push({
                id: el.id,
                type: 'building',
                coordinates: coords,
                height,
                foliageDensity: 1, // Buildings are solid
                name: tags.name || `Building #${el.id}`
            });
        } else if (tags.natural === 'tree_row') {
            // Tree row - linear feature, approximate as polygon
            const rowHeight = tags.height ? parseFloat(tags.height) : 10;
            const width = 0.00004; // ~4-5m width

            // Create polygon from line by buffering
            const bufferedCoords = bufferLineToPolygon(coords, width);

            features.push({
                id: el.id,
                type: 'tree_row',
                coordinates: bufferedCoords,
                height: isNaN(rowHeight) ? 10 : rowHeight,
                foliageDensity: seasonalDensity * 0.9, // Slightly less dense than forest
                name: tags.name || `Tree Row #${el.id}`
            });
        } else if (tags.leisure === 'park' || tags.leisure === 'garden') {
            // Parks - assume scattered trees, partial shade
            features.push({
                id: el.id,
                type: 'park',
                coordinates: coords,
                height: 8, // Average tree height in parks
                foliageDensity: seasonalDensity * 0.4, // Parks have gaps
                name: tags.name || `Park #${el.id}`
            });
        } else if (tags.landuse === 'forest' || tags.natural === 'wood') {
            // Forest/woodland - dense canopy
            features.push({
                id: el.id,
                type: 'forest',
                coordinates: coords,
                height: 15, // Taller mature trees
                foliageDensity: seasonalDensity * 0.85, // Dense but some gaps
                name: tags.name || `Forest #${el.id}`
            });
        } else if (tags.covered === 'yes' && tags.highway) {
            // Covered walkway
            const width = 0.00003;
            const bufferedCoords = bufferLineToPolygon(coords, width);

            features.push({
                id: el.id,
                type: 'covered',
                coordinates: bufferedCoords,
                height: 4, // Low overhead cover
                foliageDensity: 1, // Full coverage
                name: tags.name || `Covered Path #${el.id}`
            });
        }
    });

    return features;
};

/**
 * Buffer a line (array of points) into a polygon
 */
const bufferLineToPolygon = (line: { lat: number; lng: number }[], width: number): Coordinates[] => {
    if (line.length < 2) return line as Coordinates[];

    const left: Coordinates[] = [];
    const right: Coordinates[] = [];

    for (let i = 0; i < line.length; i++) {
        const curr = line[i];
        const prev = line[i - 1] || curr;
        const next = line[i + 1] || curr;

        // Calculate perpendicular direction
        const dx = next.lng - prev.lng;
        const dy = next.lat - prev.lat;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len * width;
        const ny = dx / len * width;

        left.push({ lat: curr.lat + nx, lng: curr.lng + ny });
        right.unshift({ lat: curr.lat - nx, lng: curr.lng - ny });
    }

    return [...left, ...right];
};

/**
 * Compute convex hull of a set of points using Graham scan algorithm
 */
const computeConvexHull = (points: Coordinates[]): Coordinates[] => {
    if (points.length < 3) return points;

    // Find the lowest point (and leftmost if tie)
    let lowest = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i].lat < points[lowest].lat ||
            (points[i].lat === points[lowest].lat && points[i].lng < points[lowest].lng)) {
            lowest = i;
        }
    }

    // Swap lowest to first position
    [points[0], points[lowest]] = [points[lowest], points[0]];
    const pivot = points[0];

    // Sort points by polar angle with respect to pivot
    const sorted = points.slice(1).sort((a, b) => {
        const angleA = Math.atan2(a.lat - pivot.lat, a.lng - pivot.lng);
        const angleB = Math.atan2(b.lat - pivot.lat, b.lng - pivot.lng);
        if (angleA !== angleB) return angleA - angleB;
        // If same angle, closer point first
        const distA = (a.lat - pivot.lat) ** 2 + (a.lng - pivot.lng) ** 2;
        const distB = (b.lat - pivot.lat) ** 2 + (b.lng - pivot.lng) ** 2;
        return distA - distB;
    });

    // Cross product to determine turn direction
    const cross = (o: Coordinates, a: Coordinates, b: Coordinates) =>
        (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);

    const hull: Coordinates[] = [pivot];
    for (const point of sorted) {
        while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
            hull.pop();
        }
        hull.push(point);
    }

    return hull;
};

/**
 * Projects a shadow polygon for a feature based on sun position
 * Creates a connected shadow from building base to projected shadow edge using convex hull
 */
const calculateFeatureShadow = (
    feature: ShadeFeature,
    sunAzimuth: number,
    sunAltitude: number
): Shadow | null => {
    if (sunAltitude <= 0) return null; // Night

    // Shadow length = height / tan(altitude)
    const shadowLength = feature.height / Math.tan(sunAltitude);

    // Convert SunCalc azimuth to compass bearing
    const azimuthDeg = (sunAzimuth * 180) / Math.PI;
    const sunBearing = (azimuthDeg + 180) % 360;
    const shadowBearing = (sunBearing + 180) % 360;

    // Project each vertex to create shadow tip points
    const projectedPoints: Coordinates[] = feature.coordinates.map(coord => {
        const dest = computeDestinationPoint(
            { latitude: coord.lat, longitude: coord.lng },
            shadowLength,
            shadowBearing
        );
        return { lat: dest.latitude, lng: dest.longitude };
    });

    // Combine original footprint with projected points and compute convex hull
    // This creates a continuous shadow polygon from base to tip
    const allPoints = [...feature.coordinates, ...projectedPoints];
    const shadowPolygon = computeConvexHull(allPoints);

    return {
        polygon: shadowPolygon,
        opacity: feature.foliageDensity
    };
};

/**
 * Helper: Check if point is inside a polygon (Ray Casting)
 */
const isPointInPolygon = (point: Coordinates, polygon: Coordinates[]) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].lat, yi = polygon[i].lng;
        const xj = polygon[j].lat, yj = polygon[j].lng;

        const intersect = ((yi > point.lng) !== (yj > point.lng))
            && (point.lat < (xj - xi) * (point.lng - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
};

/**
 * Helper: Convert Coordinates[] to Turf Polygon
 */
const toTurfPolygon = (coords: Coordinates[]) => {
    // GeoJSON uses [lng, lat]
    // Ensure ring is closed
    const ring = coords.map(c => [c.lng, c.lat]);
    if (ring.length > 0) {
        const first = ring[0];
        const last = ring[ring.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
            ring.push(first);
        }
    }
    return turf.polygon([ring]);
};

/**
 * Unifies multiple shadow polygons into a cleaner set of polygons
 * Updated for Turf 7.x which expects a FeatureCollection
 */
const unifyShadows = (shadows: { shadow: Shadow | null }[]): Coordinates[][] => {
    try {
        const polygons = shadows
            .filter(s => s.shadow && s.shadow.polygon.length > 2)
            .map(s => {
                const ring = s.shadow!.polygon.map(c => [c.lng, c.lat]);
                // Ensure ring is closed for GeoJSON
                if (ring.length > 0) {
                    const first = ring[0];
                    const last = ring[ring.length - 1];
                    if (first[0] !== last[0] || first[1] !== last[1]) {
                        ring.push([...first]);
                    }
                }
                return turf.polygon([ring]);
            });

        if (polygons.length === 0) return [];
        if (polygons.length === 1) {
            const geom = polygons[0].geometry;
            return [(geom.coordinates[0] as number[][]).map(p => ({ lat: p[1], lng: p[0] }))];
        }

        // Merge polygons using Turf 7.x union (which takes a FeatureCollection)
        const collection = turf.featureCollection(polygons);
        const merged = union(collection);

        // Convert back to Coordinates[][]
        const result: Coordinates[][] = [];
        if (merged && merged.geometry) {
            const geom = merged.geometry;
            if (geom.type === 'Polygon') {
                const coords = (geom.coordinates[0] as number[][]).map(p => ({ lat: p[1], lng: p[0] }));
                result.push(coords);
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates.forEach((poly: any) => {
                    const coords = (poly[0] as number[][]).map((p: any) => ({ lat: p[1], lng: p[0] }));
                    result.push(coords);
                });
            }
        }
        return result;
    } catch (e) {
        console.error("Error unifying shadows:", e);
        // Fallback to individual polygons if union fails
        return [];
    }
};

/**
 * Main Analysis Function with Debug Output
 * Now supports time-aware calculation where sun position is computed per route point
 * based on estimated walking time
 */
export const analyzeRouteShade = async (
    routePoints: Coordinates[],
    date: Date,
    cloudCoverage: number,
    includeDebug: boolean = false,
    totalDurationSeconds?: number, // Optional: total route duration in seconds
    cachedFeatures?: ShadeFeature[] // Optional: Provide pre-fetched features to skip network call
): Promise<{
    avgShade: number;
    profile: { timeOffset: number; shadeLevel: number }[];
    debug?: ShadeAnalysisDebug;
}> => {
    if (cloudCoverage > 70) {
        return {
            avgShade: 100,
            profile: routePoints.map((_, i) => ({ timeOffset: i, shadeLevel: 100 }))
        };
    }

    if (routePoints.length === 0) return { avgShade: 0, profile: [] };

    const center = routePoints[Math.floor(routePoints.length / 2)];

    // Calculate initial Sun Position (for debug display and feature fetching)
    const initialSunPos = getSunPosition(center.lat, center.lng, date);

    // Check if it's already night at start time
    if (initialSunPos.altitude <= 0) {
        return {
            avgShade: 100,
            profile: routePoints.map((_, i) => ({ timeOffset: i, shadeLevel: 100 })),
            debug: includeDebug ? {
                features: cachedFeatures || [],
                shadows: [],
                sunPosition: initialSunPos,
                bbox: { north: 0, south: 0, east: 0, west: 0 }
            } : undefined
        };
    }

    // Compute route bounding box with margin for shadow casting
    const lats = routePoints.map(p => p.lat);
    const lngs = routePoints.map(p => p.lng);
    const routeBbox = {
        north: Math.max(...lats) + 0.003,
        south: Math.min(...lats) - 0.003,
        east: Math.max(...lngs) + 0.003,
        west: Math.min(...lngs) - 0.003
    };

    // Fetch shade features if not provided
    let features = cachedFeatures;
    if (!features) {
        features = await fetchShadeFeatures(routeBbox, date);
        console.log(`[ShadeEngine] Fetched ${features.length} shade features (Network Call)`);
        console.log(`  - Buildings: ${features.filter(f => f.type === 'building').length}`);
    } else {
        console.log(`[ShadeEngine] Using ${features.length} cached features (No Network Call)`);
    }
    console.log(`  - Trees: ${features.filter(f => f.type === 'tree').length}`);
    console.log(`  - Tree rows: ${features.filter(f => f.type === 'tree_row').length}`);
    console.log(`  - Parks: ${features.filter(f => f.type === 'park').length}`);
    console.log(`  - Forests: ${features.filter(f => f.type === 'forest').length}`);
    console.log(`  - Covered paths: ${features.filter(f => f.type === 'covered').length}`);

    // Calculate cumulative distances for time estimation
    const cumulativeDistances: number[] = [0];
    for (let i = 1; i < routePoints.length; i++) {
        const dist = getDistance(
            { latitude: routePoints[i - 1].lat, longitude: routePoints[i - 1].lng },
            { latitude: routePoints[i].lat, longitude: routePoints[i].lng }
        );
        cumulativeDistances.push(cumulativeDistances[i - 1] + dist);
    }
    const totalDistance = cumulativeDistances[cumulativeDistances.length - 1] || 1;

    // Default walking speed: ~5 km/h = ~1.4 m/s, or use provided duration
    const estimatedTotalSeconds = totalDurationSeconds || (totalDistance / 1.4);

    // Cache for shadows at different sun positions (optimization)
    let cachedSunPos = initialSunPos;
    let cachedShadows = features.map(feature => ({
        feature,
        shadow: calculateFeatureShadow(feature, cachedSunPos.azimuth, cachedSunPos.altitude)
    })).filter(s => s.shadow !== null);

    // Track all shadows for debug (use initial calculation)
    const debugShadows = cachedShadows;

    // Analyze each route point with time-aware sun position
    let totalShade = 0;
    const profile = [];

    for (let i = 0; i < routePoints.length; i++) {
        const point = routePoints[i];

        // Calculate estimated time at this point
        const progressRatio = cumulativeDistances[i] / totalDistance;
        const secondsElapsed = progressRatio * estimatedTotalSeconds;
        const pointTime = new Date(date.getTime() + secondsElapsed * 1000);

        // Get sun position at this specific time
        const pointSunPos = getSunPosition(point.lat, point.lng, pointTime);

        // Night check: if sun is below horizon, 100% shade
        if (pointSunPos.altitude <= 0) {
            totalShade += 100;
            profile.push({ timeOffset: i, shadeLevel: 100 });
            continue;
        }

        // Check if sun position changed significantly (>2 degrees) - recalculate shadows
        const azimuthDelta = Math.abs(pointSunPos.azimuthDeg - cachedSunPos.azimuthDeg);
        const altitudeDelta = Math.abs(pointSunPos.altitudeDeg - cachedSunPos.altitudeDeg);

        if (azimuthDelta > 2 || altitudeDelta > 2) {
            cachedSunPos = pointSunPos;
            cachedShadows = features.map(feature => ({
                feature,
                shadow: calculateFeatureShadow(feature, cachedSunPos.azimuth, cachedSunPos.altitude)
            })).filter(s => s.shadow !== null);
        }

        let maxShadeLevel = 0;

        for (const s of cachedShadows) {
            // Check feature footprint (standing under tree/in building shadow)
            if (isPointInPolygon(point, s.feature.coordinates)) {
                maxShadeLevel = Math.max(maxShadeLevel, s.feature.foliageDensity * 100);
            }
            // Check projected shadow
            if (s.shadow && isPointInPolygon(point, s.shadow.polygon)) {
                maxShadeLevel = Math.max(maxShadeLevel, s.shadow.opacity * 100);
            }

            if (maxShadeLevel >= 100) break; // Max shade reached
        }

        totalShade += maxShadeLevel;
        profile.push({ timeOffset: i, shadeLevel: Math.round(maxShadeLevel) });
    }

    const result: {
        avgShade: number;
        profile: { timeOffset: number; shadeLevel: number }[];
        debug?: ShadeAnalysisDebug;
    } = {
        avgShade: Math.round(totalShade / routePoints.length),
        profile
    };

    if (includeDebug) {
        result.debug = {
            features,
            shadows: debugShadows as { feature: ShadeFeature; shadow: Shadow }[],
            unifiedShadows: unifyShadows(debugShadows as any),
            sunPosition: initialSunPos,
            bbox: routeBbox
        };
    }

    return result;
};

// Legacy export for backward compatibility
export const fetchBuildings = fetchShadeFeatures;
