import { useState } from 'react';
import { MapPin, ArrowRightLeft, X, Plane, Landmark, Train, Bus, Car, Mountain } from 'lucide-react';

export interface LocationOption {
  _id: string;
  name: string;
  code?: string;
  type?: string;
  address?: { line1?: string; city?: string; state?: string };
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

function getLocationIcon(type?: string) {
  switch (type) {
    case 'AIRPORT':
      return <Plane className="w-3.5 h-3.5" />;
    case 'TEMPLE':
      return <Landmark className="w-3.5 h-3.5" />;
    case 'RAILWAY_STATION':
      return <Train className="w-3.5 h-3.5" />;
    case 'BUS_STAND':
      return <Bus className="w-3.5 h-3.5" />;
    case 'TOURIST_LOCATION':
      return <Mountain className="w-3.5 h-3.5" />;
    default:
      return <Car className="w-3.5 h-3.5" />;
  }
}

function getLocationBadge(type?: string) {
  switch (type) {
    case 'AIRPORT':
      return { label: 'Airport', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'TEMPLE':
      return { label: 'Temple', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'RAILWAY_STATION':
      return { label: 'Railway', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'BUS_STAND':
      return { label: 'Bus Stand', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'TOURIST_LOCATION':
      return { label: 'Tourist', bg: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'TAXI_STAND':
      return { label: 'Taxi Stand', bg: 'bg-neutral-100 text-neutral-700 border-neutral-200' };
    default:
      return { label: 'Location', bg: 'bg-neutral-100 text-neutral-700 border-neutral-200' };
  }
}

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

  // ONLY locations listed and verified by admin
  const query = (activeInput === 'pickup' ? pickupText : dropText).trim().toLowerCase();
  const filtered = query
    ? locations.filter(l =>
        l.name.toLowerCase().includes(query) ||
        l.address?.city?.toLowerCase().includes(query) ||
        l.address?.line1?.toLowerCase().includes(query)
      )
    : locations;

  const handleSwap = () => {
    const temp = pickupText;
    onChangePickupText(dropText || 'Kollur Sri Mookambika Temple');
    onChangeDropText(temp);
  };

  return (
    <div className="space-y-4 text-black">
      {/* 2-Stop Input Box with Connected Dots (Exact Uber Design) */}
      <div className="relative bg-neutral-100 rounded-2xl p-3 border border-neutral-200 shadow-xs">
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

      {/* Admin Verified Locations Chips */}
      {locations.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 px-1">
            <span>Popular Destinations</span>
            <span className="text-[11px] text-neutral-400 font-normal">Tap to set drop</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {locations.map(loc => {
              const badge = getLocationBadge(loc.type);
              return (
                <button
                  key={loc._id}
                  type="button"
                  onClick={() => {
                    onSelectDropLocation(loc);
                    onChangeDropText(loc.name);
                    onProceedToVehicleSelection();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium whitespace-nowrap border border-neutral-200 transition-colors shadow-xs active:scale-95"
                >
                  <span className="text-neutral-600">{getLocationIcon(loc.type)}</span>
                  <span>{loc.name.split('(')[0].trim()}</span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${badge.bg}`}>
                    {badge.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Location Autocomplete / List */}
      <div className="space-y-1 max-h-[220px] overflow-y-auto no-scrollbar pt-1">
        {locations.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-400 bg-neutral-50 rounded-xl border border-neutral-100">
            Loading destinations...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-500 bg-neutral-50 rounded-xl border border-neutral-100">
            No destination found for &ldquo;{query}&rdquo;.
            <p className="text-[11px] text-neutral-400 mt-1">
              Try searching with a different landmark or area name.
            </p>
          </div>
        ) : (
          filtered.map(loc => {
            const badge = getLocationBadge(loc.type);
            return (
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
                  {getLocationIcon(loc.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs md:text-sm font-semibold text-neutral-900 truncate">
                      {loc.name}
                    </h4>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border shrink-0 ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500 truncate">
                    {loc.address?.line1 || loc.address?.city || loc.name}
                  </p>
                </div>
              </div>
            );
          })
        )}
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
