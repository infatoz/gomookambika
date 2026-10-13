import { useState, useEffect, useCallback } from 'react';
import { UberMap } from '@/components/UberMap';
import { UberSearchCard, LocationOption } from '@/components/UberSearchCard';
import { UberLocalRideCard } from '@/components/UberLocalRideCard';
import { UberRideSelector, VehicleCategoryItem, FareEstimateData } from '@/components/UberRideSelector';
import { UberTripTracking, ActiveBookingData } from '@/components/UberTripTracking';
import { UberLoginModal } from '@/components/UberLoginModal';
import { UberVehiclesModal } from '@/components/UberVehiclesModal';
import { api, AuthState } from '@/lib/api';
import { ArrowLeft, Clock, Car, Compass, AlertCircle, ChevronRight, Sparkles } from 'lucide-react';

interface UberBookingPageProps {
  auth: AuthState;
  onUpdateAuth: (token: string, user: { name?: string; phone: string }) => void;
  onOpenGlobalLogin?: () => void;
  activeService?: 'ride' | 'local';
  onChangeService?: (service: 'ride' | 'local') => void;
  vehiclesModalOpen?: boolean;
  onToggleVehiclesModal?: (open: boolean) => void;
}

type BookingViewMode = 'search' | 'vehicles' | 'active_trip';

export function UberBookingPage({
  auth,
  onUpdateAuth,
  activeService = 'ride',
  onChangeService,
  vehiclesModalOpen: externalVehiclesModalOpen,
  onToggleVehiclesModal,
}: UberBookingPageProps) {
  const [serviceType, setServiceType] = useState<'ride' | 'local'>(activeService);
  const [viewMode, setViewMode] = useState<BookingViewMode>('search');
  const [internalVehiclesModalOpen, setInternalVehiclesModalOpen] = useState(false);

  const isVehiclesModalOpen = externalVehiclesModalOpen !== undefined ? externalVehiclesModalOpen : internalVehiclesModalOpen;
  const setVehiclesModalOpen = (open: boolean) => {
    setInternalVehiclesModalOpen(open);
    onToggleVehiclesModal?.(open);
  };

  // Sync activeService if changed from outer nav
  useEffect(() => {
    if (activeService) {
      setServiceType(activeService);
    }
  }, [activeService]);

  // Trip Type State
  const [tripType, setTripType] = useState<string>('ONE_WAY');

  // Locations & Inputs
  const [pickupText, setPickupText] = useState('Kollur Sri Mookambika Temple');
  const [dropText, setDropText] = useState('');
  const [selectedPickupLoc, setSelectedPickupLoc] = useState<LocationOption | null>(null);
  const [selectedDropLoc, setSelectedDropLoc] = useState<LocationOption | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  // Vehicle Categories & Selection
  const [categories, setCategories] = useState<VehicleCategoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategoryItem | null>(null);

  // Fare estimation & Booking
  const [fareEstimate, setFareEstimate] = useState<FareEstimateData | null>(null);
  const [categoryEstimates, setCategoryEstimates] = useState<Record<string, FareEstimateData>>({});
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'ONLINE'>('CASH');
  const [bookingError, setBookingError] = useState('');

  // Active Live Trip Tracking
  const [activeBooking, setActiveBooking] = useState<ActiveBookingData | null>(null);

  // In-Context Login Sheet
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [pendingBookingTrigger, setPendingBookingTrigger] = useState(false);

  // Fetch Locations & Categories on Mount
  useEffect(() => {
    // 1. Fetch active admin-verified locations
    api
      .get<{ data: LocationOption[] }>('/locations?status=ACTIVE')
      .then(res => {
        const locs = res.data || [];
        setLocations(locs);
        const temple = locs.find(l => 
          l.name.toLowerCase().includes('kollur') || 
          l.name.toLowerCase().includes('temple')
        );
        if (temple) {
          setSelectedPickupLoc(temple);
          setPickupText(temple.name);
        }
      })
      .catch(() => {});

    // 2. Fetch vehicle categories
    api
      .get<{ data: VehicleCategoryItem[] }>('/vehicles/categories')
      .then(res => {
        const cats = res.data || [];
        setCategories(cats);
        if (cats.length > 0) {
          setSelectedCategory(cats[0]);
        }
      })
      .catch(() => {});
  }, []);

  // Poll for any ongoing active booking
  const checkActiveBooking = useCallback(async () => {
    if (!auth.token) return;
    try {
      if (activeBooking?._id) {
        const res = await api.get<{ data: ActiveBookingData }>(
          `/bookings/${activeBooking._id}`,
          auth.token
        );
        if (res.data) {
          setActiveBooking(res.data);
          return;
        }
      }

      const res = await api.get<{ data: ActiveBookingData[] }>(
        '/bookings?status=PENDING,SEARCHING_DRIVER,DRIVER_ASSIGNED,DRIVER_ACCEPTED,DRIVER_ARRIVING,DRIVER_ARRIVED,TRIP_STARTED,TRIP_COMPLETED&limit=1',
        auth.token
      );
      if (res.data && res.data.length > 0) {
        const b = res.data[0];
        // If it's TRIP_COMPLETED, only auto-show if not paid yet
        if (b.status === 'TRIP_COMPLETED' && b.paymentStatus === 'PAID') {
          // Already paid, do not intercept home screen
        } else {
          setActiveBooking(b);
          setViewMode('active_trip');
        }
      }
    } catch {
      // Ignored
    }
  }, [auth.token, activeBooking?._id]);

  useEffect(() => {
    checkActiveBooking();
    const pollInterval = viewMode === 'active_trip' ? 4000 : 10000;
    const timer = setInterval(checkActiveBooking, pollInterval);
    return () => clearInterval(timer);
  }, [checkActiveBooking, viewMode]);

  // Coordinates resolution
  const getCoordinates = () => {
    let pLat = 13.8647;
    let pLng = 74.8135;
    let dLat = 13.8741;
    let dLng = 74.6369;

    if (selectedPickupLoc?.geoPoint?.coordinates?.length === 2) {
      pLng = selectedPickupLoc.geoPoint.coordinates[0];
      pLat = selectedPickupLoc.geoPoint.coordinates[1];
    }

    if (selectedDropLoc?.geoPoint?.coordinates?.length === 2) {
      dLng = selectedDropLoc.geoPoint.coordinates[0];
      dLat = selectedDropLoc.geoPoint.coordinates[1];
    } else if (dropText.toLowerCase().includes('byndoor')) {
      dLat = 13.8741;
      dLng = 74.6369;
    } else if (dropText.toLowerCase().includes('murudeshwar')) {
      dLat = 14.0941;
      dLng = 74.4842;
    } else if (dropText.toLowerCase().includes('kundapura')) {
      dLat = 13.6263;
      dLng = 74.6938;
    } else if (dropText.toLowerCase().includes('airport') || dropText.toLowerCase().includes('ixe')) {
      dLat = 12.9613;
      dLng = 74.8893;
    } else if (dropText.toLowerCase().includes('udupi')) {
      dLat = 13.3409;
      dLng = 74.7525;
    }

    return {
      pickupCoords: { lat: pLat, lng: pLng },
      dropCoords: dropText ? { lat: dLat, lng: dLng } : null,
    };
  };

  const { pickupCoords, dropCoords } = getCoordinates();

  // Fetch Fare Estimate when proceeding to vehicle selection
  const fetchFareEstimate = async (
    targetCategory?: VehicleCategoryItem,
    overrideTripType?: string,
    overridePickupLoc?: LocationOption | null,
    overrideDropLoc?: LocationOption | null
  ) => {
    const cat = targetCategory || selectedCategory || categories[0];
    if (!cat) return;
    setLoadingEstimate(true);
    setBookingError('');

    const effectiveTripType = overrideTripType || tripType || 'ONE_WAY';
    const isMongoId = (id?: string) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    const activePickup = overridePickupLoc !== undefined ? overridePickupLoc : selectedPickupLoc;
    const activeDrop = overrideDropLoc !== undefined ? overrideDropLoc : selectedDropLoc;

    let pLat = 13.8647;
    let pLng = 74.8135;
    if (activePickup?.geoPoint?.coordinates?.length === 2) {
      pLng = activePickup.geoPoint.coordinates[0];
      pLat = activePickup.geoPoint.coordinates[1];
    } else if (pickupCoords) {
      pLat = pickupCoords.lat;
      pLng = pickupCoords.lng;
    }

    let dLat = 13.8741;
    let dLng = 74.6369;
    if (activeDrop?.geoPoint?.coordinates?.length === 2) {
      dLng = activeDrop.geoPoint.coordinates[0];
      dLat = activeDrop.geoPoint.coordinates[1];
    } else if (dropCoords) {
      dLat = dropCoords.lat;
      dLng = dropCoords.lng;
    }

    const pLocId = isMongoId(activePickup?._id) ? activePickup?._id : undefined;
    const dLocId = isMongoId(activeDrop?._id) ? activeDrop?._id : undefined;

    try {
      const res = await api.post<{
        success: boolean;
        data: {
          fareBreakdown?: any;
          routeDistanceKm?: number;
          estimatedDurationMinutes?: number;
          isFixedFare?: boolean;
          appliedRule?: string;
          ratePerKm?: number;
          categoryEstimates?: Record<string, FareEstimateData>;
        };
      }>('/fare/estimate', {
        pickupLatitude: pLat,
        pickupLongitude: pLng,
        dropLatitude: dLat,
        dropLongitude: dLng,
        pickupLocationId: pLocId,
        dropLocationId: dLocId,
        vehicleCategoryId: cat._id,
        tripType: effectiveTripType,
      });

      if (res.data?.categoryEstimates) {
        setCategoryEstimates(res.data.categoryEstimates);
      }

      const fb = res.data?.fareBreakdown;
      if (fb) {
        setFareEstimate({
          total: fb.total,
          baseFare: fb.baseFare,
          distanceFare: fb.distanceFare,
          distanceKm: res.data.routeDistanceKm ?? fb.distanceKm,
          tax: fb.tax,
          nightCharge: fb.nightFare || fb.nightCharge,
          waitingCharge: fb.waitingCharge,
          currency: 'INR',
          isFixedFare: res.data.isFixedFare ?? fb.isFixedFare ?? false,
          appliedRuleName: res.data.appliedRule || fb.appliedRuleName,
          ratePerKm: res.data.ratePerKm || cat.ratePerKm || 18,
        });
      }
    } catch {
      // Dynamic fallback calculated from geodesic distance
      const dist = Math.max(5, Math.round(Math.hypot((dLat - pLat) * 111, (dLng - pLng) * 105)));
      const base = cat.baseFare || 100;
      const rate = cat.ratePerKm || 18;
      const distanceFare = dist * rate;
      const subtotal = base + distanceFare;
      const tax = Math.round(subtotal * 0.05);
      setFareEstimate({
        total: subtotal + tax,
        baseFare: base,
        distanceFare,
        distanceKm: dist,
        tax,
        currency: 'INR',
        isFixedFare: false,
        appliedRuleName: 'Standard Tariff Rate',
        ratePerKm: rate,
      });
    } finally {
      setLoadingEstimate(false);
    }
  };

  const handleProceedToVehicles = () => {
    setTripType('ONE_WAY');
    setViewMode('vehicles');
    fetchFareEstimate(undefined, 'ONE_WAY');
  };

  // Handler when user selects a Fixed Route from Local Ride tab
  const handleSelectFixedRoute = (route: {
    origin: LocationOption;
    destination: LocationOption;
    vehicleCategoryId?: string;
    fixedPrice: number;
    ruleName: string;
    tripType: 'LOCAL' | 'ONE_WAY' | 'AIRPORT_TRANSFER' | 'OUTSTATION';
  }) => {
    setSelectedPickupLoc(route.origin);
    setPickupText(route.origin.name);
    setSelectedDropLoc(route.destination);
    setDropText(route.destination.name);
    setTripType(route.tripType);

    let targetCat = selectedCategory;
    if (route.vehicleCategoryId) {
      const matched = categories.find(c => c._id === route.vehicleCategoryId);
      if (matched) {
        targetCat = matched;
        setSelectedCategory(matched);
      }
    }

    setFareEstimate({
      total: route.fixedPrice,
      baseFare: route.fixedPrice,
      distanceFare: 0,
      distanceKm: 50,
      currency: 'INR',
      isFixedFare: true,
      appliedRuleName: route.ruleName,
    });

    setViewMode('vehicles');
    fetchFareEstimate(targetCat || undefined, route.tripType, route.origin, route.destination);
  };

  // Handler when user selects an Hourly Rental package from Local Ride tab
  const handleSelectRentalPackage = (pkg: {
    hours: number;
    km: number;
    title: string;
    basePrice: number;
    vehicleCategory?: VehicleCategoryItem;
  }) => {
    const defaultTemple = locations.find(l => 
      l.name.toLowerCase().includes('kollur') || 
      l.name.toLowerCase().includes('temple')
    ) || locations[0];

    if (defaultTemple) {
      setSelectedPickupLoc(defaultTemple);
      setPickupText(defaultTemple.name);
    }
    setSelectedDropLoc(null);
    setDropText(`${pkg.title} (Driver waits with you)`);
    setTripType('HOURLY_RENTAL');

    const targetCat = pkg.vehicleCategory || selectedCategory;
    if (pkg.vehicleCategory) {
      setSelectedCategory(pkg.vehicleCategory);
    }

    setFareEstimate({
      total: pkg.basePrice,
      baseFare: pkg.basePrice,
      distanceFare: 0,
      distanceKm: pkg.km,
      currency: 'INR',
      isFixedFare: true,
      appliedRuleName: pkg.title,
    });

    setViewMode('vehicles');
    fetchFareEstimate(targetCat || undefined, 'HOURLY_RENTAL', defaultTemple || null, null);
  };

  // Perform Booking with authentication check
  const executeBooking = async (overrideToken?: string) => {
    const activeToken = overrideToken || auth.token;
    if (!activeToken) {
      // Open in-context login sheet
      setPendingBookingTrigger(true);
      setLoginModalOpen(true);
      return;
    }

    setBookingLoading(true);
    setBookingError('');

    const isMongoId = (id?: string) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
    const pLocId = isMongoId(selectedPickupLoc?._id) ? selectedPickupLoc?._id : undefined;
    const dLocId = isMongoId(selectedDropLoc?._id) ? selectedDropLoc?._id : undefined;

    try {
      const res = await api.post<{
        success: boolean;
        data: {
          _id: string;
          bookingNumber: string;
          status: string;
          startOTP?: string;
          pickupLocation: any;
          dropLocation: any;
          fareSnapshot: any;
        };
      }>(
        '/bookings',
        {
          tripType: tripType || 'ONE_WAY',
          pickupLocation: {
            latitude: pickupCoords.lat,
            longitude: pickupCoords.lng,
            address: pickupText || 'Kollur Sri Mookambika Temple',
            locationId: pLocId,
          },
          dropLocation: dropText
            ? {
                latitude: dropCoords?.lat || pickupCoords.lat,
                longitude: dropCoords?.lng || pickupCoords.lng,
                address: dropText,
                locationId: dLocId,
              }
            : undefined,
          vehicleCategoryId: selectedCategory?._id || categories[0]?._id,
          passengers: 1,
          paymentOption: paymentMethod === 'CASH' ? 'CASH' : 'FULL_PAYMENT',
        },
        activeToken
      );

      const newBooking = res.data;
      if (newBooking) {
        setActiveBooking({
          _id: newBooking._id,
          bookingNumber: newBooking.bookingNumber,
          status: newBooking.status || 'SEARCHING_DRIVER',
          pickupLocation: newBooking.pickupLocation,
          dropLocation: newBooking.dropLocation,
          fareSnapshot: newBooking.fareSnapshot,
          startOTP: newBooking.startOTP,
        });
        setViewMode('active_trip');
      }
    } catch (e: unknown) {
      setBookingError(e instanceof Error ? e.message : 'Failed to place booking. Please try again.');
    } finally {
      setBookingLoading(false);
      setPendingBookingTrigger(false);
    }
  };

  const handleLoginSuccess = (token: string, user: { name?: string; phone: string }) => {
    onUpdateAuth(token, user);
    if (pendingBookingTrigger) {
      executeBooking(token);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-65px)] flex flex-col md:flex-row overflow-hidden bg-neutral-100">
      {/* ─── LEFT PANEL (DESKTOP: 440px Fixed, MOBILE: Slide-up Bottom Sheet) ─── */}
      <div className="order-2 md:order-1 w-full md:w-[460px] md:h-full bg-white md:shadow-2xl z-30 flex flex-col justify-between overflow-hidden border-t md:border-t-0 md:border-r border-neutral-200">
        {/* Panel Header */}
        <div className="px-5 pt-3.5 pb-2.5 md:pt-4 flex items-center justify-between border-b border-neutral-100">
          <div className="flex items-center gap-2">
            {viewMode === 'vehicles' && (
              <button
                type="button"
                onClick={() => setViewMode('search')}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors text-black"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-extrabold text-base md:text-lg text-black tracking-tight">
              {viewMode === 'search'
                ? serviceType === 'local'
                  ? 'Local Ride & Packages'
                  : 'Where are you going?'
                : viewMode === 'vehicles'
                ? 'Select ride category'
                : 'Current trip status'}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-medium">
            <Clock className="w-3.5 h-3.5" />
            <span>Now</span>
          </div>
        </div>

        {/* Panel Content Body */}
        <div className="p-5 flex-1 overflow-y-auto no-scrollbar">
          {bookingError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{bookingError}</span>
            </div>
          )}

          {viewMode === 'search' && (
            <>
              {/* Vehicles by Type Banner Card */}
              <div
                onClick={() => setVehiclesModalOpen(true)}
                className="flex items-center justify-between p-3 bg-neutral-50 hover:bg-neutral-100 rounded-2xl border border-neutral-200/90 mb-3.5 cursor-pointer transition-all active:scale-[0.99] group shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Car className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs md:text-sm font-bold text-neutral-900 flex items-center gap-2">
                      <span>Explore Vehicles by Type</span>
                      <span className="text-[10px] px-2 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-semibold border border-emerald-200">
                        Admin Fleet
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                      Sedan, SUV, Hatchback & Auto • View models & regulated fares
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs font-semibold text-neutral-500 group-hover:text-black shrink-0">
                  <span className="hidden sm:inline text-[11px]">View All</span>
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>

              {/* Service Mode Switcher Tabs (Point-to-Point vs Local Ride) */}
              <div className="flex items-center p-1 bg-neutral-100 rounded-2xl border border-neutral-200 mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setServiceType('ride');
                    onChangeService?.('ride');
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    serviceType === 'ride'
                      ? 'bg-white text-black shadow-xs'
                      : 'text-neutral-500 hover:text-black'
                  }`}
                >
                  <Car className="w-3.5 h-3.5" />
                  <span>Point to Point</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setServiceType('local');
                    onChangeService?.('local');
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    serviceType === 'local'
                      ? 'bg-white text-black shadow-xs'
                      : 'text-neutral-500 hover:text-black'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Local Ride</span>
                  <span className="text-[9px] px-1.5 py-0.2 bg-amber-400 text-black rounded-full font-bold">
                    Fixed
                  </span>
                </button>
              </div>

              {/* Service Tab Views */}
              {serviceType === 'ride' ? (
                <UberSearchCard
                  pickupText={pickupText}
                  onChangePickupText={setPickupText}
                  dropText={dropText}
                  onChangeDropText={setDropText}
                  onSelectDropLocation={loc => {
                    setSelectedDropLoc(loc);
                    setDropText(loc.name);
                  }}
                  onSelectPickupLocation={loc => {
                    setSelectedPickupLoc(loc);
                    setPickupText(loc.name);
                  }}
                  locations={locations}
                  onProceedToVehicleSelection={handleProceedToVehicles}
                />
              ) : (
                <UberLocalRideCard
                  locations={locations}
                  categories={categories}
                  onSelectFixedRoute={handleSelectFixedRoute}
                  onSelectRentalPackage={handleSelectRentalPackage}
                />
              )}
            </>
          )}

          {viewMode === 'vehicles' && (
            <UberRideSelector
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={cat => {
                setSelectedCategory(cat);
                if (categoryEstimates[cat._id]) {
                  setFareEstimate(categoryEstimates[cat._id]);
                } else {
                  fetchFareEstimate(cat);
                }
              }}
              fareEstimate={fareEstimate}
              categoryEstimates={categoryEstimates}
              loadingEstimate={loadingEstimate}
              onConfirmRide={() => executeBooking()}
              bookingLoading={bookingLoading}
              paymentMethod={paymentMethod}
              onChangePaymentMethod={setPaymentMethod}
              onOpenVehiclesModal={() => setVehiclesModalOpen(true)}
            />
          )}

          {viewMode === 'active_trip' && activeBooking && (
            <UberTripTracking
              booking={activeBooking}
              onClose={() => {
                setActiveBooking(null);
                setViewMode('search');
              }}
              onRefresh={checkActiveBooking}
            />
          )}
        </div>

        {/* Panel Bottom Footer info */}
        <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100 hidden md:flex items-center justify-between text-[11px] text-neutral-500">
          <span>Kollur Temple Taxi Association</span>
          <span>Regulated transparent fares</span>
        </div>
      </div>

      {/* ─── RIGHT PANEL: INTERACTIVE LEAFLET UBER MAP ─── */}
      <div className="order-1 md:order-2 flex-1 h-[45vh] md:h-full relative overflow-hidden">
        <UberMap
          pickupCoords={pickupCoords}
          dropCoords={dropCoords}
          pickupLocation={
            selectedPickupLoc
              ? {
                  name: selectedPickupLoc.name,
                  address: selectedPickupLoc.address?.city,
                  lat: pickupCoords.lat,
                  lng: pickupCoords.lng,
                }
              : {
                  name: pickupText,
                  lat: pickupCoords.lat,
                  lng: pickupCoords.lng,
                }
          }
          dropLocation={
            dropText && dropCoords
              ? {
                  name: selectedDropLoc?.name || dropText,
                  address: selectedDropLoc?.address?.city,
                  lat: dropCoords.lat,
                  lng: dropCoords.lng,
                }
              : null
          }
          adminLocations={locations}
          onSelectCoords={coords => {
            if (!dropText) {
              setDropText(`Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`);
            }
          }}
          onSelectLocation={(loc, type) => {
            if (type === 'pickup') {
              const matched = locations.find(l => l._id === loc._id);
              if (matched) {
                setSelectedPickupLoc(matched);
                setPickupText(matched.name);
              } else {
                setSelectedPickupLoc({
                  _id: loc._id || '',
                  name: loc.name,
                  geoPoint: { coordinates: [loc.lng, loc.lat] },
                });
                setPickupText(loc.name);
              }
            } else {
              const matched = locations.find(l => l._id === loc._id);
              if (matched) {
                setSelectedDropLoc(matched);
                setDropText(matched.name);
              } else {
                setSelectedDropLoc({
                  _id: loc._id || '',
                  name: loc.name,
                  geoPoint: { coordinates: [loc.lng, loc.lat] },
                });
                setDropText(loc.name);
              }
            }
          }}
          className="w-full h-full"
        />
      </div>

      {/* In-Context Login Modal (Shown seamlessly if booking as guest) */}
      <UberLoginModal
        isOpen={loginModalOpen}
        onClose={() => {
          setLoginModalOpen(false);
          setPendingBookingTrigger(false);
        }}
        onLoginSuccess={handleLoginSuccess}
        title="Log in to confirm your ride"
        subtitle="Verify with your mobile number to complete this booking"
      />

      {/* Vehicles by Type Platform Fleet Modal */}
      <UberVehiclesModal
        isOpen={isVehiclesModalOpen}
        onClose={() => setVehiclesModalOpen(false)}
        categories={categories}
        onSelectCategory={cat => {
          setSelectedCategory(cat);
          setViewMode('vehicles');
          fetchFareEstimate(cat);
        }}
      />
    </div>
  );
}
