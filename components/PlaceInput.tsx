import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, Navigation } from 'lucide-react';
import { Coordinates } from '../types';

interface PlaceInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  userLocation?: Coordinates;
  onUseCurrentLocation?: () => void;
  onPlaceSelected?: (placeId: string) => void;
}

export const PlaceInput: React.FC<PlaceInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  userLocation,
  onUseCurrentLocation,
  onPlaceSelected
}) => {
  // Simplifed suggestion type
  interface Suggestion {
    id: string;
    description: string;
  }

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (!window.google || !window.google.maps || !window.google.maps.places) return;

    setIsLoading(true);
    console.log(`[Places API] Requesting suggestions for "${input}"`); // LOG as requested
    try {
      // Use Places API (New) - Text Search
      // @ts-ignore - 'Place' might be missing in older Types definitions but exists in runtime if version is recent
      const { places } = await google.maps.places.Place.searchByText({
        textQuery: input,
        locationBias: userLocation ? { center: userLocation, radius: 5000 } : undefined,
        fields: ['id', 'displayName', 'formattedAddress']
      });

      console.log(`[Places API] Received ${places ? places.length : 0} results.`); // LOG response count

      if (places && places.length > 0) {
        // LIMIT TO 3 SUGGESTIONS
        const limitedPlaces = places.slice(0, 3);
        const newSuggestions = limitedPlaces.map((p: any) => ({
          id: p.id,
          // Combine Name + Address for better context
          description: p.displayName ? `${p.displayName} (${p.formattedAddress})` : p.formattedAddress
        }));
        setSuggestions(newSuggestions);
        setShowSuggestions(true);
      } else {
        setSuggestions([]);
      }
    } catch (e) {
      console.error("Autocomplete error (Legacy or New):", e);
      // Fallback or just empty
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value;
    onChange(newVal);

    if (newVal.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce manual implementation
    const timeoutId = setTimeout(() => {
      fetchSuggestions(newVal);
    }, 800);

    return () => clearTimeout(timeoutId);
  };

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.description); // Consider using just Name if Address is too long? Users prefer clarity.
    setSuggestions([]);
    setShowSuggestions(false);
    if (onPlaceSelected) {
      onPlaceSelected(suggestion.id);
    }
  };

  return (
    <div className="space-y-1 relative" ref={wrapperRef}>
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">{label}</label>
      <div className="relative group">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
        <input
          type="text"
          value={value}
          onChange={handleInput}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700 placeholder:text-slate-400"
          autoComplete="off"
        />

        {isLoading ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="animate-spin text-blue-500" size={16} />
          </div>
        ) : (
          onUseCurrentLocation && (
            <button
              type="button"
              onClick={onUseCurrentLocation}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Use my current location"
            >
              <Navigation size={16} />
            </button>
          )
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 w-full bg-white rounded-xl shadow-lg border border-slate-100 mt-1 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSelect(suggestion)}
              className="w-full text-left px-4 py-3 hover:bg-slate-50 text-sm text-slate-700 border-b border-slate-50 last:border-0 transition-colors flex items-start gap-2"
            >
              <MapPin size={14} className="text-slate-400 shrink-0 mt-1" />
              <span className="whitespace-normal break-words leading-tight">{suggestion.description}</span>
            </button>
          ))}
          <div className="px-2 py-1 flex justify-end">
            <img src="https://developers.google.com/maps/documentation/images/powered_by_google_on_white.png" alt="Powered by Google" className="h-4 object-contain opacity-70" />
          </div>
        </div>
      )}
    </div>
  );
};