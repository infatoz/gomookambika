import { useState } from 'react';
import {
  MapPin,
  ArrowRightLeft,
  X,
  Plane,
  Landmark,
  Train,
  Bus,
  Car,
  Mountain,
  Search,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export interface LocationOption {
  _id: string;
  name: string;
  code?: string;
  type?: string;
  address?: { line1?: string; city?: string; state?: string };
  geoPoint?: { coordinates: [number, number] }; // [lng, lat]
}

export interface FixedRoutePricingRule {
  _id: string;
  name: string;
  ruleType: string;
  fixedPrice?: number;
  roundTripPrice?: number;
  estimatedDurationMinutes?: number;
  tollIncluded?: boolean;
  parkingIncluded?: boolean;
  description?: string;
  originLocationId?: {
    _id: string;
    name: string;
    type?: string;
    address?: { line1?: string; city?: string; state?: string };
    geoPoint?: { coordinates: [number, number] };
  };
  destinationLocationId?: {
    _id: string;
    name: string;
    type?: string;
    address?: { line1?: string; city?: string; state?: string };
    geoPoint?: { coordinates: [number, number] };
  };
  vehicleCategoryId?: {
    _id: string;
    name: string;
    code: string;
    baseFare?: number;
    ratePerKm?: number;
    seatCapacity?: number;
  };
}

interface UberSearchCardProps {
  pickupText: string;
  onChangePickupText: (text: string) => void;
  dropText: string;
  onChangeDropText: (text: string) => void;
  onSelectDropLocation: (loc: LocationOption) => void;
  onSelectPickupLocation: (loc: LocationOption) => void;
  onSelectRoute?: (
    pickup: LocationOption,
    drop: LocationOption,
    preselectedCategoryId?: string
  ) => void;
  locations: LocationOption[];
  fixedRoutes?: FixedRoutePricingRule[];
  onProceedToVehicleSelection: () => void;
  onOpenFullSearch?: (activeField: 'pickup' | 'drop') => void;
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
  onSelectRoute,
  locations,
  fixedRoutes = [],
  onProceedToVehicleSelection,
  onOpenFullSearch,
}: UberSearchCardProps) {
  const [activeInput, setActiveInput] = useState<'pickup' | 'drop' | null>('drop');

  // ONLY locations listed and verified by admin
  const query = (activeInput === 'pickup' ? pickupText : dropText).trim().toLowerCase();
  const filtered = query
    ? locations.filter(
        l =>
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
          {/* Green circle icon */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0 z-10">
            <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-xs" />
          </div>

          <div
            onClick={() => onOpenFullSearch?.('pickup')}
            className="flex-1 bg-white rounded-xl px-3 py-2 border border-neutral-200 hover:border-black transition-colors flex items-center justify-between cursor-pointer"
          >
            <input
              type="text"
              value={pickupText}
              onChange={e => onChangePickupText(e.target.value)}
              onFocus={() => {
                setActiveInput('pickup');
                onOpenFullSearch?.('pickup');
              }}
              placeholder="Enter pickup location"
              className="w-full text-xs md:text-sm font-semibold outline-none bg-transparent placeholder:text-neutral-400 text-neutral-900 cursor-pointer"
              readOnly
            />
            {pickupText && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onChangePickupText('');
                  onOpenFullSearch?.('pickup');
                }}
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
            className="w-8 h-8 rounded-full bg-white hover:bg-neutral-200 border border-neutral-200 flex items-center justify-center text-neutral-600 transition-colors shrink-0 shadow-xs active:scale-95"
            title="Swap pickup and destination"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Dropoff Row */}
        <div className="flex items-center gap-3 relative pt-1">
          {/* Black square icon */}
          <div className="w-5 h-5 flex items-center justify-center shrink-0 z-10">
            <div className="w-3.5 h-3.5 rounded-xs bg-black border-2 border-white shadow-xs" />
          </div>

          <div
            onClick={() => onOpenFullSearch?.('drop')}
            className="flex-1 bg-white rounded-xl px-3 py-2 border border-neutral-200 hover:border-black transition-colors flex items-center justify-between cursor-pointer"
          >
            <input
              type="text"
              value={dropText}
              onChange={e => onChangeDropText(e.target.value)}
              onFocus={() => {
                setActiveInput('drop');
                onOpenFullSearch?.('drop');
              }}
              placeholder="Where to? (Tap to search all locations)"
              className="w-full text-xs md:text-sm font-semibold outline-none bg-transparent placeholder:text-neutral-400 text-neutral-900 cursor-pointer"
              readOnly
            />
            {dropText ? (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onChangeDropText('');
                  onOpenFullSearch?.('drop');
                }}
                className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
            )}
          </div>

          <div className="w-8 shrink-0" />
        </div>
      </div>

      {/* Full Page Search Callout Banner */}
      <button
        type="button"
        onClick={() => onOpenFullSearch?.('drop')}
        className="w-full p-3 rounded-2xl bg-black hover:bg-neutral-800 text-white flex items-center justify-between text-left transition-all active:scale-[0.99] shadow-sm group"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white shrink-0">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold">Search All Platform Locations</div>
            <div className="text-[10px] text-neutral-400">
              Temples, Railway Stations, Airports, Beach & Outstation
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
      </button>

      {/* Platform Fixed Routes & Pricing (Guaranteed Platform Fares) */}
      {fixedRoutes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-neutral-800 px-1">
            <div className="flex items-center gap-1.5">
              <span className="text-amber-500">⚡</span>
              <span>Platform Fixed Fares</span>
            </div>
            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              Guaranteed Rates
            </span>
          </div>

          <div className="space-y-1.5 max-h-[190px] overflow-y-auto no-scrollbar">
            {fixedRoutes.slice(0, 5).map(route => {
              const origName = route.originLocationId?.name || 'Kollur';
              const destName = route.destinationLocationId?.name || route.name;
              const price = route.fixedPrice || 0;
              const catName = route.vehicleCategoryId?.name || 'Standard';

              return (
                <div
                  key={route._id}
                  onClick={() => {
                    if (route.originLocationId && route.destinationLocationId) {
                      const pLoc: LocationOption = {
                        _id: route.originLocationId._id,
                        name: route.originLocationId.name,
                        type: route.originLocationId.type,
                        address: route.originLocationId.address,
                        geoPoint: route.originLocationId.geoPoint,
                      };
                      const dLoc: LocationOption = {
                        _id: route.destinationLocationId._id,
                        name: route.destinationLocationId.name,
                        type: route.destinationLocationId.type,
                        address: route.destinationLocationId.address,
                        geoPoint: route.destinationLocationId.geoPoint,
                      };
                      onSelectRoute?.(pLoc, dLoc, route.vehicleCategoryId?._id);
                    }
                  }}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 hover:border-black cursor-pointer transition-all active:scale-[0.98] group"
                >
                  <div className="min-w-0 pr-2">
                    <div className="text-xs font-bold text-neutral-900 truncate">
                      {destName}
                    </div>
                    <div className="text-[10px] text-neutral-500 truncate flex items-center gap-1 mt-0.5">
                      <span>From {origName}</span>
                      <span>•</span>
                      <span className="text-neutral-700 font-medium">{catName}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-xs font-black text-neutral-900 font-mono">
                      ₹{price}
                    </div>
                    <div className="text-[10px] text-emerald-600 font-semibold">
                      Book Now
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin Verified Locations Chips */}
      {locations.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold text-neutral-500 px-1">
            <span>Popular Platform Locations</span>
            <span className="text-[11px] text-neutral-400 font-normal">Tap to set drop</span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {locations.slice(0, 10).map(loc => {
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium whitespace-nowrap border border-neutral-200 transition-colors shadow-2xs active:scale-95"
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

      {/* Search / Proceed Button */}
      {dropText && (
        <button
          type="button"
          onClick={onProceedToVehicleSelection}
          className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-2xl text-sm transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
        >
          <span>See Available Vehicles & Prices</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
