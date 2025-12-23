import React, { useState, useCallback, useRef } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { SearchForm } from './components/SearchForm';
import { RouteList } from './components/RouteList';
import { MapContainer } from './components/MapContainer';
import { WeatherControls } from './components/WeatherControls';
import { DebugPanel } from './components/DebugPanel';
import { TimeScrubber } from './components/TimeScrubber';
import { getDirections } from './services/googleMapsService';
import { analyzeRouteShade, fetchShadeFeatures, ShadeAnalysisDebug, ShadeFeature } from './services/shadeEngine';
import { AppState, RouteOption, SearchParams, Coordinates } from './types';
import { Umbrella, AlertCircle, Loader2, Sun, Bug } from 'lucide-react';

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

const App: React.FC = () => {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinates | undefined>(undefined);
  const [cloudCoverage, setCloudCoverage] = useState(0); // 0-100

  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);
  const [debugData, setDebugData] = useState<ShadeAnalysisDebug | null>(null);
  const [highlightedFeature, setHighlightedFeature] = useState<ShadeFeature | null>(null);
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<number[]>([]);
  const [useSummerDate, setUseSummerDate] = useState(false); // July 20th mode
  const [simulationTime, setSimulationTime] = useState<string>('12:00'); // Track time for re-analysis
  const [isAnimating, setIsAnimating] = useState(false);
  const recalcTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cache for shade features to avoid re-fetching on time change
  const cachedFeaturesRef = useRef<ShadeFeature[] | null>(null);

  // Helper to extract points from Google Route
  const getRoutePoints = (route: google.maps.DirectionsRoute): Coordinates[] => {
    return route.overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
  };

  // Helper: Get bounding box that covers ALL routes
  const getUnionBbox = (routes: google.maps.DirectionsRoute[]) => {
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;

    routes.forEach(route => {
      route.overview_path.forEach(p => {
        const lat = p.lat();
        const lng = p.lng();
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      });
    });

    // Add margin
    const margin = 0.003;
    return {
      north: maxLat + margin,
      south: minLat - margin,
      east: maxLng + margin,
      west: minLng - margin
    };
  };

  const processRoutesWithShade = async (
    result: google.maps.DirectionsResult,
    timeVal: string,
    cloud: number,
    includeDebug: boolean,
    forceJuly: boolean = false,
    existingFeatures?: ShadeFeature[] | null
  ) => {
    const now = new Date();
    const [hours, minutes] = timeVal.split(':').map(Number);
    // Use July 20th if summer mode is enabled
    const tripDate = forceJuly
      ? new Date(now.getFullYear(), 6, 20, hours, minutes) // July = month 6 (0-indexed)
      : new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

    let latestDebug: ShadeAnalysisDebug | null = null;
    let featuresToUse = existingFeatures;

    // If no features provided, fetch them once for the union of all routes
    if (!featuresToUse) {
      const unionBbox = getUnionBbox(result.routes);
      console.log("Fetching features for union bbox:", unionBbox);
      featuresToUse = await fetchShadeFeatures(unionBbox, tripDate);
      cachedFeaturesRef.current = featuresToUse; // Cache them!
    }

    const processedRoutes: RouteOption[] = await Promise.all(result.routes.map(async (route, index) => {
      const leg = route.legs[0];
      const points = getRoutePoints(route);

      // Get duration in seconds for time-aware shade calculation
      const durationSeconds = leg?.duration?.value || undefined;

      // Analyze Shade using pre-fetched features
      // Pass featuresToUse explicitly to avoid internal fetching
      const shadeAnalysis = await analyzeRouteShade(
        points,
        tripDate,
        cloud,
        includeDebug && index === 0,
        durationSeconds,
        featuresToUse || undefined
      );

      // Capture debug data from first route
      if (index === 0 && shadeAnalysis.debug) {
        latestDebug = shadeAnalysis.debug;
      }

      return {
        id: `route-${index}`,
        name: route.summary || `Route ${index + 1}`,
        summary: leg?.start_address ? `Via ${route.summary}` : "Walking Route",
        totalDistance: leg?.distance?.text || "",
        totalDuration: leg?.duration?.text || "",
        averageShadePercentage: shadeAnalysis.avgShade,
        shadeProfile: shadeAnalysis.profile,
        steps: leg?.steps?.map(step => ({
          instruction: step.instructions.replace(/<[^>]*>?/gm, ''),
          distance: step.distance?.text || "",
          duration: step.duration?.text || "",
          shadeQuality: shadeAnalysis.avgShade > 70 ? 'shady' as const : shadeAnalysis.avgShade > 40 ? 'partial' as const : 'sunny' as const,
          description: "Based on solar analysis"
        })) || [],
        tags: index === 0 ? ["Fast"] : []
      };
    }));

    // Tag the best shade route
    let bestShadeIdx = 0;
    let maxShade = -1;
    processedRoutes.forEach((r, i) => {
      if (r.averageShadePercentage > maxShade) {
        maxShade = r.averageShadePercentage;
        bestShadeIdx = i;
      }
    });
    if (processedRoutes[bestShadeIdx] && !processedRoutes[bestShadeIdx].tags.includes("Most Shaded")) {
      processedRoutes[bestShadeIdx].tags.push("Most Shaded");
    }

    return { routes: processedRoutes, debug: latestDebug };
  };

  const handleSearch = async (params: SearchParams) => {
    setAppState(AppState.LOADING);
    setError(null);
    setDebugData(null);
    setHighlightedFeature(null);
    setSelectedFeatureIds([]);
    setSimulationTime(params.time);
    cachedFeaturesRef.current = null; // Clear cache on new search

    try {
      const result = await getDirections(params.origin, params.destination);
      setDirectionsResponse(result);

      // This will trigger the initial fetch and cache
      const { routes: uiRoutes, debug } = await processRoutesWithShade(
        result,
        params.time,
        cloudCoverage,
        debugMode,
        useSummerDate,
        null
      );

      setRoutes(uiRoutes);
      setSelectedRouteIndex(0);
      if (debug) setDebugData(debug);

      setAppState(AppState.RESULTS);
    } catch (err) {
      console.error(err);
      setError("Failed to find routes. Please check the locations and try again.");
      setAppState(AppState.ERROR);
    }
  };

  // Handle time scrubber changes with debounced recalculation
  const handleScrubberTimeChange = useCallback((newTime: string) => {
    setSimulationTime(newTime);

    // Debounce recalculation to avoid excessive API calls during animation
    if (recalcTimeoutRef.current) {
      clearTimeout(recalcTimeoutRef.current);
    }

    if (directionsResponse && appState === AppState.RESULTS) {
      recalcTimeoutRef.current = setTimeout(async () => {
        // Re-analyze with new time, REUSING CACHED FEATURES
        const { routes: uiRoutes, debug } = await processRoutesWithShade(
          directionsResponse,
          newTime,
          cloudCoverage,
          debugMode,
          useSummerDate,
          cachedFeaturesRef.current // Pass cached features
        );
        setRoutes(uiRoutes);
        if (debug) setDebugData(debug);
      }, isAnimating ? 50 : 100); // Faster debounce when animating since we have local data!
    }
  }, [directionsResponse, appState, cloudCoverage, debugMode, useSummerDate, isAnimating]);

  // Handle route selection from RouteList - updates map view
  const handleRouteSelect = useCallback((routeId: string, routeIndex: number) => {
    setSelectedRouteIndex(routeIndex);
  }, []);

  if (loadError) {
    return <div>Error loading Maps API</div>;
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-50 flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar / Overlay for Mobile */}
      <div className="w-full md:w-[400px] lg:w-[450px] bg-white border-r border-slate-200 z-20 shadow-xl overflow-y-auto custom-scrollbar flex-1 md:flex-none md:h-full relative order-2 md:order-1 min-h-0">

        {/* Header */}
        <header className="p-4 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Umbrella size={20} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">ShadeWalker</h1>
                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">With Google Maps Platform</p>
              </div>
            </div>

            {/* Debug Toggle */}
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`p-2 rounded-lg transition-colors ${debugMode
                ? 'bg-amber-100 text-amber-600'
                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                }`}
              title={debugMode ? "Debug mode ON" : "Enable debug mode"}
            >
              <Bug size={16} />
            </button>
          </div>

          <WeatherControls
            cloudCoverage={cloudCoverage}
            onChange={setCloudCoverage}
            debugMode={debugMode}
            useSummerDate={useSummerDate}
            onSummerToggle={setUseSummerDate}
          />

          {/* Time Scrubber - Debug mode only, after initial search */}
          {debugMode && appState === AppState.RESULTS && (
            <div className="mb-4">
              <TimeScrubber
                currentTime={simulationTime}
                onTimeChange={handleScrubberTimeChange}
                isPlaying={isAnimating}
                onPlayToggle={setIsAnimating}
              />
            </div>
          )}

          <SearchForm
            onSearch={handleSearch}
            isLoading={appState === AppState.LOADING}
          />
        </header>

        {/* Content Area */}
        <div className="p-4 pb-20 md:pb-4">
          {appState === AppState.LOADING && (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 size={32} className="animate-spin text-blue-500 mb-4" />
              <p className="text-sm font-medium text-slate-600">
                {debugMode ? 'Analyzing shade data...' : 'Calculating routes...'}
              </p>
            </div>
          )}

          {appState === AppState.ERROR && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center">
              <AlertCircle size={32} className="mx-auto text-red-500 mb-3" />
              <h3 className="text-sm font-bold text-red-700 mb-1">Navigation Error</h3>
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {appState === AppState.IDLE && (
            <div className="text-center py-12 px-4">
              <div className="inline-flex bg-blue-50 p-4 rounded-full text-blue-500 mb-4">
                <Sun size={32} />
              </div>
              <h3 className="text-slate-900 font-bold mb-2">Ready to Walk?</h3>
              <p className="text-slate-500 text-sm">
                Enter your destination to find the most shaded paths across the city.
              </p>
              {debugMode && (
                <p className="text-amber-600 text-xs mt-2 flex items-center justify-center gap-1">
                  <Bug size={12} /> Debug mode enabled
                </p>
              )}
            </div>
          )}

          {appState === AppState.RESULTS && (
            <RouteList
              routes={routes}
              selectedRouteId={routes[selectedRouteIndex]?.id}
              onRouteSelect={handleRouteSelect}
            />
          )}
        </div>
      </div>

      {/* Map Area */}
      <div className="h-[35vh] md:h-full md:flex-1 relative bg-slate-200 order-1 md:order-2 shrink-0">
        <MapContainer
          routes={directionsResponse}
          selectedRouteIndex={selectedRouteIndex}
          userLocation={userLocation}
          analyzedRoutes={routes}
          debugData={debugMode ? debugData : null}
          highlightedFeature={highlightedFeature}
          selectedFeatureIds={selectedFeatureIds}
          onMapClick={() => setHighlightedFeature(null)}
          onUserLocationChange={setUserLocation}
        />
      </div>

      {/* Debug Panel */}
      {debugMode && debugData && (
        <DebugPanel
          debug={debugData}
          onClose={() => setDebugData(null)}
          onFeatureClick={(feature) => setHighlightedFeature(feature)}
          highlightedFeatureId={highlightedFeature?.id}
          selectedFeatureIds={selectedFeatureIds}
          onSelectionChange={setSelectedFeatureIds}
        />
      )}
    </div>
  );
};

export default App;