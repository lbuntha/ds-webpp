import React, { useState, useEffect, useRef } from 'react';
import { Place } from '../../src/shared/types';
import { firebaseService } from '../../src/shared/services/firebaseService';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: Place) => void;
  onPickMap?: () => void;
  placeholder?: string;
  className?: string;
}

export const PlaceAutocomplete: React.FC<Props> = ({ 
  value, 
  onChange, 
  onSelect, 
  onPickMap, 
  placeholder = "Search places...", 
  className = "" 
}) => {
  const [results, setResults] = useState<Place[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (text: string) => {
    onChange(text);
    if (!text || text.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Try server-side search first (uses main_text index)
      let fetched = await firebaseService.placeService.searchPlaces(text);
      
      // 2. If no results (maybe missing index or small dataset), fallback to client-side filter
      if (!fetched || (Array.isArray(fetched) && fetched.length === 0)) {
          const all = await firebaseService.placeService.getAllPlaces();
          const lowerVal = text.toLowerCase().trim();
          
          fetched = all.filter(p => {
              const nameMatch = p.name && p.name.toLowerCase().includes(lowerVal);
              const addrMatch = p.address && p.address.toLowerCase().includes(lowerVal);
              return nameMatch || addrMatch;
          }).slice(0, 10);
      }
      
      // Defensive check: Ensure fetched is an array before setting state
      setResults(Array.isArray(fetched) ? fetched : []);
      setShowResults(true);
    } catch (e) {
      console.error("Search failed", e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (place: Place) => {
    onChange(place.address || place.name);
    onSelect(place);
    setShowResults(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-2">
        <div className="relative flex-1">
            <input
                type="text"
                className={className}
                value={value}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={placeholder}
                onFocus={() => { if(results.length > 0) setShowResults(true); }}
            />
            {loading && (
                <div className="absolute right-3 top-3">
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
            )}
        </div>
        {onPickMap && (
            <button 
                type="button"
                onClick={onPickMap}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                title="Pick on Map"
            >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
            </button>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {results.map((place) => (
            <div
              key={place.id}
              className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-none"
              onClick={() => handleSelect(place)}
            >
              <div className="font-medium text-sm text-gray-900">{place.name}</div>
              <div className="text-xs text-gray-500 truncate">{place.address}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
