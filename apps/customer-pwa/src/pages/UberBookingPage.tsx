import { useState, useEffect, useCallback } from 'react';
import { UberMap } from '@/components/UberMap';
import { UberSearchCard, LocationOption } from '@/components/UberSearchCard';
import { FullPageLocationSearch, FixedRoutePricingRule } from '@/components/FullPageLocationSearch';
import { UberRideSelector, VehicleCategoryItem, FareEstimateData } from '@/components/UberRideSelector';
import { UberTripTracking, ActiveBookingData } from '@/components/UberTripTracking';
import { UberLoginModal } from '@/components/UberLoginModal';
import { UberVehiclesModal } from '@/components/UberVehiclesModal';
import { UberScheduleModal } from '@/components/UberScheduleModal';
import { api, AuthState } from '@/lib/api';
import {
  ArrowLeft,
  Clock,
  Car,
  AlertCircle,
  ChevronRight,
  Sparkles,
  Calendar,
  MapPin,
  Search,
} from 'lucide-react';

interface UberBookingPageProps {
  auth: AuthState;
  onUpdateAuth: (token: string, user: { name?: string; phone: string }) => void;
  onOpenGlobalLogin?: () => void;
  vehiclesModalOpen?: boolean;
  onToggleVehiclesModal?: (open: boolean) => void;
}

type BookingViewMode = 'search' | 'vehicles' | 'active_trip';

export function UberBookingPage({
  auth,
  onUpdateAuth,
  vehiclesModalOpen: externalVehiclesModalOpen,
  onToggleVehiclesModal,
}: UberBookingPageProps) {
  const [viewMode, setViewMode] = useState<BookingViewMode>('search');
  const [internalVehiclesModalOpen, setInternalVehiclesModalOpen] = useState(false);

  const isVehiclesModalOpen =
    externalVehiclesModalOpen !== undefined
      ? externalVehiclesModalOpen
      : internalVehiclesModalOpen;
  const setVehiclesModalOpen = (open: boolean) => {
    setInternalVehiclesModalOpen(open);
    onToggleVehiclesModal?.(open);
  };

  // Full Page Search Locations Modal State
  const [fullSearchOpen, setFullSearchOpen] = useState(false);
  const [searchInitialField, setSearchInitialField] = useState<'pickup' | 'drop'>('drop');

  // Schedule Ride State
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState('08:30');
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const getScheduledDateTime = useCallback((): Date | null => {
    if (!isScheduled) return null;
    try {
      const [y, m, d] = scheduledDate.split('-').map(Number);
      const [hrs, mins] = scheduledTime.split(':').map(Number);
      const dt = new Date(y, m - 1, d, hrs, mins);
      return isNaN(dt.getTime()) ? null : dt;
    } catch {
      return null;
    }
  }, [isScheduled, scheduledDate, scheduledTime]);

  const getScheduledLabel = useCallback((): string => {
    const dt = getScheduledDateTime();
    if (!dt) return '';
    return dt.toLocaleString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }, [getScheduledDateTime]);

  // Locations & Inputs
  const [pickupText, setPickupText] = useState('Kollur Sri Mookambika Temple');
  const [dropText, setDropText] = useState('');
  const [selectedPickupLoc, setSelectedPickupLoc] = useState<LocationOption | null>(null);
  const [selectedDropLoc, setSelectedDropLoc] = useState<LocationOption | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [fixedRoutes, setFixedRoutes] = useState<FixedRoutePricingRule[]>([]);

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

  // 1. Fetch dynamic platform locations, vehicle categories, and fixed routes
  useEffect(() => {
    // 1. Fetch active admin-verified platform locations
    api
      .get<{ data: LocationOption[] }>('/locations?status=ACTIVE')
      .then(res => {
        const locs = res.data || [];
        setLocations(locs);
        const temple = locs.find(
          l =>
            l.name.toLowerCase().includes('kollur') ||
            l.name.toLowerCase().includes('temple')
        );
        if (temple) {
          setSelectedPickupLoc(temple);
          setPickupText(temple.name);
        }
      })
      .catch(() => {});

    // 2. Fetch active platform vehicle categories
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

    // 3. Fetch active platform fixed routes & pricing rules
    api
      .get<{ data: FixedRoutePricingRule[] }>('/fares/fixed-routes')
      .then(res => {
        setFixedRoutes(res.data || []);
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
        '/bookings?status=CONFIRMED,PENDING,SEARCHING_DRIVER,DRIVER_ASSIGNED,DRIVER_ACCEPTED,DRIVER_ARRIVING,DRIVER_ARRIVED,TRIP_STARTED,TRIP_COMPLETED&limit=1',
        auth.token
      );
      if (res.data && res.data.length > 0) {
        const b = res.data[0];
        if (b.status === 'TRIP_COMPLETED' && b.paymentStatus === 'PAID') {
          // Already paid
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
    } else if (
      dropText.toLowerCase().includes('airport') ||
      dropText.toLowerCase().includes('ixe')
    ) {
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
    overridePickupLoc?: LocationOption | null,
    overrideDropLoc?: LocationOption | null
  ) => {
    const cat = targetCategory || selectedCategory || categories[0];
    if (!cat) return;
    setLoadingEstimate(true);
    setBookingError('');

    const isMongoId = (id?: string) =>
      typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

    const activePickup =
      overridePickupLoc !== undefined ? overridePickupLoc : selectedPickupLoc;
    const activeDrop =
      overrideDropLoc !== undefined ? overrideDropLoc : selectedDropLoc;

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
        tripType: 'ONE_WAY',
        scheduledAt: getScheduledDateTime()?.toISOString(),
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
      // Geodesic distance calculation as backup
      const dist = Math.max(
        5,
        Math.round(Math.hypot((dLat - pLat) * 111, (dLng - pLng) * 105))
      );
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
    setViewMode('vehicles');
    fetchFareEstimate(undefined);
  };

  // Handler when a route is chosen from FullPageLocationSearch or Fixed Route cards
  const handleSelectRoute = (
    pLoc: LocationOption,
    dLoc: LocationOption,
    preselectedCategoryId?: string
  ) => {
    setSelectedPickupLoc(pLoc);
    setPickupText(pLoc.name);
    setSelectedDropLoc(dLoc);
    setDropText(dLoc.name);

    let targetCat: VehicleCategoryItem | undefined;
    if (preselectedCategoryId) {
      targetCat = categories.find(c => c._id === preselectedCategoryId);
      if (targetCat) {
        setSelectedCategory(targetCat);
      }
    }

    setViewMode('vehicles');
    fetchFareEstimate(targetCat, pLoc, dLoc);
  };

  // Execute Booking
  const executeBooking = async (tokenOverride?: string) => {
    const activeToken = tokenOverride || auth.token;
    if (!activeToken) {
      setPendingBookingTrigger(true);
      setLoginModalOpen(true);
      return;
    }

    setBookingLoading(true);
    setBookingError('');

    const scheduledDt = getScheduledDateTime();
    const isMongoId = (id?: string) =>
      typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
    const pLocId = isMongoId(selectedPickupLoc?._id)
      ? selectedPickupLoc?._id
      : undefined;
    const dLocId = isMongoId(selectedDropLoc?._id)
      ? selectedDropLoc?._id
      : undefined;

    try {
      const res = await api.post<{
        success: boolean;
        data: {
          _id: string;
          bookingNumber: string;
          status: string;
          startOTP?: string;
          scheduledAt?: string;
          pickupLocation: any;
          dropLocation: any;
          fareSnapshot: any;
        };
      }>(
        '/bookings',
        {
          tripType: 'ONE_WAY',
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
          paymentOption: 'CASH',
          scheduledAt: scheduledDt ? scheduledDt.toISOString() : undefined,
        },
        activeToken
      );

      const newBooking = res.data;
      if (newBooking) {
        setActiveBooking({
          _id: newBooking._id,
          bookingNumber: newBooking.bookingNumber,
          status:
            newBooking.status ||
            (isScheduled ? 'CONFIRMED' : 'SEARCHING_DRIVER'),
          pickupLocation: newBooking.pickupLocation,
          dropLocation: newBooking.dropLocation,
          fareSnapshot: newBooking.fareSnapshot,
          startOTP: newBooking.startOTP,
          scheduledAt:
            newBooking.scheduledAt ||
            (scheduledDt ? scheduledDt.toISOString() : undefined),
        });
        setViewMode('active_trip');
      }
    } catch (e: unknown) {
      setBookingError(
        e instanceof Error
          ? e.message
          : 'Failed to place booking. Please try again.'
      );
    } finally {
      setBookingLoading(false);
      setPendingBookingTrigger(false);
    }
  };

  const handleLoginSuccess = (
    token: string,
    user: { name?: string; phone: string }
  ) => {
    onUpdateAuth(token, user);
    if (pendingBookingTrigger) {
      executeBooking(token);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-65px)] flex flex-col md:flex-row overflow-hidden bg-neutral-100">
      {/* ─── LEFT PANEL (DESKTOP: 460px Fixed, MOBILE: Responsive Bottom Card) ─── */}
      <div className="order-2 md:order-1 w-full md:w-[460px] md:h-full bg-white md:shadow-2xl z-30 flex flex-col justify-between overflow-hidden border-t md:border-t-0 md:border-r border-neutral-200">
        {/* Panel Header */}
        <div className="px-5 pt-3.5 pb-2.5 md:pt-4 flex items-center justify-between border-b border-neutral-100">
          <div className="flex items-center gap-2">
            {viewMode === 'vehicles' && (
              <button
                type="button"
                onClick={() => setViewMode('search')}
                className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center transition-colors text-black active:scale-95"
                aria-label="Back to search"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="font-extrabold text-base md:text-lg text-black tracking-tight">
              {viewMode === 'search'
                ? 'Where are you going?'
                : viewMode === 'vehicles'
                ? 'Select Vehicle Category'
                : 'Current Trip Status'}
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

          {/* VIEW MODE 1: SEARCH & ROUTE SELECTION */}
          {viewMode === 'search' && (
            <div className="space-y-3.5">
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
                onSelectRoute={handleSelectRoute}
                locations={locations}
                fixedRoutes={fixedRoutes}
                onProceedToVehicleSelection={handleProceedToVehicles}
                onOpenFullSearch={field => {
                  setSearchInitialField(field);
                  setFullSearchOpen(true);
                }}
              />
            </div>
          )}

          {/* VIEW MODE 2: VEHICLE CATEGORIES & LIVE PLATFORM PRICING */}
          {viewMode === 'vehicles' && (
            <div className="space-y-3">
              {/* Route Summary Pill */}
              <div className="p-3 rounded-2xl bg-neutral-100/90 border border-neutral-200 flex items-center justify-between gap-2 shadow-2xs">
                <div className="min-w-0 flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                    <span className="w-0.5 h-3 bg-neutral-400 my-0.5" />
                    <span className="w-2.5 h-2.5 rounded-xs bg-black" />
                  </div>
                  <div className="min-w-0 text-xs">
                    <div className="font-bold text-neutral-900 truncate">
                      {pickupText}
                    </div>
                    <div className="font-bold text-neutral-900 truncate">
                      {dropText || 'Destination'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSearchInitialField('drop');
                    setFullSearchOpen(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-neutral-700 bg-white hover:bg-neutral-50 rounded-lg border border-neutral-300 shrink-0 transition-colors shadow-2xs"
                >
                  Change
                </button>
              </div>

              {/* Vehicle Category Selector */}
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
                isScheduled={isScheduled}
                scheduledLabel={getScheduledLabel()}
                onOpenScheduleModal={() => setShowScheduleModal(true)}
              />
            </div>
          )}

          {/* VIEW MODE 3: ACTIVE TRIP HUD */}
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
              setDropText(
                `Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`
              );
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

      {/* Full Page Search Locations & Routes */}
      <FullPageLocationSearch
        isOpen={fullSearchOpen}
        onClose={() => setFullSearchOpen(false)}
        pickupText={pickupText}
        dropText={dropText}
        selectedPickupLoc={selectedPickupLoc}
        selectedDropLoc={selectedDropLoc}
        onSelectPickup={loc => {
          setSelectedPickupLoc(loc);
          setPickupText(loc.name);
        }}
        onSelectDrop={loc => {
          setSelectedDropLoc(loc);
          setDropText(loc.name);
          handleProceedToVehicles();
        }}
        onSelectRoute={handleSelectRoute}
        locations={locations}
        fixedRoutes={fixedRoutes}
        initialActiveInput={searchInitialField}
      />

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

      {/* Schedule Ride Date & Time Picker Modal */}
      <UberScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        selectedDate={scheduledDate}
        selectedTime={scheduledTime}
        onSaveSchedule={(date, time) => {
          setScheduledDate(date);
          setScheduledTime(time);
          setIsScheduled(true);
        }}
        onResetToNow={() => {
          setIsScheduled(false);
        }}
        isCurrentlyScheduled={isScheduled}
      />
    </div>
  );
}
