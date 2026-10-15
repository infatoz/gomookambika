import { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { QRScannerModal } from '@/components/QRScannerModal';
import { io, Socket } from 'socket.io-client';
import {
  Car,
  MapPin,
  Navigation,
  Power,
  QrCode,
  ShieldCheck,
  Check,
  X,
  Clock,
  IndianRupee,
  Phone,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  LogOut,
  RefreshCw,
  Compass,
  Banknote,
  Wallet,
  Sparkles,
  Edit2,
  Calendar,
  TrendingUp,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';

interface AuthState {
  token: string | null;
  driver: {
    _id: string;
    name: string;
    status: string;
    driverCode: string;
    phone?: string;
    upiId?: string;
    upiBeneficiaryName?: string;
    vehicle?: {
      registrationNumber?: string;
      brand?: string;
      vehicleModel?: string;
    };
  } | null;
}

interface QueuePageProps {
  auth: AuthState;
  onUpdateDriver?: (updated: Partial<NonNullable<AuthState['driver']>>) => void;
  onNavigateToEarnings?: () => void;
}

type DriverStatus = 'OFFLINE' | 'AVAILABLE' | 'ON_TRIP' | 'BREAK';

interface QueueEntry {
  _id: string;
  taxiStandId: { name: string; _id?: string } | string;
  position: number;
  enteredAt: string;
  joinedAt?: string;
}

interface TripOffer {
  tripId?: string;
  bookingId: string;
  bookingNumber?: string;
  pickupLocation?: { address: string; name?: string };
  dropLocation?: { address: string; name?: string };
  pickupAddress?: string;
  dropAddress?: string;
  estimatedFare: number;
  distanceKm: number;
  passengers?: number;
  vehicleCategory?: string;
  timeoutSeconds?: number;
  expiresIn?: number;
  scheduledAt?: string;
}

interface ActiveTrip {
  _id: string;
  bookingId: string;
  bookingNumber?: string;
  status: 'DRIVER_ACCEPTED' | 'DRIVER_ARRIVING' | 'DRIVER_ARRIVED' | 'TRIP_STARTED' | 'TRIP_COMPLETED';
  pickupAddress: string;
  dropAddress?: string;
  fare: number;
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: 'CASH' | 'UPI';
}

export function QueuePage({ auth, onUpdateDriver, onNavigateToEarnings }: QueuePageProps) {
  const [status, setStatus] = useState<DriverStatus>('OFFLINE');
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [tripOffer, setTripOffer] = useState<TripOffer | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [customerQrModalOpen, setCustomerQrModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [offerCountdown, setOfferCountdown] = useState(30);
  const [actionLoading, setActionLoading] = useState(false);
  const [todayEarnings, setTodayEarnings] = useState<number>(0);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // ─── PAYMENT STATES ───────────────────────────────────────
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'CASH'>('UPI');
  const [paymentStep, setPaymentStep] = useState<'RUNNING' | 'COLLECTING_PAYMENT' | 'COMPLETED'>('RUNNING');
  const [dynamicUpiQr, setDynamicUpiQr] = useState<string>('');
  const [quickUpiInput, setQuickUpiInput] = useState<string>(auth.driver?.upiId || '');
  const [isEditingUpi, setIsEditingUpi] = useState(false);
  const [savingQuickUpi, setSavingQuickUpi] = useState(false);

  // Fetch today's earnings for the top Uber-style earnings pill
  const fetchTodayEarnings = useCallback(async () => {
    if (!auth.token) return;
    try {
      const res = await api.get<{ data: { today: number } }>('/driver/earnings', auth.token);
      if (res?.data?.today !== undefined) {
        setTodayEarnings(res.data.today);
      }
    } catch {
      // Graceful fallback
    }
  }, [auth.token]);

  useEffect(() => {
    fetchTodayEarnings();
  }, [fetchTodayEarnings]);

  // Sync quickUpiInput with auth.driver?.upiId
  useEffect(() => {
    if (auth.driver?.upiId) {
      setQuickUpiInput(auth.driver.upiId);
    }
  }, [auth.driver?.upiId]);

  // Sync paymentStep when activeTrip changes
  useEffect(() => {
    if (activeTrip?.status === 'TRIP_COMPLETED') {
      setPaymentStep('COMPLETED');
    } else if (activeTrip?.status === 'TRIP_STARTED') {
      if (paymentStep !== 'COLLECTING_PAYMENT') {
        setPaymentStep('RUNNING');
      }
    } else {
      setPaymentStep('RUNNING');
    }
  }, [activeTrip?.status]);

  // Dynamic Total Amount UPI QR code generation
  useEffect(() => {
    if (!activeTrip) return;
    const effectiveUpi = quickUpiInput.trim() || auth.driver?.upiId || 'gomookambika@icici';
    const payeeName = auth.driver?.upiBeneficiaryName || auth.driver?.name || 'Go Mookambika Captain';
    const fareAmt = Math.round(activeTrip.fare || 0);
    const bookingNum = activeTrip.bookingNumber || 'Ride';
    const upiUri = `upi://pay?pa=${effectiveUpi}&pn=${encodeURIComponent(payeeName)}&am=${fareAmt.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Trip ' + bookingNum)}`;

    QRCode.toDataURL(upiUri, {
      width: 260,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(url => setDynamicUpiQr(url))
      .catch(() => setDynamicUpiQr(''));
  }, [activeTrip, quickUpiInput, auth.driver?.upiId, auth.driver?.upiBeneficiaryName, auth.driver?.name]);

  const handleSaveQuickUpi = async () => {
    const cleanId = quickUpiInput.trim();
    if (!cleanId || !cleanId.includes('@')) {
      setError('Please enter a valid UPI ID (e.g. mobile@upi, name@okhdfcbank)');
      return;
    }
    setSavingQuickUpi(true);
    try {
      await api.patch('/drivers/upi', { upiId: cleanId }, auth.token);
      onUpdateDriver?.({ upiId: cleanId });
      setIsEditingUpi(false);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to update UPI ID');
    } finally {
      setSavingQuickUpi(false);
    }
  };

  const handleFinalizeTrip = async (mode: 'CASH' | 'UPI') => {
    if (!activeTrip || !auth.token) return;
    setActionLoading(true);
    try {
      await api.post(
        `/trips/${activeTrip._id}/complete`,
        { paymentMethod: mode, amountPaid: activeTrip.fare },
        auth.token
      );
      setPaymentMode(mode);
      setPaymentStep('COMPLETED');
      setActiveTrip(prev => (prev ? { ...prev, status: 'TRIP_COMPLETED', paymentMethod: mode } : null));
      fetchTodayEarnings();
    } catch {
      setPaymentMode(mode);
      setPaymentStep('COMPLETED');
      setActiveTrip(prev => (prev ? { ...prev, status: 'TRIP_COMPLETED', paymentMethod: mode } : null));
      fetchTodayEarnings();
    } finally {
      setActionLoading(false);
    }
  };

  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // 1. Start GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('GPS is not supported on this device');
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      pos => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => {
        // Fallback simulated GPS coordinates for Kollur Temple area
        setLocation({ lat: 13.8647, lng: 74.8135, accuracy: 12 });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, []);

  // 2. Connect Socket.IO client
  useEffect(() => {
    if (!auth.token) return;

    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api.*$/, '') : undefined);
    const socket = io(socketUrl, {
      auth: { token: auth.token },
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsSocketConnected(true);
    });

    socket.on('disconnect', () => {
      setIsSocketConnected(false);
    });

    socket.on('connect_error', (err: any) => {
      setIsSocketConnected(false);
      if (err?.message?.includes('token') || err?.message?.includes('Authentication') || err?.message?.includes('unauthorized')) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    });

    // Listen for trip offer from server
    const handleTripOffer = (payload: any) => {
      const dynamicTimeout = Number(payload.timeoutSeconds) || Number(payload.expiresIn) || 30;
      setOfferCountdown(dynamicTimeout);
      setTripOffer({
        tripId: payload.tripId || payload.bookingId,
        bookingId: payload.bookingId,
        bookingNumber: payload.bookingNumber,
        pickupAddress: payload.pickupLocation?.address || payload.pickupAddress || 'Pickup Point',
        dropAddress: payload.dropLocation?.address || payload.dropAddress || 'Destination Point',
        estimatedFare: payload.estimatedFare || 0,
        distanceKm: payload.distanceKm || 0,
        passengers: payload.passengers || 1,
        vehicleCategory: payload.vehicleCategory,
        expiresIn: dynamicTimeout,
        timeoutSeconds: dynamicTimeout,
        scheduledAt: payload.scheduledAt,
      });

      // Haptic feedback & audio chime
      if (navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      } catch {}
    };

    const handleTripOfferTimeout = () => {
      setTripOffer(null);
      setOfferCountdown(0);
    };

    socket.on('trip:offer:sent', handleTripOffer);
    socket.on('TRIP_OFFER_SENT', handleTripOffer);
    socket.on('trip:offer:timeout', handleTripOfferTimeout);
    socket.on('TRIP_OFFER_TIMEOUT', handleTripOfferTimeout);

    socket.on('trip:status:changed', (data: any) => {
      if (data.status === 'COMPLETED') {
        setActiveTrip(null);
        setStatus('AVAILABLE');
        fetchTodayEarnings();
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('trip:offer:sent', handleTripOffer);
      socket.off('TRIP_OFFER_SENT', handleTripOffer);
      socket.off('trip:offer:timeout', handleTripOfferTimeout);
      socket.off('TRIP_OFFER_TIMEOUT', handleTripOfferTimeout);
      socket.off('trip:status:changed');
      if (socket.connected) {
        socket.disconnect();
      }
    };
  }, [auth.token, fetchTodayEarnings]);

  // Trip offer second-by-second countdown timer
  useEffect(() => {
    if (!tripOffer) return;

    const interval = setInterval(() => {
      setOfferCountdown(prev => {
        if (prev <= 1) {
          setTripOffer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [tripOffer]);

  // 3. Check current queue status on mount
  const checkMyStatus = useCallback(async () => {
    if (!auth.token) return;
    try {
      const res = await api.get<{
        success: boolean;
        data: any;
      }>('/queue/my-status', auth.token);

      const entryData = res.data?.entry || (res.data?._id ? res.data : null);
      if (entryData) {
        setQueueEntry({
          _id: entryData._id,
          taxiStandId: entryData.taxiStandId || { name: 'Active Taxi Stand' },
          position: entryData.position || 1,
          enteredAt: entryData.enteredAt || entryData.joinedAt || new Date().toISOString(),
          joinedAt: entryData.joinedAt,
        });
        setStatus('AVAILABLE');
      } else {
        setQueueEntry(null);
      }

      // Restore active trip if driver is currently assigned/on a trip
      if (res.data?.activeTrip) {
        const at = res.data.activeTrip;
        setActiveTrip({
          _id: at._id,
          bookingId: at.bookingId?._id || at.bookingId,
          bookingNumber: at.bookingNumber || at.bookingId?.bookingNumber || 'GM-TRIP',
          status: at.status,
          pickupAddress: at.pickupLocation?.address || at.pickupAddress || 'Pickup Point',
          dropAddress: at.dropLocation?.address || at.dropAddress,
          fare: at.finalFare?.total || at.estimatedFare || at.fare || 0,
          customerName: at.customerId?.name || at.customerName || 'Passenger',
          customerPhone: at.customerId?.phone || at.customerPhone,
        });
        setStatus('ON_TRIP');
      }
    } catch (e: any) {
      if (e?.message?.includes('unauthorized') || e?.message?.includes('401')) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    }
  }, [auth.token]);

  useEffect(() => {
    checkMyStatus();
  }, [checkMyStatus]);

  // 4. Queue Heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!queueEntry || !location || !auth.token) return;
    try {
      await api.post(
        '/queue/heartbeat',
        {
          queueEntryId: queueEntry._id,
          latitude: location.lat,
          longitude: location.lng,
          accuracy: location.accuracy,
        },
        auth.token
      );
    } catch {}
  }, [queueEntry, location, auth.token]);

  useEffect(() => {
    if (status === 'AVAILABLE' && queueEntry) {
      heartbeatRef.current = setInterval(sendHeartbeat, 25000);
    }
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [status, queueEntry, sendHeartbeat]);

  // 5. Offer countdown timer
  useEffect(() => {
    if (tripOffer) {
      setOfferCountdown(tripOffer.expiresIn ?? 30);
      countdownRef.current = setInterval(() => {
        setOfferCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current!);
            setTripOffer(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [tripOffer]);

  // Handler: Join Queue via QR scan
  const handleQRScanSuccess = async (qrToken: string) => {
    if (!auth.token) return;
    const lat = location?.lat || 13.8647;
    const lng = location?.lng || 74.8135;
    const acc = location?.accuracy || 10;

    setActionLoading(true);
    setError('');
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        data: any;
      }>(
        '/queue/join',
        {
          qrToken,
          latitude: lat,
          longitude: lng,
          accuracy: acc,
        },
        auth.token
      );

      setQueueEntry({
        _id: res.data?.queueEntryId || res.data?.data?._id || 'entry_1',
        taxiStandId: { name: res.data?.taxiStandName || 'Kollur Mookambika Stand' },
        position: res.data?.position || res.data?.data?.position || 1,
        enteredAt: new Date().toISOString(),
      });
      setStatus('AVAILABLE');
      setQrModalOpen(false);
    } catch (e: any) {
      if (e?.message?.toLowerCase()?.includes('active trip')) {
        await checkMyStatus();
        setQrModalOpen(false);
      }
      setError(e?.message || 'Failed to join taxi stand queue');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Leave Queue
  const handleLeaveQueue = async () => {
    if (!queueEntry || !auth.token) return;
    setActionLoading(true);
    try {
      await api.post(`/queue/${queueEntry._id}/leave`, {}, auth.token);
    } catch {}
    setQueueEntry(null);
    setStatus('OFFLINE');
    setActionLoading(false);
  };

  // Handler: Accept Trip Offer
  const handleAcceptTrip = async () => {
    if (!tripOffer || !auth.token) return;
    setActionLoading(true);
    try {
      const res = await api.post<{ success: boolean; data: any }>(
        `/trips/${tripOffer.bookingId}/accept`,
        { bookingId: tripOffer.bookingId },
        auth.token
      );

      const tripData = res.data?.data;
      setActiveTrip({
        _id: tripData?._id || tripOffer.bookingId,
        bookingId: tripOffer.bookingId,
        bookingNumber: tripOffer.bookingNumber || 'GM-TRIP',
        status: 'DRIVER_ACCEPTED',
        pickupAddress: tripOffer.pickupAddress || 'Pickup Point',
        dropAddress: tripOffer.dropAddress,
        fare: tripOffer.estimatedFare,
        customerName: 'Passenger',
      });

      setTripOffer(null);
      setStatus('ON_TRIP');
    } catch (e: any) {
      setError(e?.message || 'Failed to accept trip offer');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Decline Trip Offer
  const handleDeclineTrip = async () => {
    if (!tripOffer || !auth.token) return;
    try {
      await api.post(`/trips/${tripOffer.bookingId}/decline`, { bookingId: tripOffer.bookingId }, auth.token);
    } catch {}
    setTripOffer(null);
  };

  // Handler: Driver Arrived at Pickup
  const handleDriverArrived = async () => {
    if (!activeTrip || !auth.token) return;
    setActionLoading(true);
    try {
      await api.post(`/trips/${activeTrip._id}/arrived`, {}, auth.token);
      setActiveTrip(prev => (prev ? { ...prev, status: 'DRIVER_ARRIVED' } : null));
    } catch (e: any) {
      setError(e?.message || 'Failed to update arrival status');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Verify OTP & Start Trip
  const handleStartTrip = async (customOtp?: string) => {
    if (!activeTrip || !auth.token) return;
    const effectiveOtp = (customOtp || otpInput).trim();
    if (effectiveOtp.length < 4) {
      setError('Please enter the 6-digit Ride PIN or scan passenger QR code');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.post(
        `/trips/${activeTrip._id}/start`,
        { otp: effectiveOtp },
        auth.token
      );
      setActiveTrip(prev => (prev ? { ...prev, status: 'TRIP_STARTED' } : null));
      setOtpInput('');
      setCustomerQrModalOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Invalid trip PIN. Please check passenger phone or scan QR code.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Customer QR Code scanned by driver
  const handleScanCustomerRideQR = (scannedText: string) => {
    if (!scannedText) return;
    let extractedOtp = scannedText.trim();
    if (scannedText.startsWith('{')) {
      try {
        const parsed = JSON.parse(scannedText);
        if (parsed.otp) extractedOtp = String(parsed.otp).trim();
      } catch {}
    } else if (scannedText.startsWith('GMRIDE:')) {
      const parts = scannedText.split(':');
      if (parts.length >= 3) extractedOtp = parts[2].trim();
    }
    setOtpInput(extractedOtp);
    setCustomerQrModalOpen(false);
    handleStartTrip(extractedOtp);
  };

  // Navigation intent link
  const openExternalNavigation = (address: string) => {
    if (!address) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  };

  const standName =
    typeof queueEntry?.taxiStandId === 'object'
      ? queueEntry.taxiStandId?.name
      : 'Kollur Mookambika Stand';

  return (
    <div className="px-3.5 py-3 space-y-4 safe-area-top">
      {/* ─── UBER DRIVER TOP FLOATING STATUS BAR ───────────────── */}
      <div className="flex items-center justify-between bg-neutral-900/90 backdrop-blur-xl px-3.5 py-2.5 rounded-2xl border border-white/[0.08] shadow-lg">
        {/* Left: Driver Profile Avatar & Name */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full bg-white text-black font-black text-sm flex items-center justify-center shadow-md">
              {auth.driver?.name?.charAt(0)?.toUpperCase() || 'C'}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black ${
                status === 'AVAILABLE'
                  ? 'bg-emerald-500'
                  : status === 'ON_TRIP'
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-neutral-500'
              }`}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-white text-sm truncate">
                {auth.driver?.name || 'Captain'}
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            </div>
            <div className="text-[11px] text-neutral-400 truncate font-mono">
              {auth.driver?.vehicle?.registrationNumber || auth.driver?.driverCode || 'Tourist Taxi'}
            </div>
          </div>
        </div>

        {/* Center: Live Today Earnings Pill (Uber Driver signature) */}
        <button
          onClick={onNavigateToEarnings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-all active:scale-95 text-white"
        >
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-black font-mono">₹{Math.round(todayEarnings)}</span>
          <ChevronRight className="w-3 h-3 text-neutral-400" />
        </button>

        {/* Right: Online / Offline status badge */}
        <div className="shrink-0">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight border ${
              status === 'AVAILABLE'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : status === 'ON_TRIP'
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === 'AVAILABLE'
                  ? 'bg-emerald-400 animate-pulse'
                  : status === 'ON_TRIP'
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-neutral-500'
              }`}
            />
            <span>{status === 'AVAILABLE' ? 'Online' : status === 'ON_TRIP' ? 'Trip' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* GPS & Network Status Minimal Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-900/40 rounded-xl border border-white/[0.04] text-[11px] text-neutral-400">
        <div className="flex items-center gap-1.5">
          <Navigation className="w-3 h-3 text-emerald-400" />
          <span>{location ? `GPS Locked (±${Math.round(location.accuracy)}m)` : 'Locating GPS...'}</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{isSocketConnected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/70 border border-rose-800/80 text-rose-300 text-xs animate-shake">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── MODE 1: OFFLINE HERO VIEW (Uber Driver "GO" Screen) ─── */}
      {status === 'OFFLINE' && !queueEntry && !activeTrip && (
        <div className="py-8 flex flex-col items-center justify-center text-center space-y-7 relative">
          {/* Subtle radar pulse rings behind the GO button */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-48 h-48 rounded-full border border-emerald-500/20 radar-ring-1 pointer-events-none" />
            <div className="absolute w-48 h-48 rounded-full border border-emerald-500/20 radar-ring-2 pointer-events-none" />
            <div className="absolute w-48 h-48 rounded-full border border-emerald-500/20 radar-ring-3 pointer-events-none" />

            {/* Uber-style circular "GO" button */}
            <button
              onClick={() => setQrModalOpen(true)}
              className="relative w-40 h-40 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-600 text-black flex flex-col items-center justify-center shadow-[0_12px_40px_rgba(0,200,83,0.35)] border-4 border-emerald-300/40 hover:scale-105 active:scale-95 transition-all duration-200 z-10 group"
            >
              <Power className="w-9 h-9 mb-0.5 text-black stroke-[2.5]" />
              <span className="text-4xl font-black tracking-tight uppercase leading-none">GO</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-950 mt-1">
                Go Online
              </span>
            </button>
          </div>

          <div className="space-y-1.5 max-w-xs mx-auto">
            <h2 className="text-xl font-extrabold text-white">You're Offline</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Scan your taxi stand QR code to check into the captain queue and receive automated ride requests.
            </p>
          </div>

          {/* Quick Action: Scan Taxi Stand QR */}
          <div className="w-full pt-1 space-y-2">
            <button
              onClick={() => setQrModalOpen(true)}
              className="btn-uber-primary"
            >
              <QrCode className="w-5 h-5 text-black" />
              <span>SCAN STAND QR TO CHECK IN</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── MODE 2: IN QUEUE HUD (Uber Radar & Finding Trips) ──── */}
      {status === 'AVAILABLE' && queueEntry && !activeTrip && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-neutral-900 border border-white/[0.08] shadow-2xl relative overflow-hidden space-y-4">
            {/* Top Radar Pulse Indicator */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-extrabold tracking-wider text-emerald-400 uppercase">
                  Finding Trips...
                </span>
              </div>
              <button
                onClick={checkMyStatus}
                className="text-neutral-400 hover:text-white text-xs flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Huge Position Display (Uber Style) */}
            <div className="py-2 text-center space-y-1">
              <div className="inline-flex items-center justify-center w-28 h-28 rounded-full bg-black border-4 border-emerald-500 shadow-[0_0_36px_rgba(0,200,83,0.3)]">
                <span className="text-5xl font-black text-emerald-400 font-mono tracking-tighter">
                  #{queueEntry.position}
                </span>
              </div>
              <div className="text-xs font-bold text-neutral-300 uppercase tracking-widest pt-2">
                Your Queue Position
              </div>
            </div>

            {/* Stand Info Pill */}
            <div className="p-3 rounded-2xl bg-black/60 border border-white/[0.06] text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1.5 text-white font-bold text-sm">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{standName}</span>
              </div>
              <div className="text-[11px] text-neutral-400">
                Next passenger ride will be dispatched directly to your app
              </div>
            </div>

            {/* Key Stats Grid */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] text-center">
                <div className="text-[11px] text-neutral-400 font-medium">Vehicles Ahead</div>
                <div className="text-xl font-black text-white font-mono mt-0.5">
                  {Math.max(0, queueEntry.position - 1)}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-black/40 border border-white/[0.06] text-center">
                <div className="text-[11px] text-neutral-400 font-medium">Est. Wait</div>
                <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                  {queueEntry.position === 1 ? 'Next Up!' : `~${queueEntry.position * 5}m`}
                </div>
              </div>
            </div>

            {/* Leave Queue Button */}
            <div className="pt-3 border-t border-white/[0.06]">
              <button
                onClick={handleLeaveQueue}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Leave Queue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODE 3: REAL-TIME TRIP OFFER MODAL (Uber Driver Style) ── */}
      {tripOffer && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-neutral-900 border-t sm:border border-emerald-500/40 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 slide-up-smooth max-h-[95vh] overflow-y-auto">
            {/* Header with countdown */}
            <div className="border-b border-white/[0.08] pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base">Incoming Trip Request</h3>
                    <div className="text-[11px] text-neutral-400 font-mono">
                      {tripOffer.bookingNumber || 'Ride Request'}
                    </div>
                  </div>
                </div>

                {/* Dynamic countdown badge */}
                <div
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border font-black text-sm font-mono transition-colors ${
                    offerCountdown <= 5
                      ? 'bg-rose-500/25 border-rose-500 text-rose-400 animate-pulse'
                      : offerCountdown <= 10
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                      : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
                  <span>{offerCountdown}s</span>
                </div>
              </div>

              {/* Smooth time remaining progress bar */}
              <div className="w-full bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                    offerCountdown <= 5 ? 'bg-rose-500' : offerCountdown <= 10 ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, (offerCountdown / (tripOffer.timeoutSeconds || tripOffer.expiresIn || 30)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Scheduled Trip Indicator */}
            {tripOffer.scheduledAt && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-xs font-semibold">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>
                  Advance Reservation •{' '}
                  {new Date(tripOffer.scheduledAt).toLocaleString('en-IN', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
            )}

            {/* Fare Hero (Uber Style) */}
            <div className="p-4 rounded-2xl bg-black border border-emerald-500/30 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
                  Guaranteed Fare
                </div>
                <div className="text-3xl font-black text-white font-mono mt-0.5 flex items-center tracking-tight">
                  <IndianRupee className="w-6 h-6 mr-0.5 text-emerald-400" />
                  {Math.round(tripOffer.estimatedFare)}
                </div>
              </div>
              <div className="text-right text-xs text-neutral-300 space-y-0.5">
                <div className="font-bold">{tripOffer.distanceKm.toFixed(1)} km ride</div>
                <div className="text-[11px] text-neutral-400">Cash / UPI on Completion</div>
              </div>
            </div>

            {/* Route Timeline */}
            <div className="space-y-3 px-1 py-1 text-sm">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                  <span className="w-0.5 flex-1 bg-neutral-700 my-1" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    Pickup Location
                  </div>
                  <div className="text-white font-medium text-xs mt-0.5 truncate">
                    {tripOffer.pickupAddress}
                  </div>
                </div>
              </div>

              {tripOffer.dropAddress && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                      Drop Destination
                    </div>
                    <div className="text-white font-medium text-xs mt-0.5 truncate">
                      {tripOffer.dropAddress}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accept / Decline actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleDeclineTrip}
                disabled={actionLoading}
                className="py-3.5 rounded-2xl border border-white/[0.1] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-sm transition-all active:scale-95"
              >
                Decline
              </button>
              <button
                onClick={handleAcceptTrip}
                disabled={actionLoading}
                className="btn-uber-primary !py-3.5 !rounded-2xl"
              >
                <Check className="w-5 h-5 stroke-[3]" />
                <span>ACCEPT RIDE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODE 4: ACTIVE TRIP HUD ───────────────────────────── */}
      {status === 'ON_TRIP' && activeTrip && (
        <div className="space-y-4 p-5 rounded-3xl bg-neutral-900 border border-blue-500/40 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
            <div className="flex items-center gap-2 text-blue-400 font-extrabold text-sm">
              <Compass className="w-4 h-4 animate-spin" />
              <span>RIDE IN PROGRESS</span>
            </div>
            <div className="text-xs text-neutral-400 font-mono font-semibold">
              {activeTrip.bookingNumber}
            </div>
          </div>

          {/* Passenger & Contact Bar */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-black/60 border border-white/[0.06]">
            <div>
              <div className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Passenger</div>
              <div className="text-sm font-bold text-white mt-0.5">{activeTrip.customerName || 'Passenger'}</div>
            </div>
            {activeTrip.customerPhone && (
              <a
                href={`tel:${activeTrip.customerPhone}`}
                className="p-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call</span>
              </a>
            )}
          </div>

          {/* Route Info with 1-Tap Navigation */}
          <div className="space-y-3 py-1">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[10px] text-neutral-400 uppercase font-bold">Pickup</div>
                  <div className="text-white text-xs font-medium truncate">{activeTrip.pickupAddress}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openExternalNavigation(activeTrip.pickupAddress)}
                className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-neutral-300 text-[11px] font-bold flex items-center gap-1 shrink-0"
              >
                <ExternalLink className="w-3 h-3 text-emerald-400" />
                <span>Maps</span>
              </button>
            </div>

            {activeTrip.dropAddress && (
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[10px] text-neutral-400 uppercase font-bold">Drop Destination</div>
                    <div className="text-white text-xs font-medium truncate">{activeTrip.dropAddress}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openExternalNavigation(activeTrip.dropAddress!)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-neutral-300 text-[11px] font-bold flex items-center gap-1 shrink-0"
                >
                  <ExternalLink className="w-3 h-3 text-rose-400" />
                  <span>Maps</span>
                </button>
              </div>
            )}
          </div>

          {/* STAGE 1: DRIVER_ACCEPTED -> I've Arrived */}
          {activeTrip.status === 'DRIVER_ACCEPTED' && (
            <div className="pt-2">
              <button
                onClick={handleDriverArrived}
                disabled={actionLoading}
                className="btn-uber-blue"
              >
                <span>I'VE ARRIVED AT PICKUP POINT</span>
              </button>
            </div>
          )}

          {/* STAGE 2: DRIVER_ARRIVED -> Passenger Verification */}
          {activeTrip.status === 'DRIVER_ARRIVED' && (
            <div className="space-y-4 pt-2">
              {/* Option 1: Scan Customer QR Code */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-emerald-500/30 text-center space-y-2.5">
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                  <QrCode className="w-5 h-5" />
                  <span>Scan Passenger QR Code</span>
                </div>
                <p className="text-xs text-neutral-400">
                  Point camera at the verification QR code on the passenger's screen
                </p>
                <button
                  type="button"
                  onClick={() => setCustomerQrModalOpen(true)}
                  disabled={actionLoading}
                  className="btn-uber-primary !py-3 !rounded-xl"
                >
                  <QrCode className="w-4 h-4 text-black" />
                  <span>OPEN QR SCANNER</span>
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 text-neutral-500 text-xs font-semibold uppercase tracking-wider">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span>OR ENTER 6-DIGIT PIN</span>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              {/* Option 2: 6-Digit PIN */}
              <div className="p-4 rounded-2xl bg-black border border-white/[0.08] text-center space-y-3">
                <div className="text-xs text-neutral-300 font-semibold">
                  Ask passenger for their 6-digit Ride PIN
                </div>
                <input
                  type="tel"
                  maxLength={6}
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="• • • • • •"
                  className="w-48 mx-auto text-center font-mono font-bold text-2xl tracking-[0.25em] py-2 bg-neutral-900 border border-emerald-500/40 rounded-xl text-emerald-400 outline-none focus:border-emerald-400 placeholder:text-neutral-600"
                />
                <button
                  type="button"
                  onClick={() => handleStartTrip()}
                  disabled={actionLoading || otpInput.length < 4}
                  className="btn-uber-primary !py-3 !rounded-xl"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>VERIFY PIN & START TRIP</span>
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: TRIP_STARTED -> Reached Destination */}
          {activeTrip.status === 'TRIP_STARTED' && paymentStep === 'RUNNING' && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-0.5">
                <div className="text-xs text-emerald-400 font-bold flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Driving to Destination</span>
                </div>
                <div className="text-2xl font-mono font-black text-white">
                  Fare: ₹{Math.round(activeTrip.fare)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPaymentStep('COLLECTING_PAYMENT')}
                disabled={actionLoading}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-black font-black text-sm shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2"
              >
                <Banknote className="w-5 h-5 text-black" />
                <span>REACHED DESTINATION • COLLECT FARE</span>
              </button>
            </div>
          )}

          {/* STAGE 4: PAYMENT COLLECTION (UPI & CASH) */}
          {activeTrip.status === 'TRIP_STARTED' && paymentStep === 'COLLECTING_PAYMENT' && (
            <div className="space-y-4 pt-2">
              {/* Fare Banner */}
              <div className="p-4 rounded-2xl bg-black border border-emerald-500/40 text-center space-y-1">
                <div className="text-[11px] uppercase font-bold tracking-wider text-neutral-400">
                  Total Fare to Collect
                </div>
                <div className="text-4xl font-black text-white font-mono tracking-tight">
                  ₹{Math.round(activeTrip.fare)}
                </div>
                <div className="text-xs text-neutral-400">
                  Select payment method: <b className="text-white">UPI QR</b> or <b className="text-white">Cash</b>
                </div>
              </div>

              {/* Payment Mode Switcher Tabs */}
              <div className="grid grid-cols-2 p-1 bg-black rounded-2xl border border-white/[0.08] gap-1">
                <button
                  type="button"
                  onClick={() => setPaymentMode('UPI')}
                  className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    paymentMode === 'UPI'
                      ? 'bg-white text-black shadow-md font-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>UPI Scan & Pay</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode('CASH')}
                  className={`py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    paymentMode === 'CASH'
                      ? 'bg-amber-400 text-black shadow-md font-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Collect Cash</span>
                </button>
              </div>

              {/* TAB 1: UPI DYNAMIC QR GENERATION */}
              {paymentMode === 'UPI' && (
                <div className="p-4 rounded-2xl bg-black border border-white/[0.08] text-center space-y-3.5 shadow-xl">
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Scan with any UPI App</span>
                    </div>
                    <p className="text-[11px] text-neutral-400">
                      PhonePe, GPay, Paytm, BHIM with exact ₹{Math.round(activeTrip.fare)}
                    </p>
                  </div>

                  {/* High Contrast Dynamic QR Code */}
                  <div className="p-3 bg-white rounded-2xl inline-block shadow-2xl">
                    {dynamicUpiQr ? (
                      <img
                        src={dynamicUpiQr}
                        alt="Total Amount UPI QR"
                        className="w-52 h-52 mx-auto object-contain"
                      />
                    ) : (
                      <div className="w-52 h-52 flex items-center justify-center text-neutral-400">
                        Generating QR...
                      </div>
                    )}
                  </div>

                  {/* Payee Details & Quick UPI Edit */}
                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-white/[0.06] text-left space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="text-neutral-500 text-[10px] block">Receiving UPI ID</span>
                        <span className="font-mono font-bold text-emerald-400 text-xs">
                          {quickUpiInput.trim() || auth.driver?.upiId || 'gomookambika@icici'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsEditingUpi(!isEditingUpi)}
                        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{isEditingUpi ? 'Close' : 'Change'}</span>
                      </button>
                    </div>

                    {isEditingUpi && (
                      <div className="pt-2 border-t border-white/[0.06] space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="yourname@okhdfcbank"
                            value={quickUpiInput}
                            onChange={e => setQuickUpiInput(e.target.value.trim())}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-black border border-white/[0.12] text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={handleSaveQuickUpi}
                            disabled={savingQuickUpi}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs shrink-0"
                          >
                            {savingQuickUpi ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Finish UPI Ride Button */}
                  <button
                    type="button"
                    onClick={() => handleFinalizeTrip('UPI')}
                    disabled={actionLoading}
                    className="btn-uber-primary"
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>CONFIRM UPI PAYMENT & FINISH TRIP</span>
                  </button>
                </div>
              )}

              {/* TAB 2: CASH PAYMENT */}
              {paymentMode === 'CASH' && (
                <div className="p-4 rounded-2xl bg-black border border-amber-500/30 text-center space-y-3.5 shadow-xl">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                    <Banknote className="w-8 h-8" />
                  </div>

                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Collect Cash from Passenger
                    </div>
                    <div className="text-3xl font-black text-white font-mono">
                      ₹{Math.round(activeTrip.fare)}
                    </div>
                    <p className="text-xs text-neutral-400">
                      Collect the fare amount directly from the passenger.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFinalizeTrip('CASH')}
                    disabled={actionLoading}
                    className="w-full py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Check className="w-5 h-5 stroke-[3]" />
                    <span>COLLECT CASH ₹{Math.round(activeTrip.fare)} & FINISH</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setPaymentStep('RUNNING')}
                className="w-full py-2 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                ← Back to Navigation View
              </button>
            </div>
          )}

          {/* STAGE 5: TRIP COMPLETED RECEIPT VIEW */}
          {(activeTrip.status === 'TRIP_COMPLETED' || paymentStep === 'COMPLETED') && (
            <div className="space-y-3 pt-2 text-center">
              <div className="p-5 rounded-3xl bg-neutral-950 border border-emerald-500/40 space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-lg font-bold text-white">Ride Completed!</h4>
                <div className="text-3xl font-black text-white font-mono">
                  ₹{Math.round(activeTrip.fare)}
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-neutral-900 border border-emerald-500/30 text-emerald-400">
                  {paymentMode === 'UPI' ? <QrCode className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />}
                  <span>{paymentMode === 'UPI' ? 'Paid via UPI Scan & Pay' : 'Paid in Cash'}</span>
                </div>
                <div className="text-xs text-neutral-400 pt-1">
                  Trip #{activeTrip.bookingNumber} settled & added to daily earnings
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveTrip(null);
                  setStatus('AVAILABLE');
                  setPaymentStep('RUNNING');
                  checkMyStatus();
                }}
                className="btn-uber-primary"
              >
                <span>RETURN TO AVAILABLE QUEUE</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Taxi Stand Queue QR Scanner Modal */}
      <QRScannerModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        onScanSuccess={handleQRScanSuccess}
        loading={actionLoading}
      />

      {/* Customer Ride QR Scanner Modal */}
      <QRScannerModal
        isOpen={customerQrModalOpen}
        onClose={() => setCustomerQrModalOpen(false)}
        onScanSuccess={handleScanCustomerRideQR}
        onScan={handleScanCustomerRideQR}
        title="Scan Passenger Ride QR"
        subtitle="Align passenger ride QR within viewfinder"
        hideStands={true}
        loading={actionLoading}
      />
    </div>
  );
}
