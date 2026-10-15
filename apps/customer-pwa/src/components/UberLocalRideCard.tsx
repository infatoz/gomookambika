import { useState, useEffect } from 'react';
import { 
  Compass, 
  Plane, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles, 
  Car, 
  Landmark, 
  CheckCircle2, 
  Info,
  Calendar,
  RotateCw
} from 'lucide-react';
import { api } from '@/lib/api';
import { LocationOption } from './UberSearchCard';
import { VehicleCategoryItem } from './UberRideSelector';

export interface FixedRouteItem {
  _id: string;
  name: string;
  ruleType: string;
  fixedPrice: number;
  roundTripPrice?: number;
  tollIncluded?: boolean;
  parkingIncluded?: boolean;
  freeWaitingMinutes?: number;
  includedKm?: number;
  description?: string;
  originLocationId?: LocationOption;
  destinationLocationId?: LocationOption;
  vehicleCategoryId?: VehicleCategoryItem;
}

interface UberLocalRideCardProps {
  locations: LocationOption[];
  categories: VehicleCategoryItem[];
  onSelectFixedRoute: (route: {
    origin: LocationOption;
    destination: LocationOption;
    vehicleCategoryId?: string;
    fixedPrice: number;
    ruleName: string;
    tripType: 'LOCAL' | 'ONE_WAY' | 'AIRPORT_TRANSFER' | 'OUTSTATION';
  }) => void;
  onSelectRentalPackage: (pkg: {
    hours: number;
    km: number;
    title: string;
    basePrice: number;
    vehicleCategory?: VehicleCategoryItem;
  }) => void;
}

type SubTab = 'fixed' | 'intercity' | 'airport' | 'rent';

export function UberLocalRideCard({
  locations,
  categories,
  onSelectFixedRoute,
  onSelectRentalPackage,
}: UberLocalRideCardProps) {
  const [subTab, setSubTab] = useState<SubTab>('fixed');
  const [fixedRoutes, setFixedRoutes] = useState<FixedRouteItem[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [intercityTripMode, setIntercityTripMode] = useState<'ONE_WAY' | 'ROUND_TRIP'>('ONE_WAY');

  useEffect(() => {
    setLoadingRoutes(true);
    api
      .get<{ data: FixedRouteItem[] }>('/fare/fixed-routes')
      .then(res => {
        setFixedRoutes(res.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingRoutes(false));
  }, []);

  const templeLoc = locations.find(l => 
    l.name.toLowerCase().includes('kollur') || 
    l.name.toLowerCase().includes('temple')
  ) || locations[0];

  const airportLoc = locations.find(l => 
    l.type === 'AIRPORT' || 
    l.name.toLowerCase().includes('airport') || 
    l.name.toLowerCase().includes('ixe')
  );

  const udupiLoc = locations.find(l => 
    l.name.toLowerCase().includes('udupi') || 
    l.name.toLowerCase().includes('krishna')
  );

  const murudeshwarLoc = locations.find(l => 
    l.name.toLowerCase().includes('murudeshwar')
  );

  const byndoorLoc = locations.find(l => 
    l.name.toLowerCase().includes('byndoor')
  );

  return (
    <div className="space-y-4 text-black">
      {/* Sub-Tab Switcher Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-neutral-100 rounded-2xl border border-neutral-200 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setSubTab('fixed')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'fixed'
              ? 'bg-black text-white shadow-sm'
              : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Fixed Rates</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('intercity')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'intercity'
              ? 'bg-black text-white shadow-sm'
              : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
          }`}
        >
          <Landmark className="w-3.5 h-3.5" />
          <span>Intercity</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('airport')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'airport'
              ? 'bg-black text-white shadow-sm'
              : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
          }`}
        >
          <Plane className="w-3.5 h-3.5" />
          <span>Airport</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('rent')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
            subTab === 'rent'
              ? 'bg-black text-white shadow-sm'
              : 'text-neutral-600 hover:text-black hover:bg-neutral-200/60'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Rent Hourly</span>
        </button>
      </div>

      {/* ─── TAB 1: FIXED RATE ROUTES ─── */}
      {subTab === 'fixed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
            <span className="font-semibold text-neutral-700">Official Admin Fixed Routes</span>
            <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Flat pricing
            </span>
          </div>

          {loadingRoutes ? (
            <div className="p-6 text-center text-xs text-neutral-400 bg-neutral-50 rounded-2xl border border-neutral-100">
              Loading admin verified fixed routes...
            </div>
          ) : fixedRoutes.length === 0 ? (
            <div className="p-6 text-center text-xs text-neutral-500 bg-neutral-50 rounded-2xl border border-neutral-100">
              No fixed route rules configured by admin yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[360px] overflow-y-auto no-scrollbar pr-0.5">
              {fixedRoutes.map(route => {
                const origin = route.originLocationId || templeLoc;
                const destination = route.destinationLocationId || udupiLoc || locations[1];
                const catName = route.vehicleCategoryId?.name || 'AC Cab';

                return (
                  <div
                    key={route._id}
                    className="p-3.5 rounded-2xl border border-neutral-200 hover:border-black bg-white hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900 truncate">
                          <span>{origin?.name?.split('(')[0].trim()}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                          <span className="text-black">{destination?.name?.split('(')[0].trim()}</span>
                        </div>
                        <p className="text-[11px] text-neutral-500 line-clamp-1">
                          {route.description || `Guaranteed flat fare • Up to ${route.includedKm || 50} km`}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded-md font-semibold">
                            {catName}
                          </span>
                          {route.roundTripPrice && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-bold border border-emerald-200">
                              RT: ₹{route.roundTripPrice.toLocaleString()}
                            </span>
                          )}
                          {route.tollIncluded && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-sky-50 text-sky-700 rounded-md font-medium border border-sky-200">
                              ✓ Tolls Incl.
                            </span>
                          )}
                          {route.freeWaitingMinutes && route.freeWaitingMinutes > 0 ? (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md font-medium border border-amber-200">
                              ✓ {route.freeWaitingMinutes}m Free Wait
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-black text-neutral-900">
                          ₹{route.fixedPrice.toLocaleString()}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (origin && destination) {
                              onSelectFixedRoute({
                                origin,
                                destination,
                                vehicleCategoryId: route.vehicleCategoryId?._id,
                                fixedPrice: route.fixedPrice,
                                ruleName: route.name,
                                tripType: 'LOCAL',
                              });
                            }
                          }}
                          className="mt-1 px-3 py-1 bg-black group-hover:bg-neutral-800 text-white text-xs font-bold rounded-lg transition-colors active:scale-95 shadow-xs"
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: INTERCITY & PILGRIMAGE OUTSTATION ─── */}
      {subTab === 'intercity' && (
        <div className="space-y-3">
          {/* Trip Mode Switcher (One-Way vs Round-Trip) */}
          <div className="flex items-center justify-between bg-neutral-100 p-1 rounded-xl border border-neutral-200">
            <button
              type="button"
              onClick={() => setIntercityTripMode('ONE_WAY')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                intercityTripMode === 'ONE_WAY' ? 'bg-white text-black shadow-xs' : 'text-neutral-500'
              }`}
            >
              One-Way Drop
            </button>
            <button
              type="button"
              onClick={() => setIntercityTripMode('ROUND_TRIP')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                intercityTripMode === 'ROUND_TRIP' ? 'bg-white text-black shadow-xs' : 'text-neutral-500'
              }`}
            >
              Round-Trip with Wait
            </button>
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto no-scrollbar">
            {/* Udupi Matha */}
            {udupiLoc && (
              <div className="p-3.5 rounded-2xl border border-neutral-200 bg-white hover:border-black transition-all flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-neutral-900">
                    <Landmark className="w-3.5 h-3.5 text-amber-600" />
                    <span>Udupi Sri Krishna Matha</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Approx 80 km • 1 hr 45 min drive
                  </p>
                  <span className="text-[10px] text-neutral-400">
                    {intercityTripMode === 'ROUND_TRIP' ? 'Same day return • 2 hrs darshan wait' : 'Direct one-way cab'}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-black text-neutral-900">
                    ₹{intercityTripMode === 'ROUND_TRIP' ? '3,800' : '2,200'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (templeLoc) {
                        onSelectFixedRoute({
                          origin: templeLoc,
                          destination: udupiLoc,
                          fixedPrice: intercityTripMode === 'ROUND_TRIP' ? 3800 : 2200,
                          ruleName: `Kollur to Udupi ${intercityTripMode === 'ROUND_TRIP' ? 'Round Trip' : 'One Way'}`,
                          tripType: 'OUTSTATION',
                        });
                      }
                    }}
                    className="mt-1 px-3 py-1 bg-black text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-all active:scale-95"
                  >
                    Select
                  </button>
                </div>
              </div>
            )}

            {/* Murudeshwar */}
            {murudeshwarLoc && (
              <div className="p-3.5 rounded-2xl border border-neutral-200 bg-white hover:border-black transition-all flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-neutral-900">
                    <Landmark className="w-3.5 h-3.5 text-blue-600" />
                    <span>Murudeshwar Shiva Temple & Beach</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Approx 65 km • Coastal scenic route
                  </p>
                  <span className="text-[10px] text-neutral-400">
                    {intercityTripMode === 'ROUND_TRIP' ? 'Return darshan tour' : 'Direct coastal drop'}
                  </span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-black text-neutral-900">
                    ₹{intercityTripMode === 'ROUND_TRIP' ? '3,400' : '1,900'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (templeLoc) {
                        onSelectFixedRoute({
                          origin: templeLoc,
                          destination: murudeshwarLoc,
                          fixedPrice: intercityTripMode === 'ROUND_TRIP' ? 3400 : 1900,
                          ruleName: `Kollur to Murudeshwar ${intercityTripMode === 'ROUND_TRIP' ? 'Round Trip' : 'One Way'}`,
                          tripType: 'OUTSTATION',
                        });
                      }
                    }}
                    className="mt-1 px-3 py-1 bg-black text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-all active:scale-95"
                  >
                    Select
                  </button>
                </div>
              </div>
            )}

            {/* Byndoor Station */}
            {byndoorLoc && (
              <div className="p-3.5 rounded-2xl border border-neutral-200 bg-white hover:border-black transition-all flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-xs text-neutral-900">
                    <Car className="w-3.5 h-3.5 text-purple-600" />
                    <span>Byndoor Railway Station Connect</span>
                  </div>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    Approx 28 km • 35 min drive
                  </p>
                  <span className="text-[10px] text-neutral-400">Direct train link</span>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-black text-neutral-900">
                    ₹{intercityTripMode === 'ROUND_TRIP' ? '1,500' : '850'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (templeLoc) {
                        onSelectFixedRoute({
                          origin: templeLoc,
                          destination: byndoorLoc,
                          fixedPrice: intercityTripMode === 'ROUND_TRIP' ? 1500 : 850,
                          ruleName: `Kollur to Byndoor Station`,
                          tripType: 'OUTSTATION',
                        });
                      }
                    }}
                    className="mt-1 px-3 py-1 bg-black text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-all active:scale-95"
                  >
                    Select
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: AIRPORT TRANSFERS ─── */}
      {subTab === 'airport' && (
        <div className="space-y-3">
          <div className="bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-2xl p-4 shadow-md space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full border border-blue-400/30">
                  Official Airport Service
                </span>
                <h3 className="text-sm font-black mt-1">Mangalore Int'l Airport (IXE)</h3>
                <p className="text-xs text-neutral-300">
                  Direct transfer to/from Kollur Sri Mookambika Temple
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-neutral-400">Guaranteed</span>
                <div className="text-xl font-black text-white">₹3,800</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-300 pt-1 border-t border-neutral-700/60">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Flight delay wait included</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Toll & luggage assistance</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (templeLoc && (airportLoc || locations[1])) {
                    onSelectFixedRoute({
                      origin: templeLoc,
                      destination: airportLoc || locations[1],
                      fixedPrice: 3800,
                      ruleName: 'Kollur Temple to Mangalore Airport Transfer',
                      tripType: 'AIRPORT_TRANSFER',
                    });
                  }
                }}
                className="flex-1 py-2.5 bg-white text-black font-bold text-xs rounded-xl hover:bg-neutral-100 transition-all text-center shadow-xs active:scale-95"
              >
                Book Airport Drop (To IXE)
              </button>

              <button
                type="button"
                onClick={() => {
                  if (templeLoc && (airportLoc || locations[1])) {
                    onSelectFixedRoute({
                      origin: airportLoc || locations[1],
                      destination: templeLoc,
                      fixedPrice: 3800,
                      ruleName: 'Mangalore Airport to Kollur Temple Pickup',
                      tripType: 'AIRPORT_TRANSFER',
                    });
                  }
                }}
                className="flex-1 py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white font-bold text-xs rounded-xl transition-all text-center border border-neutral-600 active:scale-95"
              >
                Book Airport Pickup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: HOURLY RENTAL (RENT) ─── */}
      {subTab === 'rent' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
            <span className="font-semibold text-neutral-700">Dedicated Cab with Chauffeur</span>
            <span className="text-[11px] text-neutral-400">Multiple stops included</span>
          </div>

          <div className="space-y-2.5">
            {/* 2h / 20km */}
            <div className="p-3.5 rounded-2xl border border-neutral-200 bg-white hover:border-black transition-all flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-black">2 Hours • 20 km</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-700 font-bold rounded">
                    Local Darshan
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Kollur Temple darshan, Souparnika holy dip, local mathas
                </p>
                <p className="text-[10px] text-neutral-400">Extra: ₹18/km • ₹150/hr</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-black text-neutral-900">₹600</div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectRentalPackage({
                      hours: 2,
                      km: 20,
                      title: '2 Hours / 20 km Local Rental',
                      basePrice: 600,
                    });
                  }}
                  className="mt-1 px-3 py-1 bg-black text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-all active:scale-95"
                >
                  Rent Cab
                </button>
              </div>
            </div>

            {/* 4h / 40km */}
            <div className="p-3.5 rounded-2xl border border-neutral-200 bg-white hover:border-black transition-all flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-black">4 Hours • 40 km</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded border border-blue-200">
                    Half Day Tour
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Temple rituals + Maravanthe Beach / Mookambika Sanctuary
                </p>
                <p className="text-[10px] text-neutral-400">Extra: ₹18/km • ₹150/hr</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-black text-neutral-900">₹1,200</div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectRentalPackage({
                      hours: 4,
                      km: 40,
                      title: '4 Hours / 40 km Half-Day Rental',
                      basePrice: 1200,
                    });
                  }}
                  className="mt-1 px-3 py-1 bg-black text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-all active:scale-95"
                >
                  Rent Cab
                </button>
              </div>
            </div>

            {/* 8h / 80km */}
            <div className="p-3.5 rounded-2xl border border-neutral-200 bg-white hover:border-black transition-all flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-black">8 Hours • 80 km</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-bold rounded border border-emerald-200">
                    Full Day Sightseeing
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500">
                  Kodachadri Base + Souparnika + Coastal temples circuit
                </p>
                <p className="text-[10px] text-neutral-400">Extra: ₹18/km • ₹150/hr</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-base font-black text-neutral-900">₹2,400</div>
                <button
                  type="button"
                  onClick={() => {
                    onSelectRentalPackage({
                      hours: 8,
                      km: 80,
                      title: '8 Hours / 80 km Full-Day Rental',
                      basePrice: 2400,
                    });
                  }}
                  className="mt-1 px-3 py-1 bg-black text-white text-xs font-bold rounded-lg hover:bg-neutral-800 transition-all active:scale-95"
                >
                  Rent Cab
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
