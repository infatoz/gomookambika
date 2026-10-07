import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';

interface AuthState { token: string | null; driver: { _id: string; name: string; status: string; driverCode: string } | null; }

interface QueuePageProps { auth: AuthState; }

type DriverStatus = 'OFFLINE' | 'AVAILABLE' | 'ON_TRIP' | 'BREAK';

interface QueueEntry {
  _id: string;
  taxiStandId: { name: string };
  position: number;
  enteredAt: string;
}

interface TripOffer {
  tripId: string;
  bookingId: string;
  bookingNumber: string;
  pickupAddress: string;
  dropAddress?: string;
  estimatedFare: number;
  distanceKm: number;
  expiresIn: number;
}

export function QueuePage({ auth }: QueuePageProps) {
  const [status, setStatus] = useState<DriverStatus>('OFFLINE');
  const [queueEntry, setQueueEntry] = useState<QueueEntry | null>(null);
  const [tripOffer, setTripOffer] = useState<TripOffer | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [qrScanMode, setQrScanMode] = useState(false);
  const [error, setError] = useState('');
  const [offerCountdown, setOfferCountdown] = useState(0);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start GPS tracking
  useEffect(() => {
    if (!navigator.geolocation) return;
    watchRef.current = navigator.geolocation.watchPosition(
      pos => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => setError('GPS not available'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  // Heartbeat
  const sendHeartbeat = useCallback(async () => {
    if (!queueEntry || !location || !auth.token) return;
    try {
      await api.post('/queue/heartbeat', {
        queueEntryId: queueEntry._id,
        latitude: location.lat,
        longitude: location.lng,
        accuracy: location.accuracy,
      }, auth.token);
    } catch {
      // Heartbeat failures are non-critical
    }
  }, [queueEntry, location, auth.token]);

  useEffect(() => {
    if (status === 'AVAILABLE' && queueEntry) {
      heartbeatRef.current = setInterval(sendHeartbeat, 30000);
    }
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [status, queueEntry, sendHeartbeat]);

  // Offer countdown
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
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [tripOffer]);

  const handleGoOnline = () => {
    setStatus('AVAILABLE');
    setQrScanMode(true);
  };

  const handleGoOffline = async () => {
    if (queueEntry && auth.token) {
      try {
        await api.post(`/queue/${queueEntry._id}/leave`, {}, auth.token);
      } catch {}
    }
    setStatus('OFFLINE');
    setQueueEntry(null);
    setTripOffer(null);
  };

  const handleQRJoin = async (qrToken: string) => {
    if (!location || !auth.token) { setError('GPS location required'); return; }
    setError('');
    try {
      const res = await api.post<{ data: QueueEntry }>('/queue/join', {
        qrToken,
        latitude: location.lat,
        longitude: location.lng,
        accuracy: location.accuracy,
      }, auth.token);
      setQueueEntry(res.data);
      setQrScanMode(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to join queue');
    }
  };

  const handleAcceptTrip = async () => {
    if (!tripOffer || !auth.token) return;
    try {
      await api.post(`/trips/${tripOffer.tripId}/accept`, {}, auth.token);
      setTripOffer(null);
      setStatus('ON_TRIP');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to accept trip');
    }
  };

  const handleDeclineTrip = async () => {
    if (!tripOffer || !auth.token) return;
    try {
      await api.post(`/trips/${tripOffer.tripId}/decline`, {}, auth.token);
      setTripOffer(null);
    } catch {}
  };

  return (
    <div className="safe-area-top px-5 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{auth.driver?.name ?? 'Driver'}</h1>
          <div className="text-sm text-gray-400 font-mono mt-0.5">{auth.driver?.driverCode}</div>
        </div>
        <div className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
          status === 'AVAILABLE' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
          status === 'ON_TRIP' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
          'bg-gray-500/20 text-gray-400 border border-gray-500/30'
        }`}>
          {status === 'AVAILABLE' && <span className="inline-block w-2 h-2 bg-green-400 rounded-full mr-1.5 animate-pulse" />}
          {status}
        </div>
      </div>

      {/* GPS Status */}
      <div className={`flex items-center gap-2 text-sm ${location ? 'text-green-400' : 'text-yellow-400'}`}>
        <span>{location ? '📍' : '⚠️'}</span>
        {location ? `GPS: ±${Math.round(location.accuracy)}m accuracy` : 'Waiting for GPS...'}
      </div>

      {/* Trip Offer Modal */}
      {tripOffer && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
          <div className="w-full card rounded-t-3xl slide-up space-y-4 border-t border-green-500/30">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">🚖 Trip Offer!</h2>
              <div className="text-red-400 font-bold text-2xl">{offerCountdown}s</div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <span className="text-green-400">📍</span>
                <div><div className="text-gray-400 text-xs">Pickup</div><div className="text-white">{tripOffer.pickupAddress}</div></div>
              </div>
              {tripOffer.dropAddress && (
                <div className="flex gap-3">
                  <span className="text-red-400">🏁</span>
                  <div><div className="text-gray-400 text-xs">Drop</div><div className="text-white">{tripOffer.dropAddress}</div></div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="card py-3 text-center">
                  <div className="text-xs text-gray-400">Distance</div>
                  <div className="text-white font-bold mt-1">{tripOffer.distanceKm.toFixed(1)} km</div>
                </div>
                <div className="card py-3 text-center">
                  <div className="text-xs text-gray-400">Est. Fare</div>
                  <div className="text-green-400 font-bold text-lg mt-1">₹{tripOffer.estimatedFare.toFixed(0)}</div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleDeclineTrip} className="btn-secondary flex-1">✕ Decline</button>
              <button onClick={handleAcceptTrip} className="btn-primary flex-1">✓ Accept</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Scan Mode */}
      {qrScanMode && !queueEntry && (
        <div className="card border-green-500/20">
          <h3 className="text-white font-semibold mb-3">📷 Scan QR to Join Queue</h3>
          <p className="text-gray-400 text-sm mb-4">
            Scan the QR code at your taxi stand to join the driver queue.
          </p>
          {/* Simulated QR input for testing */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="QR Token (from QR scan)"
              className="input-field"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleQRJoin((e.target as HTMLInputElement).value);
                }
              }}
            />
            <p className="text-xs text-gray-500">Press Enter after entering the QR token</p>
          </div>
          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
          <button onClick={() => { setQrScanMode(false); setStatus('OFFLINE'); }} className="btn-secondary mt-3 w-full">
            Cancel
          </button>
        </div>
      )}

      {/* Queue Status */}
      {queueEntry && (
        <div className="card border-green-500/20 bg-green-500/5">
          <div className="flex items-center gap-2 mb-4">
            <div className="pulse-dot" />
            <h3 className="text-white font-semibold">In Queue</h3>
          </div>
          <div className="text-center py-4">
            <div className="text-6xl font-bold text-green-400">{queueEntry.position}</div>
            <div className="text-gray-400 text-sm mt-1">Your position</div>
          </div>
          <div className="text-center text-sm text-gray-400 mt-2">
            📍 {queueEntry.taxiStandId?.name}
          </div>
          <div className="text-center text-xs text-gray-500 mt-1">
            Joined {new Date(queueEntry.enteredAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      {/* Online/Offline Toggle */}
      {status === 'OFFLINE' ? (
        <button
          onClick={handleGoOnline}
          disabled={!location}
          className="btn-primary"
        >
          {!location ? '⚠️ Waiting for GPS...' : '🟢 Go Online'}
        </button>
      ) : status !== 'ON_TRIP' ? (
        <button
          onClick={handleGoOffline}
          className="w-full py-4 rounded-xl border border-red-500/30 text-red-400 font-semibold hover:bg-red-500/10 transition-colors"
        >
          🔴 Go Offline
        </button>
      ) : null}

      {/* On Trip Banner */}
      {status === 'ON_TRIP' && (
        <div className="card border-blue-500/30 bg-blue-500/5 text-center py-6">
          <div className="text-4xl mb-2">🛣️</div>
          <div className="text-white font-semibold text-lg">Trip in Progress</div>
          <div className="text-gray-400 text-sm mt-1">Drive safely!</div>
        </div>
      )}
    </div>
  );
}
