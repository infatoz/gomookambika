import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { UberSearchCard, LocationOption } from '@/components/UberSearchCard';
import { FullPageLocationSearch, FixedRoutePricingRule } from '@/components/FullPageLocationSearch';
import { UberRideSelector, VehicleCategoryItem, FareEstimateData, getVehicleImage } from '@/components/UberRideSelector';
import { UberTripTracking, ActiveBookingData } from '@/components/UberTripTracking';
import { UberLoginModal } from '@/components/UberLoginModal';
import { UberVehiclesModal } from '@/components/UberVehiclesModal';
import { UberScheduleModal } from '@/components/UberScheduleModal';
import { api, AuthState } from '@/lib/api';
import { toast } from '@/lib/toast';
import { customerChime } from '@/lib/chime';
import { setupCustomerPushNotifications } from '@/lib/pushNotifications';
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
  ArrowRightLeft,
  ShieldCheck,
  CheckCircle2,
  Phone,
  Building2,
  HelpCircle,
  Users,
  Briefcase,
  Fuel,
  Compass,
  Landmark,
  Train,
  Plane,
  Mountain,
  Bus,
  Star,
  Check,
  ChevronDown,
} from 'lucide-react';

interface UberBookingPageProps {
  auth: AuthState;
  onUpdateAuth: (token: string, user: { name?: string; phone: string; email?: string; profilePhoto?: string }) => void;
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

  // Top booking card ref for smooth scrolling
  const bookingCardRef = useRef<HTMLDivElement>(null);

  // 1. Fetch dynamic platform locations, vehicle categories, and fixed routes
  useEffect(() => {
    // 1. Fetch active admin-verified platform locations
    api
      .get<{ data: LocationOption[] }>('/locations?status=ACTIVE')
      .then(res => {
        const locs = res.data || [];
        setLocations(locs);
        if (locs.length > 0) {
          // Requirement: By default show the pickup location that added earlier/oldest in the platform
          const sorted = [...locs].sort((a: any, b: any) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            if (timeA && timeB) return timeA - timeB;
            return String(a._id || '').localeCompare(String(b._id || ''));
          });
          const oldestLoc = sorted[0];
          setSelectedPickupLoc(oldestLoc);
          setPickupText(oldestLoc.name);
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

  const lastStatusRef = useRef<string | null>(null);
  const lastDriverIdRef = useRef<string | null>(null);

  // Poll & sync for any ongoing active booking
  const checkActiveBooking = useCallback(async () => {
    if (!auth.token) return;
    try {
      let b: ActiveBookingData | null = null;
      if (activeBooking?._id) {
        const res = await api.get<{ data: ActiveBookingData }>(
          `/bookings/${activeBooking._id}`,
          auth.token
        );
        b = res.data || null;
      }

      if (!b) {
        const res = await api.get<{ data: ActiveBookingData[] }>(
          '/bookings?status=CONFIRMED,PENDING,SEARCHING_DRIVER,DRIVER_ASSIGNED,DRIVER_ACCEPTED,DRIVER_ARRIVING,DRIVER_ARRIVED,TRIP_STARTED,TRIP_COMPLETED&limit=1',
          auth.token
        );
        if (res.data && res.data.length > 0) {
          const first = res.data[0];
          if (!(first.status === 'TRIP_COMPLETED' && first.paymentStatus === 'PAID')) {
            b = first;
          }
        }
      }

      if (b) {
        const prevStatus = lastStatusRef.current;
        const prevDriver = lastDriverIdRef.current;
        const currentDriverId = b.assignedDriverId
          ? typeof b.assignedDriverId === 'object'
            ? (b.assignedDriverId as any)._id || b.assignedDriverId.name
            : b.assignedDriverId
          : null;

        if (prevStatus && prevStatus !== b.status) {
          if (b.status === 'TRIP_COMPLETED') {
            customerChime.playSuccessChime();
          } else {
            customerChime.playUpdateChime();
          }
        } else if (!prevDriver && currentDriverId) {
          customerChime.playUpdateChime();
        }

        lastStatusRef.current = b.status;
        lastDriverIdRef.current = currentDriverId;

        setActiveBooking(b);
        setViewMode('active_trip');
      }
    } catch {
      // Ignored
    }
  }, [auth.token, activeBooking?._id]);

  useEffect(() => {
    if (auth.token) {
      setupCustomerPushNotifications(auth).catch(() => {});
    }
  }, [auth]);

  // Real-time socket events for live ride updates
  useEffect(() => {
    if (!auth.token) return;

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.VITE_API_BASE_URL
        ? import.meta.env.VITE_API_BASE_URL.replace(/\/api.*$/, '')
        : undefined);

    const socket = io(socketUrl, {
      auth: { token: auth.token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 5,
    });

    socket.on('booking:driver:assigned', (data: any) => {
      customerChime.playUpdateChime();
      toast.success('Captain Allocated!', 'A verified temple taxi has been assigned to your ride.');
      checkActiveBooking();
    });

    socket.on('booking:status:changed', (data: any) => {
      if (data.status === 'TRIP_COMPLETED') {
        customerChime.playSuccessChime();
        toast.success('Trip Completed!', 'Thank you for traveling with Go Mookambika.');
      } else if (data.status === 'DRIVER_ARRIVED') {
        customerChime.playUpdateChime();
        toast.info('Captain Arrived!', 'Your driver is waiting at your pickup location.');
      } else if (data.status === 'TRIP_STARTED') {
        customerChime.playUpdateChime();
        toast.info('Trip Started', 'Have a safe and blessed journey.');
      } else {
        customerChime.playUpdateChime();
      }
      checkActiveBooking();
    });

    return () => {
      socket.disconnect();
    };
  }, [auth.token, checkActiveBooking]);

  // Check active booking on mount and periodic interval
  useEffect(() => {
    checkActiveBooking();
    const interval = setInterval(checkActiveBooking, 7000);
    return () => clearInterval(interval);
  }, [checkActiveBooking]);

  // Helper to swap pickup & drop locations
  const handleSwapLocations = () => {
    const prevPText = pickupText;
    const prevDText = dropText;
    const prevPLoc = selectedPickupLoc;
    const prevDLoc = selectedDropLoc;

    setPickupText(prevDText || 'Kollur Sri Mookambika Temple');
    setSelectedPickupLoc(prevDLoc);
    setDropText(prevPText);
    setSelectedDropLoc(prevPLoc);

    toast.info('Locations Swapped', 'Pickup and destination have been reversed.');

    if (viewMode === 'vehicles') {
      fetchFareEstimate(undefined, prevDLoc, prevPLoc);
    }
  };

  // Fetch fare estimate from server
  const fetchFareEstimate = async (
    targetCategory?: VehicleCategoryItem,
    customPickup?: LocationOption | null,
    customDrop?: LocationOption | null
  ) => {
    const cat = targetCategory || selectedCategory;
    if (!cat) return;

    const activePickup = customPickup !== undefined ? customPickup : selectedPickupLoc;
    const activeDrop = customDrop !== undefined ? customDrop : selectedDropLoc;

    setLoadingEstimate(true);
    setBookingError('');

    const pLat = activePickup?.geoPoint?.coordinates?.[1] || 13.8647;
    const pLng = activePickup?.geoPoint?.coordinates?.[0] || 74.8142;
    const dLat = activeDrop?.geoPoint?.coordinates?.[1] || 13.865;
    const dLng = activeDrop?.geoPoint?.coordinates?.[0] || 74.815;

    const isMongoId = (val?: string) => Boolean(val && /^[0-9a-fA-F]{24}$/.test(val));
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
          platformFee: fb.platformFee ?? fb.serviceFee,
          serviceFee: fb.serviceFee,
          platformFeeEnabled: fb.platformFeeEnabled,
          platformFeeName: fb.platformFeeName,
          tax: fb.tax,
          taxName: fb.taxName,
          taxRate: fb.taxRate,
          nightCharge: fb.nightFare || fb.nightCharge,
          waitingCharge: fb.waitingCharge,
          currency: 'INR',
          isFixedFare: res.data.isFixedFare ?? fb.isFixedFare ?? false,
          appliedRuleName: res.data.appliedRule || fb.appliedRuleName,
          ratePerKm: res.data.ratePerKm || cat.ratePerKm || 18,
        });
      }
    } catch {
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
        taxName: 'GST (5%)',
        platformFee: 0,
        platformFeeEnabled: false,
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
    bookingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
    bookingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Execute Booking
  const executeBooking = async (tokenOverride?: string) => {
    const activeToken = tokenOverride || auth.token;
    if (!activeToken) {
      setPendingBookingTrigger(true);
      setLoginModalOpen(true);
      return;
    }

    if (!selectedCategory) {
      setBookingError('Please select a vehicle category');
      return;
    }

    const pLat = selectedPickupLoc?.geoPoint?.coordinates?.[1] || 13.8647;
    const pLng = selectedPickupLoc?.geoPoint?.coordinates?.[0] || 74.8142;
    const dLat = selectedDropLoc?.geoPoint?.coordinates?.[1] || 13.865;
    const dLng = selectedDropLoc?.geoPoint?.coordinates?.[0] || 74.815;

    const isMongoId = (val?: string) => Boolean(val && /^[0-9a-fA-F]{24}$/.test(val));
    const pLocId = isMongoId(selectedPickupLoc?._id) ? selectedPickupLoc?._id : undefined;
    const dLocId = isMongoId(selectedDropLoc?._id) ? selectedDropLoc?._id : undefined;

    setBookingLoading(true);
    setBookingError('');

    try {
      const scheduledDateTime = getScheduledDateTime();

      const payload = {
        pickupLocation: {
          address: pickupText || 'Kollur Sri Mookambika Temple',
          latitude: pLat,
          longitude: pLng,
          locationId: pLocId,
        },
        dropLocation: {
          address: dropText || 'Customer Destination',
          latitude: dLat,
          longitude: dLng,
          locationId: dLocId,
        },
        vehicleCategoryId: selectedCategory._id,
        tripType: 'ONE_WAY',
        paymentOption: paymentMethod === 'ONLINE' ? 'ONLINE' : 'CASH',
        scheduledAt: scheduledDateTime ? scheduledDateTime.toISOString() : undefined,
      };

      const res = await api.post<{ success: boolean; data: ActiveBookingData }>(
        '/bookings',
        payload,
        activeToken
      );

      if (res.data) {
        customerChime.playSuccessChime();
        setActiveBooking(res.data);
        setViewMode('active_trip');
        const scheduleInfo = getScheduledLabel();
        toast.success(
          isScheduled ? 'Ride Scheduled Successfully!' : 'Ride Request Placed!',
          isScheduled && scheduleInfo
            ? `Your booking is confirmed for ${scheduleInfo}.`
            : isScheduled
            ? `Your booking is confirmed for ${scheduledDate} at ${scheduledTime}.`
            : 'Looking for the nearest verified temple taxi...'
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to complete booking. Please try again.';
      setBookingError(msg);
      toast.error('Booking Failed', msg);
    } finally {
      setBookingLoading(false);
      setPendingBookingTrigger(false);
    }
  };

  const handleLoginSuccess = (
    token: string,
    user: { name?: string; phone: string; email?: string; profilePhoto?: string }
  ) => {
    onUpdateAuth(token, user);
    if (pendingBookingTrigger) {
      executeBooking(token);
    }
  };

  // Curated prominent pilgrimage routes for quick 1-tap booking
  const curatedPilgrimRoutes = [
    {
      title: 'Byndoor Mookambika Rd Station',
      subtitle: 'Nearest Railway Station • 28 km',
      fare: '₹750',
      tag: 'Train Connect',
      icon: Train,
      fromName: 'Kollur Sri Mookambika Temple',
      toName: 'Byndoor Mookambika Road Railway Station',
    },
    {
      title: 'Udupi Sri Krishna Matha',
      subtitle: 'Heritage Temple Town • 75 km',
      fare: '₹2,200',
      tag: 'Pilgrimage Circuit',
      icon: Landmark,
      fromName: 'Kollur Sri Mookambika Temple',
      toName: 'Udupi Sri Krishna Matha',
    },
    {
      title: 'Mangalore Int’l Airport (IXE)',
      subtitle: 'Airport Transfer • 135 km',
      fare: '₹3,800',
      tag: 'Airport Cab',
      icon: Plane,
      fromName: 'Kollur Sri Mookambika Temple',
      toName: 'Mangalore International Airport (IXE)',
    },
    {
      title: 'Kundapura Town & Bus Stand',
      subtitle: 'Coastal Highway NH-66 • 38 km',
      fare: '₹1,200',
      tag: 'Popular Route',
      icon: Bus,
      fromName: 'Kollur Sri Mookambika Temple',
      toName: 'Kundapura Town',
    },
    {
      title: 'Sigandur Chowdeshwari Temple',
      subtitle: 'Sharavathi Launch Crossing • 45 km',
      fare: '₹1,800',
      tag: 'Ghat Journey',
      icon: Mountain,
      fromName: 'Kollur Sri Mookambika Temple',
      toName: 'Sigandur Chowdeshwari Temple',
    },
    {
      title: 'Murudeshwar Shiva Temple',
      subtitle: 'Giant Shiva Statue & Beach • 65 km',
      fare: '₹2,500',
      tag: 'Day Excursion',
      icon: Landmark,
      fromName: 'Kollur Sri Mookambika Temple',
      toName: 'Murudeshwar Shiva Temple',
    },
  ];

  return (
    <div className="w-full min-h-[calc(100vh-65px)] bg-neutral-100/60 flex flex-col overflow-y-auto">
      {/* ─── 1. HERO SECTION & INTEGRATED BOOKING MODULE ─── */}
      <section className="w-full bg-gradient-to-b from-white via-neutral-50 to-neutral-100 border-b border-neutral-200/80 px-4 pt-6 pb-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Hero Header Banner */}
          <div className="text-center space-y-2 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold tracking-wide uppercase shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Official Temple Taxi Service • Govt. Reg: KA-UD-TA-2024-089</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-neutral-900 tracking-tight leading-tight">
              Kollur Mookambika Temple & Coastal Taxi Service
            </h1>
            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
              Zero surge pricing • 100% AC fleets • Queue-dispatched verified local captains • Direct driver UPI/Cash payment
            </p>
          </div>

          {/* ─── THE BOOKING MODULE CARD ─────────────────────── */}
          <div
            ref={bookingCardRef}
            className="w-full max-w-xl mx-auto bg-white rounded-3xl p-5 md:p-6 shadow-xl border border-neutral-200 space-y-4"
          >
            {/* Panel Top Nav Bar (Back + Timing Segment) */}
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                {viewMode === 'vehicles' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('search')}
                    className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors text-black active:scale-95"
                    aria-label="Back to search"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <h2 className="font-extrabold text-sm sm:text-base text-neutral-900 tracking-tight">
                  {viewMode === 'search'
                    ? 'Where are you travelling?'
                    : viewMode === 'vehicles'
                    ? 'Choose Vehicle Category'
                    : 'Active Trip Status'}
                </h2>
              </div>

              {/* Requirement: Show schedule booking option tab just after now */}
              <div className="inline-flex items-center p-1 bg-neutral-100 rounded-xl border border-neutral-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsScheduled(false)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !isScheduled
                      ? 'bg-black text-white shadow-xs'
                      : 'text-neutral-600 hover:text-black hover:bg-white/60'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Now</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(true)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isScheduled
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-neutral-600 hover:text-black hover:bg-white/60'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[130px] sm:max-w-none">
                    {isScheduled ? getScheduledLabel() : 'Schedule'}
                  </span>
                </button>
              </div>
            </div>

            {bookingError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 flex items-center gap-2">
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
                  selectedPickupLoc={selectedPickupLoc}
                  selectedDropLoc={selectedDropLoc}
                  onSelectDropLocation={loc => {
                    setSelectedDropLoc(loc);
                    setDropText(loc.name);
                  }}
                  onSelectPickupLocation={loc => {
                    setSelectedPickupLoc(loc);
                    setPickupText(loc.name);
                  }}
                  onSwapLocations={handleSwapLocations}
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

            {/* VIEW MODE 2: VEHICLE CATEGORIES & ESTIMATES */}
            {viewMode === 'vehicles' && (
              <div className="space-y-4">
                {/* Route Pill with Swap Option */}
                <div className="p-3 rounded-2xl bg-neutral-100/90 border border-neutral-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="flex flex-col items-center shrink-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                      <span className="w-0.5 h-3.5 bg-neutral-300 my-0.5" />
                      <span className="w-2.5 h-2.5 rounded-xs bg-black" />
                    </div>
                    <div className="min-w-0 text-xs">
                      <div className="font-bold text-neutral-900 truncate">
                        {pickupText}
                      </div>
                      <div className="font-bold text-neutral-900 truncate">
                        {dropText || 'Select destination'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleSwapLocations}
                      className="p-1.5 rounded-lg bg-white hover:bg-neutral-200 border border-neutral-200 text-neutral-700 transition-colors shadow-2xs"
                      title="Swap pickup and drop"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInitialField('drop');
                        setFullSearchOpen(true);
                      }}
                      className="px-2.5 py-1 text-[11px] font-bold text-neutral-800 bg-white hover:bg-neutral-50 rounded-lg border border-neutral-300 transition-colors shadow-2xs"
                    >
                      Change
                    </button>
                  </div>
                </div>

                {/* Ride Selector */}
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

            {/* VIEW MODE 3: ACTIVE LIVE TRIP HUD */}
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
      </section>

      {/* ─── 2. LANDING PAGE: GUARANTEED FIXED ROUTE PILGRIMAGE FARES ─── */}
      <section className="w-full max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Transparent Association Fares</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight mt-0.5">
              Popular Temple & Transit Routes
            </h2>
            <p className="text-xs text-neutral-500">
              Approved flat rates from Kollur Sri Mookambika Temple. Click any route to book instantly.
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
            Zero Surge Guarantee
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {curatedPilgrimRoutes.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                onClick={() => {
                  const matchDest = locations.find(l =>
                    l.name.toLowerCase().includes(item.title.toLowerCase().split(' ')[0])
                  );
                  const pLoc = selectedPickupLoc || { _id: '', name: item.fromName };
                  const dLoc = matchDest || { _id: '', name: item.toName };
                  handleSelectRoute(pLoc, dLoc);
                }}
                className="p-4 rounded-2xl bg-white border border-neutral-200 hover:border-black cursor-pointer transition-all hover:shadow-md group active:scale-[0.98] flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-[10px] font-bold text-neutral-700 uppercase tracking-wider">
                      {item.tag}
                    </span>
                    <span className="font-mono font-black text-base text-neutral-900">
                      {item.fare}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5 pt-1">
                    <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-neutral-800 shrink-0 group-hover:scale-105 transition-transform">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-xs sm:text-sm text-neutral-900 leading-tight">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-neutral-500 mt-0.5">{item.subtitle}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-neutral-500">From Kollur Temple</span>
                  <span className="font-bold text-black group-hover:underline flex items-center gap-1">
                    <span>Book Taxi</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── 3. LANDING PAGE: VERIFIED ASSOCIATION FLEET SHOWCASE ─── */}
      <section className="w-full bg-white border-y border-neutral-200/80 px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-5">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
              Verified Association Fleet
            </h2>
            <p className="text-xs text-neutral-500">
              Clean, air-conditioned commercial taxis inspected by Sri Mookambika Taxi Association
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                name: 'Sedan Cab',
                model: 'Dzire Tour / Etios',
                capacity: '4 Passengers • 2 Bags',
                rate: 'From ₹18 / km',
                img: '/images/SedanComfort.png',
                desc: 'Ideal for couples & small families on pilgrim routes.',
              },
              {
                name: 'SUV / MPV',
                model: 'Maruti Ertiga / Carens',
                capacity: '6 Passengers • 3 Bags',
                rate: 'From ₹22 / km',
                img: '/images/SuvBlackDriver.png',
                desc: 'Spacious 6-seater with ample boot space for luggage.',
              },
              {
                name: 'Premium Mountain SUV',
                model: 'Toyota Innova Crysta',
                capacity: '7 Passengers • 4 Bags',
                rate: 'From ₹28 / km',
                img: '/images/SuvBlackDriver.png',
                desc: 'Maximum comfort for ghat journeys & long outstation tours.',
              },
              {
                name: 'Group Pilgrimage',
                model: 'Force Tempo Traveller',
                capacity: '12-17 Seats • AC',
                rate: 'Official Tariff',
                img: '/images/MinivanLuggage-169-0.png',
                desc: 'Family bhajan groups & temple yatras across Coastal Karnataka.',
              },
            ].map(cab => (
              <div
                key={cab.name}
                onClick={() => {
                  const targetCat = categories.find(c =>
                    c.name.toLowerCase().includes(cab.name.toLowerCase().split(' ')[0])
                  );
                  if (targetCat) setSelectedCategory(targetCat);
                  bookingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 hover:border-black transition-all hover:shadow-md cursor-pointer flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="h-24 flex items-center justify-center p-2">
                    <img
                      src={cab.img}
                      alt={cab.name}
                      className="max-h-20 w-auto object-contain hover:scale-105 transition-transform"
                    />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-neutral-900">{cab.name}</h3>
                    <p className="text-[11px] font-semibold text-neutral-600">{cab.model}</p>
                    <p className="text-[10px] text-neutral-500 mt-1">{cab.capacity}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-200 flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-neutral-900">{cab.rate}</span>
                  <span className="font-bold text-black text-[11px] hover:underline">Select</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. LANDING PAGE: THE ASSOCIATION ADVANTAGE ─────────── */}
      <section className="w-full max-w-5xl mx-auto px-4 py-8 space-y-5">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight">
            Why Pilgrims Choose Go Mookambika
          </h2>
          <p className="text-xs text-neutral-500">
            Government registered tourist taxi society operating ethically since 2004
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-neutral-900">Zero Surge Guarantee</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Never pay 2x or 3x surge multipliers during Navaratri or monsoon. Transparent rates approved by Regional Transport Authority.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Mountain className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-neutral-900">Ghat & Hill Specialists</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Every driver is a local resident with 10+ years experience navigating Kodachadri peak ghats and coastal highways safely.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-neutral-900">Queue Fair Dispatch</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Trips are dispatched to queued drivers at the stand in FIFO rotation. Zero arbitrary ride cancellations or driver haggling.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-neutral-200 shadow-2xs space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-sm text-neutral-900">24x7 Control Room</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Direct telephone support from our physical association office at Car Street, Kollur Temple for emergency assistance and luggage tracking.
            </p>
          </div>
        </div>
      </section>

      {/* ─── 5. LANDING PAGE: 3 EASY STEPS TO RIDE ──────────────── */}
      <section className="w-full bg-neutral-900 text-white px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              How Go Mookambika Works
            </h2>
            <p className="text-xs text-neutral-400">
              Simple 3-step digital dispatch powered by Sri Mookambika Taxi Union
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-neutral-800/80 border border-white/[0.08] space-y-2">
              <div className="w-8 h-8 rounded-full bg-white text-black font-black text-sm flex items-center justify-center">
                1
              </div>
              <h3 className="font-bold text-sm text-white">Choose Your Destination</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Select your pickup stand and drop location. Book instantly or schedule in advance for early morning Byndoor trains or temple darshan.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-800/80 border border-white/[0.08] space-y-2">
              <div className="w-8 h-8 rounded-full bg-white text-black font-black text-sm flex items-center justify-center">
                2
              </div>
              <h3 className="font-bold text-sm text-white">Instant Queue Allocation</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                The next queued captain at Kollur Stand accepts your trip. You receive their name, mobile number, vehicle number, and 4-digit ride OTP.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-neutral-800/80 border border-white/[0.08] space-y-2">
              <div className="w-8 h-8 rounded-full bg-white text-black font-black text-sm flex items-center justify-center">
                3
              </div>
              <h3 className="font-bold text-sm text-white">Peaceful Travel & Settlement</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Enjoy your sacred pilgrimage. On trip completion, pay the official flat fare directly to the driver via cash or bank UPI QR.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 6. LANDING PAGE: 24x7 HELPLINE & STAND LOCATIONS ──── */}
      <section className="w-full max-w-5xl mx-auto px-4 py-8 space-y-4">
        <div className="p-5 rounded-3xl bg-white border border-neutral-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="space-y-1.5 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 uppercase tracking-wider">
              <Building2 className="w-4 h-4" />
              <span>Sri Mookambika Tourist Taxi Association</span>
            </div>
            <h3 className="text-lg sm:text-xl font-extrabold text-neutral-900">
              Need assistance or early morning train pickup?
            </h3>
            <p className="text-xs text-neutral-500 max-w-lg">
              Our 24x7 association control room is stationed right at Car Street, Kollur Temple. Speak to our duty manager anytime.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0 w-full md:w-auto">
            <a
              href="tel:+919481200000"
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-black hover:bg-neutral-800 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
            >
              <Phone className="w-4 h-4" />
              <span>Call Helpline: +91 94812 00000</span>
            </a>
            <a
              href="tel:112"
              className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Police SOS: 112</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── 7. LANDING PAGE: OFFICIAL ASSOCIATION FOOTER ───────── */}
      <footer className="w-full bg-neutral-950 text-neutral-400 px-4 py-8 border-t border-white/[0.08] text-xs">
        <div className="max-w-5xl mx-auto space-y-4 text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Go Mookambika"
                className="h-10 w-auto object-contain shrink-0"
              />
              <div>
                <div className="font-extrabold text-sm text-white">Go Mookambika</div>
                <div className="text-[11px] text-neutral-500">
                  Sri Mookambika Tourist Taxi Association • Reg: KA-UD-TA-2024-089
                </div>
              </div>
            </div>
            <div className="text-[11px] text-neutral-400">
              Office: Car Street, Near Mookambika Temple, Kollur, Udupi Dist, Karnataka - 576220
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-500">
            <div>© {new Date().getFullYear()} Sri Mookambika Tourist Taxi Association. All rights reserved.</div>
            <div className="flex items-center gap-4">
              <span>Govt. Approved Tariffs</span>
              <span>•</span>
              <span>24x7 Control Room</span>
              <span>•</span>
              <span>Pilgrim Safety Verified</span>
            </div>
          </div>
        </div>
      </footer>

      {/* ─── MODALS & SHEETS ─────────────────────────────────── */}
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

      {/* In-Context Login Modal */}
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
