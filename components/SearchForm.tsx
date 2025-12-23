import React, { useState, useEffect } from 'react';
import { Search, Clock } from 'lucide-react';
import { SearchParams, Coordinates } from '../types';
import { PlaceInput } from './PlaceInput';

interface SearchFormProps {
  onSearch: (params: SearchParams) => void;
  isLoading: boolean;
}

export const SearchForm: React.FC<SearchFormProps> = ({ onSearch, isLoading }) => {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [userLocation, setUserLocation] = useState<Coordinates | undefined>(undefined);
  
  // Default to nearest hour
  const [time, setTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });

  useEffect(() => {
    // Get user location on mount if available
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log("Geolocation permission denied or error:", error)
      );
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (origin && destination && time) {
      onSearch({ origin, destination, time });
    }
  };

  const handleUseCurrentLocation = () => {
    if (userLocation) {
        setOrigin(`${userLocation.lat.toFixed(5)}, ${userLocation.lng.toFixed(5)}`);
    } else {
        // Retry fetching
        navigator.geolocation.getCurrentPosition((position) => {
            const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
            setUserLocation(loc);
            setOrigin(`${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
        });
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 mb-6">
      <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span className="bg-orange-100 text-orange-600 p-2 rounded-lg">
          <Search size={20} />
        </span>
        Find a Shady Route
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <PlaceInput 
            label="From"
            value={origin}
            onChange={setOrigin}
            placeholder="e.g. Times Square or Current Location"
            userLocation={userLocation}
            onUseCurrentLocation={handleUseCurrentLocation}
          />
          <PlaceInput 
            label="To"
            value={destination}
            onChange={setDestination}
            placeholder="e.g. Central Park Zoo"
            userLocation={userLocation}
          />
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="space-y-1 flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider ml-1">Start Time</label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700"
                required
              />
            </div>
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className={`flex-1 py-3 px-6 rounded-xl font-semibold text-white shadow-md transition-all 
              ${isLoading 
                ? 'bg-slate-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg active:scale-95'
              }`}
          >
            {isLoading ? 'Calculating Sun Angles...' : 'Find Routes'}
          </button>
        </div>
      </form>
    </div>
  );
};