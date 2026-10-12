import { useState } from 'react';
import { Search, MapPin, Clock, ArrowRightLeft, Sparkles, Navigation, X } from 'lucide-react';

export interface LocationOption {
  _id: string;
  name: string;
  code?: string;
  address?: { line1?: string; city?: string };
  geoPoint?: { coordinates: [number, number] }; // [lng, lat]
}

interface UberSearchCardProps {
  pickupText: string;
  onChangePickupText: (text: string) => void;
  dropText: string;
  onChangeDropText: (text: string) => void;
  onSelectDropLocation: (loc: LocationOption) => void;
  onSelectPickupLocation: (loc: LocationOption) => void;
  locations: LocationOption[];
  onProceedToVehicleSelection: () => void;
}

// Popular coastal temple & transit hubs
const POPULAR_SUGGESTIONS: LocationOption[] = [
  {
    _id: 'pop_byndoor',
    name: 'Mookambika Road Byndoor (Railway Station)',
    address: { line1: 'Railway Station Road', city: 'Bainduru' },
    geoPoint: { coordinates: [74.6369, 13.8741] },
  },
  {
    _id: 'pop_kollur',
    name: 'Sri Mookambika Temple Main Entrance',
    address: { line1: 'Temple Road', city: 'Kollur' },
    geoPoint: { coordinates: [74.8100, 13.8617] },
  },
  {
    _id: 'pop_murudeshwar',
    name: 'Murudeshwar Temple & Beach',
    address: { line1: 'Bhatkal Highway', city: 'Murudeshwar' },
    geoPoint: { coordinates: [74.4842, 14.0941] },
  },
  {
    _id: 'pop_kundapura',
    name: 'Kundapura Bus Stand',
    address: { line1: 'Main KSRTC Stand', city: 'Kundapura' },
    geoPoint: { coordinates: [74.6938, 13.6263] },
  },
  {
    _id: 'pop_udupi',
    name: 'Udupi Sri Krishna Matha',
    address: { line1: 'Car Street', city: 'Udupi' },
    geoPoint: { coordinates: [74.7521, 13.3409] },
  },
  {
    _id: 'pop_mangalore',
    name: 'Mangalore International Airport (IXE)',
    address: { line1: 'Kenjar Airport Road', city: 'Mangalore' },
    geoPoint: { coordinates: [74.8893, 12.9613] },
  },
];

export function UberSearchCard({
  pickupText,
  onChangePickupText,
  dropText,
  onChangeDropText,
  onSelectDropLocation,
  onSelectPickupLocation,
  locations,
  onProceedToVehicleSelection,
}: UberSearchCardProps) {
  const [activeInput, setActiveInput] = useState<'pickup' | 'drop' | null>('drop');

  const combinedLocations = locations.length > 0 ? locations : POPULAR_SUGGESTIONS;

  // Filter locations based on current query
  const query = activeInput === 'pickup' ? pickupText : dropText;
  const filtered = query.trim()
    ? combinedLocations.filter(l =>
        l.name.toLowerCase().includes(query.toLowerCase()) ||
        l.address?.city?.toLowerCase().includes(query.toLowerCase())
      )
    : combinedLocations;

  const handleSwap = () => {
    const temp = pickupText;
    onChangePickupText(dropText || 'Kollur Sri Mookambika Temple');
    onChangeDropText(temp);
  };

  return (
    <div className="space-y-4 text-black">
      {/* 2-Stop Input Box with Connected Dots (Exact Uber Design) */}
      <div className="relative bg-neutral-100 rounded-2xl p-3 border border-neutral-200">
        {/* Dotted Vertical Route Line */}
        <div className="absolute left-[26px] top-[26px] bottom-[26px] w-[2px] bg-neutral-400 border-l border-dashed pointer-events-none" />

        {/* Pickup Row */}
        <div className="flex items-center gap-3 relative pb-2.5">
          {/* Black circle icon */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0 z-10">
            <div className="w-3.5 h-3.5 rounded-full bg-black border-2 border-white shadow-sm" />
          </div>

          <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-neutral-200 focus-within:border-black transition-colors flex items-center justify-between">
            <input
              type="text"
              value={pickupText}
              onChange={e => onChangePickupText(e.target.value)}
              onFocus={() => setActiveInput('pickup')}
              placeholder="Enter pickup location"
              className="w-full text-xs md:text-sm font-semibold outline-none bg-transparent placeholder:text-neutral-400 text-neutral-900"
            />
            {pickupText && (
              <button
                type="button"
                onClick={() => onChangePickupText('')}
                className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Swap Button */}
          <button
            type="button"
            onClick={handleSwap}
            className="w-8 h-8 rounded-full bg-white hover:bg-neutral-200 border border-neutral-200 flex items-center justify-center text-neutral-600 transition-colors shrink-0 shadow-sm"
            title="Swap pickup and destination"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dropoff Row */}
        <div className="flex items-center gap-3 relative pt-1">
          {/* Black square icon */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0 z-10">
            <div className="w-3.5 h-3.5 rounded-sm bg-black border-2 border-white shadow-sm" />
          </div>

          <div className="flex-1 bg-white rounded-xl px-3 py-2 border border-neutral-200 focus-within:border-black transition-colors flex items-center justify-between">
            <input
              type="text"
              value={dropText}
              onChange={e => onChangeDropText(e.target.value)}
              onFocus={() => setActiveInput('drop')}
              placeholder="Where to?"
              className="w-full text-xs md:text-sm font-semibold outline-none bg-transparent placeholder:text-neutral-400 text-neutral-900"
              autoFocus={!dropText}
            />
            {dropText && (
              <button
                type="button"
                onClick={() => onChangeDropText('')}
                className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-8 shrink-0" />
        </div>
      </div>

      {/* Popular Quick Chips (Uber Style) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 px-1">
          <span>Popular Pilgrimage & Travel Hubs</span>
          <span className="text-[11px] text-neutral-400 font-normal">Tap to auto-fill</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {POPULAR_SUGGESTIONS.map(sug => (
            <button
              key={sug._id}
              type="button"
              onClick={() => {
                const matched = locations.find(l =>
                  l.name.toLowerCase().includes(sug.name.split(' ')[0].toLowerCase()) ||
                  (sug.code && l.code === sug.code)
                );
                const target = matched || sug;
                onSelectDropLocation(target);
                onChangeDropText(target.name);
                onProceedToVehicleSelection();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium whitespace-nowrap border border-neutral-200 transition-colors shadow-xs active:scale-95"
            >
              <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
              <span>{sug.name.split('(')[0].trim()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Autocomplete / Location list */}
      <div className="space-y-1 max-h-[200px] overflow-y-auto no-scrollbar pt-1">
        {filtered.slice(0, 6).map(loc => (
          <div
            key={loc._id}
            onClick={() => {
              if (activeInput === 'pickup') {
                onSelectPickupLocation(loc);
                onChangePickupText(loc.name);
                setActiveInput('drop');
              } else {
                onSelectDropLocation(loc);
                onChangeDropText(loc.name);
                onProceedToVehicleSelection();
              }
            }}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-100 cursor-pointer transition-colors border-b border-neutral-100 last:border-none group"
          >
            <div className="w-8 h-8 rounded-full bg-neutral-100 group-hover:bg-neutral-200 flex items-center justify-center shrink-0 text-neutral-700">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs md:text-sm font-semibold text-neutral-900 truncate">
                {loc.name}
              </h4>
              <p className="text-[11px] text-neutral-500 truncate">
                {loc.address?.line1 || loc.address?.city || 'Coastal Karnataka'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Search / Proceed Button */}
      {dropText && (
        <button
          type="button"
          onClick={onProceedToVehicleSelection}
          className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-2xl text-sm transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
        >
          <span>See Ride Options & Fares</span>
        </button>
      )}
    </div>
  );
}
