import { useState, useMemo, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  MapPin,
  ArrowRightLeft,
  Plane,
  Landmark,
  Train,
  Bus,
  Car,
  Mountain,
  Navigation,
  Check,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Tag as TagIcon,
  Clock,
} from 'lucide-react';
import { LocationOption } from './UberSearchCard';

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

interface FullPageLocationSearchProps {
  isOpen: boolean;
  onClose: () => void;
  pickupText: string;
  dropText: string;
  selectedPickupLoc: LocationOption | null;
  selectedDropLoc: LocationOption | null;
  onSelectPickup: (loc: LocationOption) => void;
  onSelectDrop: (loc: LocationOption) => void;
  onSelectRoute: (
    pickup: LocationOption,
    drop: LocationOption,
    preselectedCategoryId?: string
  ) => void;
  locations: LocationOption[];
  fixedRoutes?: FixedRoutePricingRule[];
  initialActiveInput?: 'pickup' | 'drop';
}

function getLocationIcon(type?: string) {
  switch (type) {
    case 'AIRPORT':
      return <Plane className="w-4 h-4 text-blue-600" />;
    case 'TEMPLE':
      return <Landmark className="w-4 h-4 text-amber-600" />;
    case 'RAILWAY_STATION':
      return <Train className="w-4 h-4 text-purple-600" />;
    case 'BUS_STAND':
      return <Bus className="w-4 h-4 text-emerald-600" />;
    case 'TOURIST_LOCATION':
      return <Mountain className="w-4 h-4 text-orange-600" />;
    default:
      return <Car className="w-4 h-4 text-neutral-700" />;
  }
}

function getLocationBadge(type?: string) {
  switch (type) {
    case 'AIRPORT':
      return { label: 'Airport', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
    case 'TEMPLE':
      return { label: 'Temple', bg: 'bg-amber-50 text-amber-800 border-amber-200' };
    case 'RAILWAY_STATION':
      return { label: 'Railway', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    case 'BUS_STAND':
      return { label: 'Bus Stand', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'TOURIST_LOCATION':
      return { label: 'Tourist', bg: 'bg-orange-50 text-orange-700 border-orange-200' };
    case 'TAXI_STAND':
      return { label: 'Taxi Stand', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    default:
      return { label: 'Location', bg: 'bg-neutral-100 text-neutral-700 border-neutral-200' };
  }
}

const CATEGORY_FILTERS = [
  { id: 'ALL', label: 'All Platform Locations' },
  { id: 'TEMPLE', label: 'Temples 🛕' },
  { id: 'RAILWAY_STATION', label: 'Railway Stations 🚆' },
  { id: 'AIRPORT', label: 'Airports ✈️' },
  { id: 'BUS_STAND', label: 'Bus Stands 🚌' },
  { id: 'TOURIST_LOCATION', label: 'Tourist Spots 🏖️' },
];

export function FullPageLocationSearch({
  isOpen,
  onClose,
  pickupText,
  dropText,
  selectedPickupLoc,
  selectedDropLoc,
  onSelectPickup,
  onSelectDrop,
  onSelectRoute,
  locations,
  fixedRoutes = [],
  initialActiveInput = 'drop',
}: FullPageLocationSearchProps) {
  const [activeInput, setActiveInput] = useState<'pickup' | 'drop'>(initialActiveInput);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync initial input state when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveInput(initialActiveInput);
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, initialActiveInput]);

  // Handle location swap
  const handleSwap = () => {
    const prevPText = pickupText;
    const prevDText = dropText;
    const prevPLoc = selectedPickupLoc;
    const prevDLoc = selectedDropLoc;

    if (prevDLoc) {
      onSelectPickup(prevDLoc);
    } else if (prevDText) {
      const match = locations.find(l => l.name.toLowerCase() === prevDText.toLowerCase());
      onSelectPickup(match || { _id: '', name: prevDText });
    }

    if (prevPLoc) {
      onSelectDrop(prevPLoc);
    } else if (prevPText) {
      const match = locations.find(l => l.name.toLowerCase() === prevPText.toLowerCase());
      onSelectDrop(match || { _id: '', name: prevPText });
    }
  };

  // Filter locations dynamically in real time
  const filteredLocations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return locations.filter(loc => {
      // Category filter
      if (activeCategoryFilter !== 'ALL' && loc.type !== activeCategoryFilter) {
        return false;
      }
      // Query search
      if (!q) return true;
      const nameMatch = loc.name.toLowerCase().includes(q);
      const cityMatch = loc.address?.city?.toLowerCase().includes(q);
      const lineMatch = loc.address?.line1?.toLowerCase().includes(q);
      const codeMatch = loc.code?.toLowerCase().includes(q);
      return nameMatch || cityMatch || lineMatch || codeMatch;
    });
  }, [locations, searchQuery, activeCategoryFilter]);

  // Filter fixed routes matching search query
  const matchingFixedRoutes = useMemo(() => {
    if (!fixedRoutes || fixedRoutes.length === 0) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return fixedRoutes;
    return fixedRoutes.filter(r => {
      const nameMatch = r.name.toLowerCase().includes(q);
      const origMatch = r.originLocationId?.name?.toLowerCase().includes(q);
      const destMatch = r.destinationLocationId?.name?.toLowerCase().includes(q);
      return nameMatch || origMatch || destMatch;
    });
  }, [fixedRoutes, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col overflow-hidden text-neutral-900 select-none animate-in fade-in duration-200">
      {/* ─── TOP BAR ────────────────────────────────────────── */}
      <div className="bg-white border-b border-neutral-200 px-4 py-3 shrink-0 shadow-xs">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors text-black active:scale-95"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-base font-extrabold text-neutral-900">
                {activeInput === 'pickup' ? 'Select Pickup Point' : 'Select Destination'}
              </h2>
              <p className="text-[11px] text-neutral-500 font-medium">
                Verified platform taxi stands, temples, and transit hubs
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-neutral-500 hover:text-black px-2.5 py-1 rounded-lg hover:bg-neutral-100"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ─── ROUTE INPUT BOX (UBER STYLE 2-STOP) ─────────────── */}
      <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-3 shrink-0">
        <div className="max-w-2xl mx-auto">
          <div className="relative bg-white rounded-2xl p-3 border border-neutral-200 shadow-xs">
            {/* Dotted Vertical Route Line */}
            <div className="absolute left-[24px] top-[26px] bottom-[26px] w-[2px] bg-neutral-300 border-l border-dashed pointer-events-none" />

            {/* Pickup Location Row */}
            <div
              onClick={() => {
                setActiveInput('pickup');
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className={`flex items-center gap-3 relative pb-2.5 cursor-pointer rounded-xl px-2.5 py-2 transition-colors ${
                activeInput === 'pickup' ? 'bg-neutral-100 ring-2 ring-black' : 'hover:bg-neutral-50'
              }`}
            >
              {/* Green Pickup Circle */}
              <div className="w-5 h-5 flex items-center justify-center shrink-0 z-10">
                <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-xs" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  From (Pickup Point)
                </div>
                <div className="text-xs md:text-sm font-bold text-neutral-900 truncate">
                  {pickupText || 'Select pickup location'}
                </div>
              </div>

              {/* Swap Button */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  handleSwap();
                }}
                className="w-8 h-8 rounded-full bg-white hover:bg-neutral-200 border border-neutral-200 flex items-center justify-center text-neutral-800 transition-colors shrink-0 active:scale-90 shadow-xs"
                title="Swap pickup and destination"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Drop Location Row */}
            <div
              onClick={() => {
                setActiveInput('drop');
                setSearchQuery('');
                searchInputRef.current?.focus();
              }}
              className={`flex items-center gap-3 relative pt-2.5 cursor-pointer rounded-xl px-2.5 py-2 transition-colors ${
                activeInput === 'drop' ? 'bg-neutral-100 ring-2 ring-black' : 'hover:bg-neutral-50'
              }`}
            >
              {/* Black Drop Square */}
              <div className="w-5 h-5 flex items-center justify-center shrink-0 z-10">
                <div className="w-3.5 h-3.5 rounded-xs bg-black border-2 border-white shadow-xs" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                  To (Drop Destination)
                </div>
                <div className="text-xs md:text-sm font-bold text-neutral-900 truncate">
                  {dropText || 'Where are you going?'}
                </div>
              </div>
            </div>
          </div>

          {/* Live Search Input Field */}
          <div className="mt-3 relative flex items-center">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={
                activeInput === 'pickup'
                  ? 'Search platform pickup locations (temple, stand, town)...'
                  : 'Search platform destination (railway station, airport, temple)...'
              }
              className="w-full pl-10 pr-10 py-3 rounded-xl border border-neutral-300 focus:border-black focus:ring-1 focus:ring-black outline-none text-xs md:text-sm font-semibold bg-white text-neutral-900 shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 p-1 rounded-full text-neutral-400 hover:text-black hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 pb-0.5">
            {CATEGORY_FILTERS.map(filter => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveCategoryFilter(filter.id)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold whitespace-nowrap transition-all border shrink-0 ${
                  activeCategoryFilter === filter.id
                    ? 'bg-black text-white border-black shadow-xs'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SCROLLABLE RESULTS CONTENT ──────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* SECTION 1: VERIFIED PLATFORM FIXED ROUTES & OFFICIAL FARES */}
          {matchingFixedRoutes.length > 0 && activeInput === 'drop' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-md bg-amber-500/20 text-amber-800 text-xs font-black">
                    ⚡
                  </span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800">
                    Platform Guaranteed Routes & Fares
                  </h3>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  Official Flat Rate
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {matchingFixedRoutes.map(route => {
                  const origName = route.originLocationId?.name || 'Kollur Temple';
                  const destName = route.destinationLocationId?.name || route.name;
                  const price = route.fixedPrice || 0;
                  const catName = route.vehicleCategoryId?.name || 'All Vehicles';

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
                          onSelectRoute(pLoc, dLoc, route.vehicleCategoryId?._id);
                          onClose();
                        }
                      }}
                      className="p-3 bg-neutral-50 hover:bg-neutral-100 rounded-2xl border border-neutral-200 hover:border-black cursor-pointer transition-all active:scale-[0.98] group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-white border border-neutral-200 text-neutral-700">
                            {catName}
                          </span>
                          <span className="text-sm font-black text-neutral-900 font-mono">
                            ₹{price}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1">
                          <div className="text-xs font-bold text-neutral-900 truncate">
                            {destName}
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate flex items-center gap-1">
                            <span>From:</span>
                            <span className="font-medium text-neutral-700">{origName}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-neutral-200/70 flex items-center justify-between text-[11px]">
                        <span className="text-neutral-500 font-medium flex items-center gap-1">
                          {route.estimatedDurationMinutes ? (
                            <>
                              <Clock className="w-3 h-3 text-neutral-400" />
                              <span>{route.estimatedDurationMinutes} mins</span>
                            </>
                          ) : (
                            <span>Fixed Fare</span>
                          )}
                        </span>
                        <span className="text-black font-bold group-hover:underline flex items-center gap-0.5">
                          <span>Select</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SECTION 2: PLATFORM LISTED LOCATIONS */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-500">
                {activeInput === 'pickup' ? 'Available Pickup Hubs' : 'Platform Destination Locations'} ({filteredLocations.length})
              </h3>
              <span className="text-[11px] text-neutral-400">
                Only active registered locations
              </span>
            </div>

            {filteredLocations.length === 0 ? (
              <div className="text-center py-10 px-4 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
                <MapPin className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                <div className="text-xs font-bold text-neutral-700">No matching platform locations</div>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-xs mx-auto">
                  Please search for verified locations like Kollur, Kundapura, Byndoor, Udupi, or Mangalore.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-xs">
                {filteredLocations.map(loc => {
                  const badge = getLocationBadge(loc.type);
                  const isSelected =
                    activeInput === 'pickup'
                      ? selectedPickupLoc?._id === loc._id || pickupText === loc.name
                      : selectedDropLoc?._id === loc._id || dropText === loc.name;

                  return (
                    <div
                      key={loc._id}
                      onClick={() => {
                        if (activeInput === 'pickup') {
                          onSelectPickup(loc);
                          // Seamlessly switch to destination input
                          setActiveInput('drop');
                          setSearchQuery('');
                          searchInputRef.current?.focus();
                        } else {
                          onSelectDrop(loc);
                          onClose();
                        }
                      }}
                      className={`p-3.5 flex items-center justify-between gap-3 cursor-pointer transition-colors active:bg-neutral-100 ${
                        isSelected ? 'bg-indigo-50/50' : 'hover:bg-neutral-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Location Icon Circle */}
                        <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
                          {getLocationIcon(loc.type)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs md:text-sm font-bold text-neutral-900 truncate">
                              {loc.name}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badge.bg}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                            {loc.address?.line1 || loc.address?.city || 'Coastal Karnataka'}
                            {loc.address?.city ? ` • ${loc.address.city}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {isSelected ? (
                          <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center text-xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <ChevronRight className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
