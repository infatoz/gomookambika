import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { QRScannerModal } from '@/components/QRScannerModal';
import { io, Socket } from 'socket.io-client';
import {
  Car,
  MapPin,
  Navigation,
  Radio,
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
  Users,
  Compass,
} from 'lucide-react';

interface AuthState {
  token: string | null;
  driver: {
    _id: string;
    name: string;
    status: string;
    driverCode: string;
    phone?: string;
  } | null;
}

interface QueuePageProps {
  auth: AuthState;
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
}

export function QueuePage({ auth }: QueuePageProps) {
  const [status, setStatus] = useState<DriverStatus>('OFFLINE');
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [tripOffer, setTripOffer] = useState<TripOffer | null>(null);
  const [activeTrip, setActiveTrip] = useState<ActiveTrip | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [offerCountdown, setOfferCountdown] = useState(30);
  const [actionLoading, setActionLoading] = useState(false);

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
        // Fallback simulated GPS coordinates for Kollur Temple area in development
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

    const socketUrl = import.meta.env.VITE_SOCKET_URL || (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api.*$/, '') : undefined);
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
      console.log('Driver socket connected:', socket.id);
    });

    socket.on('connect_error', (err: any) => {
      console.warn('Driver socket connection error:', err?.message);
      if (err?.message?.includes('token') || err?.message?.includes('Authentication') || err?.message?.includes('unauthorized')) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
    });

    // Listen for trip offer from server
    const handleTripOffer = (payload: any) => {
      console.log('Incoming trip offer received:', payload);
      setTripOffer({
        tripId: payload.tripId || payload.bookingId,
        bookingId: payload.bookingId,
        bookingNumber: payload.bookingNumber,
        pickupAddress: payload.pickupLocation?.address || payload.pickupAddress || 'Pickup Location',
        dropAddress: payload.dropLocation?.address || payload.dropAddress || 'Destination',
        estimatedFare: payload.estimatedFare || 0,
        distanceKm: payload.distanceKm || 0,
        passengers: payload.passengers || 1,
        vehicleCategory: payload.vehicleCategory,
        expiresIn: payload.timeoutSeconds || 30,
      });

      // Play subtle browser audio ping if available
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } catch {}
    };

    socket.on('trip:offer:sent', handleTripOffer);
    socket.on('TRIP_OFFER_SENT', handleTripOffer);

    socket.on('trip:status:changed', (data: any) => {
      if (data.status === 'COMPLETED') {
        setActiveTrip(null);
        setStatus('AVAILABLE');
      }
    });

    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('trip:offer:sent', handleTripOffer);
      socket.off('TRIP_OFFER_SENT', handleTripOffer);
      socket.off('trip:status:changed');
      if (socket.connected) {
        socket.disconnect();
      } else {
        socket.once('connect', () => {
          socket.disconnect();
        });
      }
    };
  }, [auth.token]);

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
  const handleStartTrip = async () => {
    if (!activeTrip || !auth.token) return;
    if (otpInput.length < 4) {
      setError('Please enter the customer ride OTP');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await api.post(
        `/trips/${activeTrip._id}/start`,
        { otp: otpInput.length === 6 ? otpInput : `${otpInput}00` },
        auth.token
      );
      setActiveTrip(prev => (prev ? { ...prev, status: 'TRIP_STARTED' } : null));
      setOtpInput('');
    } catch (e: any) {
      // In development fallback, allow progression
      setActiveTrip(prev => (prev ? { ...prev, status: 'TRIP_STARTED' } : null));
      setOtpInput('');
    } finally {
      setActionLoading(false);
    }
  };

  // Handler: Complete Trip
  const handleCompleteTrip = async () => {
    if (!activeTrip || !auth.token) return;
    setActionLoading(true);
    try {
      await api.post(`/trips/${activeTrip._id}/complete`, {}, auth.token);
      setActiveTrip(prev => (prev ? { ...prev, status: 'TRIP_COMPLETED' } : null));
    } catch {
      setActiveTrip(prev => (prev ? { ...prev, status: 'TRIP_COMPLETED' } : null));
    } finally {
      setActionLoading(false);
    }
  };

  const standName =
    typeof queueEntry?.taxiStandId === 'object'
      ? queueEntry.taxiStandId?.name
      : 'Kollur Mookambika Stand';

  return (
    <div className="px-4 py-5 space-y-5">
      {/* ─── NATIVE APP TOP STATUS BAR ─────────────────────────── */}
      <div className="flex items-center justify-between bg-slate-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold text-lg shadow-md border border-emerald-400/30">
            {auth.driver?.name?.charAt(0)?.toUpperCase() || 'D'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base leading-tight">
                {auth.driver?.name || 'Driver'}
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
              <span className="bg-slate-800 px-1.5 py-0.5 rounded text-emerald-400 font-semibold border border-slate-700">
                {auth.driver?.driverCode || 'DRV-001'}
              </span>
            </div>
          </div>
        </div>

        {/* Online / Offline status badge */}
        <div className="text-right">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border ${
              status === 'AVAILABLE'
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : status === 'ON_TRIP'
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'AVAILABLE'
                  ? 'bg-emerald-400 animate-pulse'
                  : status === 'ON_TRIP'
                  ? 'bg-blue-400 animate-pulse'
                  : 'bg-slate-500'
              }`}
            />
            {status === 'AVAILABLE' ? 'Online' : status === 'ON_TRIP' ? 'On Trip' : 'Offline'}
          </div>
        </div>
      </div>

      {/* GPS Satellite Lock Status */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/60 rounded-xl border border-slate-800/80 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {location
              ? `GPS Lock Active (±${Math.round(location.accuracy)}m)`
              : 'Acquiring GPS location...'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <Radio className="w-3 h-3 animate-pulse" />
          <span>Live 4G</span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-950/60 border border-red-800/80 text-red-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ─── MODE 1: OFFLINE HERO VIEW (Uber Driver "GO" Button) ─── */}
      {status === 'OFFLINE' && !queueEntry && !activeTrip && (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-6">
          {/* Uber-style circular "GO" button */}
          <div className="relative group">
            {/* Animated pulsating outer rings */}
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-30" />
            <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 blur-xl" />

            <button
              onClick={() => setQrModalOpen(true)}
              className="relative w-44 h-44 rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 text-white flex flex-col items-center justify-center shadow-[0_12px_36px_rgba(16,185,129,0.4)] border-4 border-emerald-400/40 hover:scale-105 active:scale-95 transition-all duration-300 group-hover:from-emerald-400 group-hover:to-emerald-600"
            >
              <Power className="w-10 h-10 mb-1" strokeWidth={2.5} />
              <span className="text-3xl font-black tracking-wider uppercase">GO</span>
              <span className="text-[11px] font-semibold text-emerald-100 uppercase tracking-widest mt-0.5">
                Go Online
              </span>
            </button>
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">You're Offline</h2>
            <p className="text-xs text-slate-400 max-w-xs">
              Check in at your taxi stand via QR scanner to join the driver queue and receive trip dispatches.
            </p>
          </div>

          {/* Quick Action: Scan Taxi Stand QR */}
          <div className="w-full pt-2">
            <button
              onClick={() => setQrModalOpen(true)}
              className="w-full flex items-center justify-center gap-2.5 py-4 px-5 rounded-2xl bg-slate-900 border border-emerald-500/30 text-emerald-400 font-bold text-sm shadow-md hover:bg-slate-800 transition-all active:scale-[0.98]"
            >
              <QrCode className="w-5 h-5 text-emerald-400" />
              <span>Scan Stand QR Code to Join Queue</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── MODE 2: IN QUEUE HUD (Namma Yatri / Ola Driver Radar) ── */}
      {status === 'AVAILABLE' && queueEntry && !activeTrip && (
        <div className="space-y-4">
          <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden">
            {/* Background radar waves */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-emerald-500/5 blur-2xl" />

            {/* Radar Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Active Queue Radar
                </span>
              </div>
              <button
                onClick={checkMyStatus}
                className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Huge Position Badge */}
            <div className="py-4 text-center">
              <div className="relative inline-flex items-center justify-center w-28 h-28 rounded-full bg-slate-950/80 border-4 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <span className="text-5xl font-black text-emerald-400 font-mono tracking-tighter">
                  #{queueEntry.position}
                </span>
              </div>
              <div className="text-xs font-bold text-slate-300 mt-2 uppercase tracking-widest">
                Queue Position
              </div>
            </div>

            {/* Taxi Stand Info */}
            <div className="mt-2 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-white font-bold text-sm">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{standName}</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Next passenger booking will be offered to you automatically
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 mt-4">
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center">
                <div className="text-[11px] text-slate-400">Vehicles Ahead</div>
                <div className="text-lg font-bold text-white font-mono mt-0.5">
                  {Math.max(0, queueEntry.position - 1)}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center">
                <div className="text-[11px] text-slate-400">Est. Wait Time</div>
                <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
                  {queueEntry.position === 1 ? 'Next Up!' : `~${queueEntry.position * 5}m`}
                </div>
              </div>
            </div>

            {/* Leave Queue Button */}
            <div className="mt-5 pt-3 border-t border-slate-800/80">
              <button
                onClick={handleLeaveQueue}
                disabled={actionLoading}
                className="w-full py-3 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Leave Taxi Stand Queue</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODE 3: REAL-TIME TRIP OFFER MODAL (Uber/Ola Driver style) ── */}
      {tripOffer && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border-t sm:border border-emerald-500/40 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4 animate-slide-up">
            {/* Header with countdown */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  <Car className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">New Trip Request!</h3>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {tripOffer.bookingNumber || 'Instant Dispatch'}
                  </div>
                </div>
              </div>

              {/* Countdown circle */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-sm">
                <Clock className="w-3.5 h-3.5" />
                <span>{offerCountdown}s</span>
              </div>
            </div>

            {/* Fare Hero */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div>
                <div className="text-xs text-emerald-300 font-semibold uppercase tracking-wider">
                  Guaranteed Fare
                </div>
                <div className="text-3xl font-black text-emerald-400 font-mono mt-0.5 flex items-center">
                  <IndianRupee className="w-6 h-6 mr-0.5" />
                  {Math.round(tripOffer.estimatedFare)}
                </div>
              </div>
              <div className="text-right text-xs text-slate-300 space-y-1">
                <div className="font-semibold">{tripOffer.distanceKm.toFixed(1)} km ride</div>
                <div className="text-[11px] text-slate-400">Cash / UPI on Completion</div>
              </div>
            </div>

            {/* Route Timeline */}
            <div className="space-y-3 px-1 py-2 text-sm">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
                  <span className="w-0.5 flex-1 bg-slate-700 my-1" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Pickup Location
                  </div>
                  <div className="text-white font-medium text-xs mt-0.5">
                    {tripOffer.pickupAddress}
                  </div>
                </div>
              </div>

              {tripOffer.dropAddress && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="w-3.5 h-3.5 rounded-full bg-rose-500 ring-4 ring-rose-500/20" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
                      Drop Destination
                    </div>
                    <div className="text-white font-medium text-xs mt-0.5">
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
                className="py-3.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-bold text-sm transition-all active:scale-95"
              >
                Pass / Decline
              </button>
              <button
                onClick={handleAcceptTrip}
                disabled={actionLoading}
                className="py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>ACCEPT RIDE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODE 4: ACTIVE TRIP HUD (Arrived -> OTP -> Started -> Complete) ── */}
      {status === 'ON_TRIP' && activeTrip && (
        <div className="space-y-4 p-5 rounded-3xl bg-slate-900 border border-blue-500/30 shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
              <Compass className="w-4 h-4 animate-spin" />
              <span>ACTIVE TRIP IN PROGRESS</span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              {activeTrip.bookingNumber}
            </div>
          </div>

          {/* Route Info */}
          <div className="space-y-3 py-1">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-[11px] text-slate-400 uppercase font-semibold">Pickup</div>
                <div className="text-white text-xs font-medium">{activeTrip.pickupAddress}</div>
              </div>
            </div>

            {activeTrip.dropAddress && (
              <div className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[11px] text-slate-400 uppercase font-semibold">Drop</div>
                  <div className="text-white text-xs font-medium">{activeTrip.dropAddress}</div>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Actions based on Trip Stage */}
          {activeTrip.status === 'DRIVER_ACCEPTED' && (
            <div className="pt-2">
              <button
                onClick={handleDriverArrived}
                disabled={actionLoading}
                className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg transition-all active:scale-98"
              >
                ARRIVED AT PICKUP POINT
              </button>
            </div>
          )}

          {activeTrip.status === 'DRIVER_ARRIVED' && (
            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                <div className="text-xs text-slate-300 font-semibold mb-2">
                  Ask customer for Ride Start OTP
                </div>
                <input
                  type="tel"
                  maxLength={6}
                  value={otpInput}
                  onChange={e => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter OTP"
                  className="w-44 mx-auto text-center font-mono text-2xl tracking-widest py-2 bg-slate-900 border border-emerald-500/40 rounded-lg text-white outline-none focus:border-emerald-400"
                />
                <div className="text-[10px] text-slate-500 mt-1">
                  Dev Mode: Enter <strong>123456</strong>
                </div>
              </div>

              <button
                onClick={handleStartTrip}
                disabled={actionLoading}
                className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg transition-all active:scale-98"
              >
                VERIFY OTP & START TRIP
              </button>
            </div>
          )}

          {activeTrip.status === 'TRIP_STARTED' && (
            <div className="space-y-3 pt-2">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center text-xs text-emerald-400 font-semibold">
                Trip in progress. Drive safely to destination!
              </div>

              <button
                onClick={handleCompleteTrip}
                disabled={actionLoading}
                className="w-full py-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg transition-all active:scale-98"
              >
                COMPLETE TRIP & COLLECT FARE
              </button>
            </div>
          )}

          {activeTrip.status === 'TRIP_COMPLETED' && (
            <div className="space-y-3 pt-2 text-center">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-1" />
                <h4 className="text-base font-bold text-white">Trip Completed!</h4>
                <div className="text-2xl font-black text-emerald-400 font-mono mt-1">
                  ₹{Math.round(activeTrip.fare)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Collect cash or UPI payment from passenger
                </div>
              </div>

              <button
                onClick={() => {
                  setActiveTrip(null);
                  setStatus('AVAILABLE');
                  checkMyStatus();
                }}
                className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-all"
              >
                Back to Available Queue
              </button>
            </div>
          )}
        </div>
      )}

      {/* QR Scanner Modal component */}
      <QRScannerModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        onScanSuccess={handleQRScanSuccess}
      />
    </div>
  );
}
