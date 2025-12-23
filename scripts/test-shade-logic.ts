import SunCalc from 'suncalc';
import { getDistance, computeDestinationPoint } from 'geolib';

// Mocking required types and helper functions for testing
interface Coordinates {
    lat: number;
    lng: number;
}

const computeConvexHull = (points: Coordinates[]): Coordinates[] => {
    if (points.length < 3) return points;
    let lowest = 0;
    for (let i = 1; i < points.length; i++) {
        if (points[i].lat < points[lowest].lat ||
            (points[i].lat === points[lowest].lat && points[i].lng < points[lowest].lng)) {
            lowest = i;
        }
    }
    const pivot = points[lowest];
    const sorted = points.filter((_, i) => i !== lowest).sort((a, b) => {
        const angleA = Math.atan2(a.lat - pivot.lat, a.lng - pivot.lng);
        const angleB = Math.atan2(b.lat - pivot.lat, b.lng - pivot.lng);
        if (angleA !== angleB) return angleA - angleB;
        return ((a.lat - pivot.lat) ** 2 + (a.lng - pivot.lng) ** 2) - ((b.lat - pivot.lat) ** 2 + (b.lng - pivot.lng) ** 2);
    });
    const cross = (o: Coordinates, a: Coordinates, b: Coordinates) => (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
    const hull: Coordinates[] = [pivot];
    for (const point of sorted) {
        while (hull.length > 1 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
            hull.pop();
        }
        hull.push(point);
    }
    return hull;
};

// Simple test for Convex Hull
const testConvexHull = () => {
    console.log("--- Testing Convex Hull ---");
    const square: Coordinates[] = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 1 },
        { lat: 1, lng: 1 },
        { lat: 1, lng: 0 }
    ];
    const projected: Coordinates[] = [
        { lat: 2, lng: 2 },
        { lat: 2, lng: 3 }
    ];
    const hull = computeConvexHull([...square, ...projected]);
    console.log("Input points:", square.length + projected.length);
    console.log("Hull points:", hull.length);
    // Hull should contain the extreme points
    const containsExtreme = hull.some(p => p.lat === 2 && p.lng === 3);
    console.log("Contains extreme point:", containsExtreme ? "PASS" : "FAIL");
};

// Simple test for Sun Position and Night Logic
const testSunLogic = () => {
    console.log("\n--- Testing Sun Logic ---");
    const lat = 47.1585; // Iași
    const lng = 27.6014;

    // Day time (Noon)
    const dayDate = new Date("2025-06-20T12:00:00Z");
    const daySun = SunCalc.getPosition(dayDate, lat, lng);
    console.log(`Day Altitude: ${(daySun.altitude * 180 / Math.PI).toFixed(2)}° (Expect > 0)`);

    // Night time (Midnight)
    const nightDate = new Date("2025-06-20T23:00:00Z");
    const nightSun = SunCalc.getPosition(nightDate, lat, lng);
    console.log(`Night Altitude: ${(nightSun.altitude * 180 / Math.PI).toFixed(2)}° (Expect < 0)`);

    if (daySun.altitude > 0 && nightSun.altitude < 0) {
        console.log("Sun logic: PASS");
    } else {
        console.log("Sun logic: FAIL");
    }
};

testConvexHull();
testSunLogic();
