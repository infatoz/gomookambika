import { useState, useEffect, useCallback } from 'react';
import { UberMap } from '@/components/UberMap';
import { UberSearchCard, LocationOption } from '@/components/UberSearchCard';
import { UberRideSelector, VehicleCategoryItem, FareEstimateData } from '@/components/UberRideSelector';
import { UberTripTracking, ActiveBookingData } from '@/components/UberTripTracking';
import { UberLoginModal } from '@/components/UberLoginModal';
import { api, AuthState } from '@/lib/api';
import { ArrowLeft, Clock, MapPin, Sparkles, AlertCircle } from 'lucide-react';

interface UberBookingPageProps {
  auth: AuthState;
  onUpdateAuth: (token: string, user: { name?: string; phone: string }) => void;
  onOpenGlobalLogin?: () => void;
}

type BookingViewMode = 'search' | 'vehicles' | 'active_trip';

export function UberBookingPage({
  auth,
  onUpdateAuth,
}: UberBookingPageProps) {
  const [viewMode, setViewMode] = useState<BookingViewMode>('search');

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
    // 1. Fetch active locations
    api
      .get<{ data: LocationOption[] }>('/locations?status=ACTIVE')
      .then(res => {
        const locs = res.data || [];
        setLocations(locs);
        const temple = locs.find(l => l.name.toLowerCase().includes('kollur') || l.name.toLowerCase().includes('temple'));
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
      const res = await api.get<{ data: ActiveBookingData[] }>(
        '/bookings?status=PENDING,SEARCHING_DRIVER,DRIVER_ASSIGNED,DRIVER_ACCEPTED,DRIVER_ARRIVING,DRIVER_ARRIVED,TRIP_STARTED&limit=1',
        auth
      );
      if (res.data && res.data.length > 0) {
        setActiveBooking(res.data[0]);
        setViewMode('active_trip');
      }
    } catch {
      // Ignored
    }
  }, [auth.token]);

  useEffect(() => {
    checkActiveBooking();
    const timer = setInterval(checkActiveBooking, 10000);
    return () => clearInterval(timer);
  }, [checkActiveBooking]);

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
    }

    return {
      pickupCoords: { lat: pLat, lng: pLng },
      dropCoords: dropText ? { lat: dLat, lng: dLng } : null,
    };
  };

  const { pickupCoords, dropCoords } = getCoordinates();

  // Fetch Fare Estimate when proceeding to vehicle selection
  const fetchFareEstimate = async (targetCategory?: VehicleCategoryItem) => {
    const cat = targetCategory || selectedCategory || categories[0];
    if (!cat) return;
    setLoadingEstimate(true);
    setBookingError('');

    try {
      const res = await api.post<{
        data: {
          fareBreakdown?: any;
          routeDistanceKm?: number;
          isFixedFare?: boolean;
          appliedRule?: string;
        };
      }>('/fare/estimate', {
        pickupLatitude: pickupCoords.lat,
        pickupLongitude: pickupCoords.lng,
        dropLatitude: dropCoords?.lat || 13.8741,
        dropLongitude: dropCoords?.lng || 74.6369,
        pickupLocationId: selectedPickupLoc?._id,
        dropLocationId: selectedDropLoc?._id,
        vehicleCategoryId: cat._id,
        tripType: 'ONE_WAY',
      });

      const fb = res.data?.fareBreakdown;
      if (fb) {
        setFareEstimate({
          total: fb.total,
          baseFare: fb.baseFare,
          distanceFare: fb.distanceFare,
          distanceKm: res.data.routeDistanceKm || fb.distanceKm || 28.5,
          tax: fb.tax,
          nightCharge: fb.nightFare,
          currency: 'INR',
          isFixedFare: res.data.isFixedFare ?? fb.isFixedFare ?? false,
          appliedRuleName: res.data.appliedRule || fb.appliedRuleName,
          ratePerKm: cat.ratePerKm || 18,
        });
      }
    } catch {
      // Fallback estimate for smooth UX
      const base = cat.baseFare || 100;
      const rate = cat.ratePerKm || 18;
      const dist = 28.5;
      setFareEstimate({
        total: Math.round(base + dist * rate),
        baseFare: base,
        distanceFare: Math.round(dist * rate),
        distanceKm: dist,
        currency: 'INR',
        isFixedFare: false,
        appliedRuleName: 'Standard Association Tariff',
        ratePerKm: rate,
      });
    } finally {
      setLoadingEstimate(false);
    }
  };

  const handleProceedToVehicles = () => {
    setViewMode('vehicles');
    fetchFareEstimate();
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

    try {
      const res = await api.post<{
        success: boolean;
        data: {
          _id: string;
          bookingNumber: string;
          status: string;
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
            locationId: selectedPickupLoc?._id,
          },
          dropLocation: dropText
            ? {
                latitude: dropCoords?.lat || 13.8741,
                longitude: dropCoords?.lng || 74.6369,
                address: dropText,
                locationId: selectedDropLoc?._id,
              }
            : undefined,
          vehicleCategoryId: selectedCategory?._id || categories[0]?._id,
          passengers: 1,
          paymentOption: paymentMethod === 'CASH' ? 'CASH' : 'ONLINE',
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
      {/* ─── LEFT PANEL (DESKTOP: 420px Fixed, MOBILE: Slide-up Bottom Sheet) ─── */}
      <div className="order-2 md:order-1 w-full md:w-[440px] md:h-full bg-white md:shadow-2xl z-30 flex flex-col justify-between overflow-hidden border-t md:border-t-0 md:border-r border-neutral-200">
        {/* Panel Header */}
        <div className="px-5 pt-3.5 pb-2 md:pt-5 flex items-center justify-between border-b border-neutral-100">
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
                ? 'Where are you going?'
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
          )}

          {viewMode === 'vehicles' && (
            <UberRideSelector
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={cat => {
                setSelectedCategory(cat);
                fetchFareEstimate(cat);
              }}
              fareEstimate={fareEstimate}
              loadingEstimate={loadingEstimate}
              onConfirmRide={() => executeBooking()}
              bookingLoading={bookingLoading}
              paymentMethod={paymentMethod}
              onChangePaymentMethod={setPaymentMethod}
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
          onSelectCoords={coords => {
            if (!dropText) {
              setDropText(`Lat: ${coords.lat.toFixed(4)}, Lng: ${coords.lng.toFixed(4)}`);
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
    </div>
  );
}
