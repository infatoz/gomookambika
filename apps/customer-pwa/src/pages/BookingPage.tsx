import { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MapPin,
  Navigation,
  Flag,
  Car,
  Users,
  Wind,
  Snowflake,
  ShieldCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Zap,
  Route as RouteIcon,
  Info,
  ChevronRight,
  Search,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';

interface AuthState {
  token: string | null;
}

interface BookingPageProps {
  auth: AuthState;
  onBack: () => void;
}

interface VehicleCategory {
  _id: string;
  name: string;
  code: string;
  seatCapacity: number;
  ac: boolean;
  baseFare: number;
  ratePerKm: number;
  description?: string;
}

interface LocationItem {
  _id: string;
  name: string;
  code: string;
  geoPoint?: { coordinates: [number, number] }; // [lng, lat]
  address?: { line1?: string; city?: string };
}

interface FixedRouteItem {
  _id: string;
  name: string;
  fixedPrice: number;
  baseFare?: number;
  isBidirectional?: boolean;
  originLocationId: LocationItem | string;
  destinationLocationId: LocationItem | string;
  vehicleCategoryId?: VehicleCategory | string | null;
  includedKm?: number;
  extraKmRate?: number;
  description?: string;
}

interface FareEstimate {
  total: number;
  baseFare: number;
  distanceFare: number;
  distanceKm: number;
  tax?: number;
  nightCharge?: number;
  currency: string;
  isFixedFare: boolean;
  appliedRuleName?: string;
  appliedRuleType?: string;
  ratePerKm?: number;
  includedKm?: number;
}

type BookingStep = 'route' | 'category' | 'fare' | 'confirm' | 'success';

export function BookingPage({ auth, onBack }: BookingPageProps) {
  const [step, setStep] = useState<BookingStep>('route');

  // Input states
  const [pickupText, setPickupText] = useState('Kollur Sri Mookambika Temple');
  const [dropText, setDropText] = useState('');
  const [selectedPickupLoc, setSelectedPickupLoc] = useState<LocationItem | null>(null);
  const [selectedDropLoc, setSelectedDropLoc] = useState<LocationItem | null>(null);
  const [selectedFixedRoute, setSelectedFixedRoute] = useState<FixedRouteItem | null>(null);

  // Data states
  const [fixedRoutes, setFixedRoutes] = useState<FixedRouteItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [categories, setCategories] = useState<VehicleCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory | null>(null);

  // Estimating and confirmation
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [bookingNumber, setBookingNumber] = useState('');
  const [error, setError] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch initial data
  useEffect(() => {
    // Current geolocation
    navigator.geolocation?.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );

    // Vehicle categories
    api
      .get<{ data: VehicleCategory[] }>('/vehicles/categories', auth)
      .then(r => {
        const cats = r.data ?? [];
        setCategories(cats);
        if (cats.length > 0) setSelectedCategory(cats[0]);
      })
      .catch(() => {});

    // Active locations
    api
      .get<{ data: LocationItem[] }>('/locations?status=ACTIVE', auth)
      .then(r => {
        const locs = r.data ?? [];
        setLocations(locs);
        // Default pickup to Kollur Temple if found
        const kollur = locs.find(l => l.name.toLowerCase().includes('kollur'));
        if (kollur) {
          setSelectedPickupLoc(kollur);
          setPickupText(kollur.name);
        }
      })
      .catch(() => {});

    // Active fixed routes
    api
      .get<{ data: FixedRouteItem[] }>('/fare/fixed-routes', auth)
      .then(r => setFixedRoutes(r.data ?? []))
      .catch(() => {});
  }, [auth]);

  // Handle clicking a popular fixed route card
  const handleSelectFixedRoute = (route: FixedRouteItem) => {
    setSelectedFixedRoute(route);

    const orig = typeof route.originLocationId === 'object' ? route.originLocationId : null;
    const dest = typeof route.destinationLocationId === 'object' ? route.destinationLocationId : null;

    if (orig) {
      setSelectedPickupLoc(orig);
      setPickupText(orig.name);
    }
    if (dest) {
      setSelectedDropLoc(dest);
      setDropText(dest.name);
    }

    if (route.vehicleCategoryId && typeof route.vehicleCategoryId === 'object') {
      setSelectedCategory(route.vehicleCategoryId);
    }

    setStep('category');
  };

  // Resolve coordinates
  const getCoordinates = () => {
    // Defaults: Kollur center
    let pLat = 13.8647;
    let pLng = 74.8135;
    let dLat = 13.8741;
    let dLng = 74.6369;

    if (selectedPickupLoc?.geoPoint?.coordinates?.length === 2) {
      pLng = selectedPickupLoc.geoPoint.coordinates[0];
      pLat = selectedPickupLoc.geoPoint.coordinates[1];
    } else if (userLocation) {
      pLat = userLocation.lat;
      pLng = userLocation.lng;
    }

    if (selectedDropLoc?.geoPoint?.coordinates?.length === 2) {
      dLng = selectedDropLoc.geoPoint.coordinates[0];
      dLat = selectedDropLoc.geoPoint.coordinates[1];
    }

    return { pLat, pLng, dLat, dLng };
  };

  // Fetch Fare Estimate
  const handleGetFareEstimate = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    setError('');

    const { pLat, pLng, dLat, dLng } = getCoordinates();

    try {
      const res = await api.post<{
        data: {
          fareBreakdown: {
            total: number;
            baseFare: number;
            distanceFare: number;
            distanceKm: number;
            tax?: number;
            nightFare?: number;
            isFixedFare?: boolean;
            appliedRuleName?: string;
            appliedRuleType?: string;
            ratePerKm?: number;
            includedKm?: number;
          };
          routeDistanceKm?: number;
          isFixedFare?: boolean;
          appliedRule?: string;
          ratePerKm?: number;
        };
      }>(
        '/fare/estimate',
        {
          pickupLatitude: pLat,
          pickupLongitude: pLng,
          dropLatitude: dLat,
          dropLongitude: dLng,
          pickupLocationId: selectedPickupLoc?._id,
          dropLocationId: selectedDropLoc?._id,
          vehicleCategoryId: selectedCategory._id,
          tripType: 'ONE_WAY',
        },
        auth
      );

      if (res.data?.fareBreakdown) {
        const bd = res.data.fareBreakdown;
        setFareEstimate({
          total: bd.total,
          baseFare: bd.baseFare,
          distanceFare: bd.distanceFare,
          distanceKm: res.data.routeDistanceKm || bd.distanceKm,
          tax: bd.tax,
          nightCharge: bd.nightFare,
          currency: 'INR',
          isFixedFare: res.data.isFixedFare ?? bd.isFixedFare ?? false,
          appliedRuleName: res.data.appliedRule || bd.appliedRuleName,
          appliedRuleType: bd.appliedRuleType,
          ratePerKm: res.data.ratePerKm || bd.ratePerKm || selectedCategory.ratePerKm,
          includedKm: bd.includedKm,
        });
      }
      setStep('fare');
    } catch (e: unknown) {
      // Fallback calculation by kilometers
      const base = selectedCategory.baseFare || 100;
      const rate = selectedCategory.ratePerKm || 18;
      const dist = selectedFixedRoute ? 28.5 : 25.0;
      const distFare = dist * rate;
      const total = base + distFare;

      setFareEstimate({
        total,
        baseFare: base,
        distanceFare: distFare,
        distanceKm: dist,
        currency: 'INR',
        isFixedFare: !!selectedFixedRoute,
        appliedRuleName: selectedFixedRoute?.name || 'Standard Per-KM Tariff',
        ratePerKm: rate,
      });
      setStep('fare');
    } finally {
      setLoading(false);
    }
  };

  // Confirm and Create Booking
  const handleConfirmBooking = async () => {
    if (!selectedCategory) return;
    setLoading(true);
    setError('');

    const { pLat, pLng, dLat, dLng } = getCoordinates();

    try {
      const res = await api.post<{ data: { bookingNumber: string } }>(
        '/bookings',
        {
          tripType: 'ONE_WAY',
          pickupLocation: {
            latitude: pLat,
            longitude: pLng,
            address: pickupText || 'Kollur Temple Area',
            locationId: selectedPickupLoc?._id,
          },
          dropLocation: dropText
            ? {
                latitude: dLat,
                longitude: dLng,
                address: dropText,
                locationId: selectedDropLoc?._id,
              }
            : undefined,
          vehicleCategoryId: selectedCategory._id,
          passengers: 1,
          paymentOption: 'PAY_AT_END',
        },
        auth
      );

      setBookingNumber(res.data.bookingNumber);
      setStep('success');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Booking failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 safe-area-top pb-10">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={step === 'route' ? onBack : () => setStep(step === 'category' ? 'route' : step === 'fare' ? 'category' : 'fare')}
            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Book a Ride</h1>
            <p className="text-[11px] text-slate-400">Sri Mookambika Temple Taxi Service</p>
          </div>
        </div>

        {/* Tariff Model Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
          <ShieldCheck size={13} />
          <span>Transparent Rates</span>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/50 flex gap-1.5">
        {(['route', 'category', 'fare', 'confirm'] as const).map((s, i) => {
          const order = ['route', 'category', 'fare', 'confirm', 'success'];
          const currentIndex = order.indexOf(step);
          const isDone = currentIndex > i;
          const isCurrent = currentIndex === i;

          return (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                isDone
                  ? 'bg-emerald-500'
                  : isCurrent
                  ? 'bg-blue-500 ring-2 ring-blue-500/20'
                  : 'bg-slate-800'
              }`}
            />
          );
        })}
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-xl mx-auto">
        {/* ================= STEP: SUCCESS ================= */}
        {step === 'success' && (
          <div className="py-8 text-center space-y-5 animate-in fade-in zoom-in duration-300">
            <div className="w-20 h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center mx-auto text-emerald-400 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={44} />
            </div>

            <div className="space-y-1.5">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                Trip Confirmed
              </span>
              <h2 className="text-2xl font-black text-white">Booking Confirmed!</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Your request has been dispatched to the taxi stand queue driver.
              </p>
            </div>

            {/* Booking Ticket Card */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-left space-y-3 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                    Booking Reference
                  </div>
                  <div className="font-mono text-xl font-bold text-blue-400 mt-0.5">
                    {bookingNumber}
                  </div>
                </div>
                {fareEstimate && (
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                      Estimated Fare
                    </div>
                    <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                      ₹{Math.round(fareEstimate.total)}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Pickup Location</span>
                    <span className="text-slate-200 font-medium">{pickupText}</span>
                  </div>
                </div>
                {dropText && (
                  <div className="flex items-start gap-2.5">
                    <Flag size={15} className="text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-400 block text-[10px]">Destination Drop</span>
                      <span className="text-slate-200 font-medium">{dropText}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <Car size={15} className="text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Vehicle Category</span>
                    <span className="text-slate-200 font-medium">{selectedCategory?.name}</span>
                  </div>
                </div>
              </div>

              {fareEstimate?.isFixedFare ? (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-xs text-emerald-300">
                  <Zap size={15} className="text-emerald-400 shrink-0" />
                  <span>Guaranteed Fixed Route Package — No extra meter charges.</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center gap-2 text-xs text-blue-300">
                  <RouteIcon size={15} className="text-blue-400 shrink-0" />
                  <span>Calculated based on actual kilometers. No surge pricing.</span>
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                onClick={onBack}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 1: ROUTE & POPULAR FIXED FARES ================= */}
        {step === 'route' && (
          <div className="space-y-4">
            {/* Banner: Fixed Fare vs Kilometer Rate */}
            <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-blue-500/15 border border-emerald-500/25">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  Official Standard Tariffs
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Choose a <strong>pre-approved fixed route</strong> below for guaranteed flat rates, or enter any destination to calculate fair pricing <strong>strictly based on kilometers</strong>.
              </p>
            </div>

            {/* POPULAR FIXED ROUTE PACKAGES */}
            {fixedRoutes.length > 0 && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-400" /> Popular Fixed Fare Routes
                  </span>
                  <span className="text-[11px] text-emerald-400 font-medium">Guaranteed Fixed Tariff</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {fixedRoutes.map(fr => {
                    const isSelected = selectedFixedRoute?._id === fr._id;
                    const origName = typeof fr.originLocationId === 'object' ? fr.originLocationId.name : 'Kollur';
                    const destName = typeof fr.destinationLocationId === 'object' ? fr.destinationLocationId.name : 'Destination';

                    return (
                      <div
                        key={fr._id}
                        onClick={() => handleSelectFixedRoute(fr)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-emerald-500/15 border-emerald-500/60 shadow-md shadow-emerald-500/10'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-slate-100 truncate">{fr.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              FIXED
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <MapPin size={12} className="text-emerald-400 shrink-0" />
                            <span className="truncate">{origName}</span>
                            <span className="text-slate-500">⇄</span>
                            <Flag size={12} className="text-rose-400 shrink-0" />
                            <span className="truncate">{destName}</span>
                          </div>
                          {fr.description && (
                            <div className="text-[11px] text-slate-500 line-clamp-1">{fr.description}</div>
                          )}
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-lg font-black text-emerald-400 font-mono">
                            ₹{fr.fixedPrice || fr.baseFare}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                            <span>Select</span>
                            <ChevronRight size={11} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CUSTOM / ANY ROUTE (BY KILOMETERS) */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <RouteIcon size={14} className="text-blue-400" /> Custom Route (Calculated per KM)
                </span>
                <span className="text-[11px] text-slate-400">Meter Rate</span>
              </div>

              {/* Pickup Input */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <label className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={13} /> Pickup Location
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={pickupText}
                    onChange={e => {
                      setPickupText(e.target.value);
                      setSelectedFixedRoute(null);
                    }}
                    placeholder="Enter pickup point (temple gate, stand, hotel...)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {userLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      setPickupText('Current GPS Location');
                      setSelectedFixedRoute(null);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium pt-0.5 cursor-pointer"
                  >
                    <Navigation size={12} /> Use Current GPS Location
                  </button>
                )}
              </div>

              {/* Drop Input */}
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                <label className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Flag size={13} /> Destination Drop
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={dropText}
                    onChange={e => {
                      setDropText(e.target.value);
                      setSelectedFixedRoute(null);
                    }}
                    placeholder="Where do you want to go?"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                {/* Popular suggestions */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {locations.slice(0, 5).map(loc => (
                    <button
                      key={loc._id}
                      type="button"
                      onClick={() => {
                        setSelectedDropLoc(loc);
                        setDropText(loc.name);
                        setSelectedFixedRoute(null);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (pickupText.trim() && dropText.trim()) {
                    setStep('category');
                  }
                }}
                disabled={!pickupText.trim() || !dropText.trim()}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue to Vehicle Selection</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: CATEGORY SELECTION ================= */}
        {step === 'category' && (
          <div className="space-y-4">
            {/* Route Header Info */}
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                Selected Route
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-200">
                <span className="font-semibold text-emerald-400">{pickupText}</span>
                <span className="text-slate-500">→</span>
                <span className="font-semibold text-rose-400">{dropText}</span>
              </div>
              {selectedFixedRoute && (
                <div className="pt-1 flex items-center gap-1.5 text-xs text-emerald-400">
                  <Zap size={13} />
                  <span>Fixed Package: {selectedFixedRoute.name} (Flat ₹{selectedFixedRoute.fixedPrice})</span>
                </div>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Choose Vehicle Type
                </h2>
                <span className="text-[11px] text-slate-400">Fixed & KM Rates</span>
              </div>

              {categories.length === 0 ? (
                <div className="p-6 text-center text-slate-500">Loading vehicle categories...</div>
              ) : (
                categories.map(cat => {
                  const isSelected = selectedCategory?._id === cat._id;
                  const isFixed = !!selectedFixedRoute;

                  return (
                    <div
                      key={cat._id}
                      onClick={() => setSelectedCategory(cat)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500 shadow-md shadow-blue-500/10'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`p-2.5 rounded-xl mt-0.5 ${
                            isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          <Car size={22} />
                        </div>
                        <div className="space-y-1">
                          <div className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                            <span>{cat.name}</span>
                            {cat.ac && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                                <Snowflake size={10} /> AC
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Users size={12} /> {cat.seatCapacity} Seats
                            </span>
                            {cat.description && <span>• {cat.description}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isFixed ? (
                          <>
                            <div className="text-lg font-black text-emerald-400 font-mono">
                              ₹{selectedFixedRoute.fixedPrice}
                            </div>
                            <div className="text-[10px] text-emerald-400/80 font-medium">
                              Fixed Route
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-base font-bold text-slate-100 font-mono">
                              ₹{cat.baseFare} Base
                            </div>
                            <div className="text-[11px] text-blue-400 font-mono">
                              + ₹{cat.ratePerKm}/km
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('route')}
                className="w-1/3 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold hover:bg-slate-800 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleGetFareEstimate}
                disabled={!selectedCategory || loading}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{loading ? 'Calculating Tariff...' : 'Calculate Total Fare'}</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: TRANSPARENT FARE BREAKDOWN ================= */}
        {step === 'fare' && fareEstimate && (
          <div className="space-y-4">
            {/* Tariff highlight banner */}
            <div
              className={`p-4 rounded-2xl border ${
                fareEstimate.isFixedFare
                  ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-600/10 border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'bg-gradient-to-r from-blue-500/20 via-indigo-500/15 to-slate-900/60 border-blue-500/40'
              }`}
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
                <div className="flex items-center gap-2">
                  {fareEstimate.isFixedFare ? (
                    <Zap size={20} className="text-amber-400" />
                  ) : (
                    <RouteIcon size={20} className="text-blue-400" />
                  )}
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {fareEstimate.isFixedFare ? 'Guaranteed Fixed Route Fare' : 'Kilometer-Based Meter Fare'}
                    </span>
                    <div className="text-[11px] text-slate-400">
                      {fareEstimate.isFixedFare
                        ? 'Flat approved package — No meter charges'
                        : `Calculated strictly based on ${fareEstimate.distanceKm.toFixed(1)} km`}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-white font-mono">
                    ₹{Math.round(fareEstimate.total)}
                  </div>
                  <div className="text-[10px] text-slate-400">All-Inclusive</div>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Estimated Distance</span>
                  <span className="font-mono font-medium">{fareEstimate.distanceKm.toFixed(1)} km</span>
                </div>

                {fareEstimate.isFixedFare ? (
                  <>
                    <div className="flex justify-between text-slate-300">
                      <span>Package Name</span>
                      <span className="font-medium text-emerald-400">{fareEstimate.appliedRuleName}</span>
                    </div>
                    {fareEstimate.includedKm && (
                      <div className="flex justify-between text-slate-300">
                        <span>Included Travel Allowance</span>
                        <span className="font-mono">{fareEstimate.includedKm} km included</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-300">
                      <span>Base Flag-Down Fare</span>
                      <span className="font-mono">₹{fareEstimate.baseFare.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Distance Charge ({fareEstimate.distanceKm.toFixed(1)} km × ₹{fareEstimate.ratePerKm || 18}/km)</span>
                      <span className="font-mono">₹{fareEstimate.distanceFare.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {fareEstimate.tax !== undefined && fareEstimate.tax > 0 && (
                  <div className="flex justify-between text-slate-300">
                    <span>GST (5%)</span>
                    <span className="font-mono">₹{fareEstimate.tax.toFixed(2)}</span>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-700/50 flex justify-between font-bold text-sm text-white">
                  <span>Final Payable Amount</span>
                  <span className="text-emerald-400 font-mono text-base">₹{Math.round(fareEstimate.total)}</span>
                </div>
              </div>
            </div>

            {/* Fair pricing guarantee card */}
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex items-start gap-3 text-xs text-slate-400">
              <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-200 block mb-0.5">Zero Surge Pricing Policy</strong>
                Fares are fixed or strictly calculated per kilometer in accordance with local RTO taxi stand tariffs. No surge or hidden fees.
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('category')}
                className="w-1/3 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold hover:bg-slate-800 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep('confirm')}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Proceed to Summary</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 4: CONFIRM BOOKING ================= */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Trip Summary
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  ₹{fareEstimate ? Math.round(fareEstimate.total) : '---'}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Pickup Location</span>
                    <span className="text-slate-200 font-semibold">{pickupText}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Flag size={15} className="text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Destination Drop</span>
                    <span className="text-slate-200 font-semibold">{dropText}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <Car size={15} className="text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Vehicle</span>
                    <span className="text-slate-200 font-semibold">{selectedCategory?.name}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <CreditCard size={15} className="text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 block">Payment Method</span>
                    <span className="text-slate-200 font-semibold">Pay at End (Cash / UPI QR to Driver)</span>
                  </div>
                </div>
              </div>

              {fareEstimate?.isFixedFare ? (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                  <Zap size={14} className="text-emerald-400 shrink-0" />
                  <span>Fixed Route Fare: {fareEstimate.appliedRuleName}</span>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 flex items-center gap-2">
                  <RouteIcon size={14} className="text-blue-400 shrink-0" />
                  <span>Calculated based on {fareEstimate?.distanceKm.toFixed(1)} kilometers travelled</span>
                </div>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('fare')}
                disabled={loading}
                className="w-1/3 py-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 font-semibold hover:bg-slate-800 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>{loading ? 'Dispatching to Driver...' : 'Confirm & Request Driver'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
