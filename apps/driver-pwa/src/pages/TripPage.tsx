import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface AuthState { token: string | null; }
interface TripPageProps { auth: AuthState; }

interface Trip {
  _id: string;
  status: string;
  bookingId: { bookingNumber: string; pickupLocation: { address: string }; dropLocation?: { address: string }; fareSnapshot?: { total: number } };
  startTime?: string;
  endTime?: string;
  odometerStart?: number;
  odometerEnd?: number;
  distance?: number;
  fare?: { total: number };
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'text-yellow-400' },
  ACCEPTED: { label: 'Accepted', color: 'text-blue-400' },
  EN_ROUTE: { label: 'En Route to Pickup', color: 'text-cyan-400' },
  ARRIVED: { label: 'Arrived at Pickup', color: 'text-teal-400' },
  STARTED: { label: 'Trip Started', color: 'text-green-400' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-400' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400' },
};

export function TripPage({ auth }: TripPageProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Trip[] }>('/driver/trips?limit=30', auth.token);
      setTrips(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  return (
    <div className="safe-area-top px-5 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">My Trips</h1>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card animate-pulse h-28" />)}</div>
      ) : trips.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🚖</div>
          <div className="text-gray-400">No trips yet</div>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => {
            const meta = STATUS_META[trip.status] ?? { label: trip.status, color: 'text-gray-400' };
            return (
              <div key={trip._id} className="card">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-blue-400 text-sm">{trip.bookingId?.bookingNumber}</span>
                  <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                </div>
                <div className="text-sm text-gray-300 truncate mb-1">
                  📍 {trip.bookingId?.pickupLocation?.address}
                </div>
                {trip.bookingId?.dropLocation && (
                  <div className="text-sm text-gray-500 truncate">
                    🏁 {trip.bookingId.dropLocation.address}
                  </div>
                )}
                <div className="flex justify-between mt-3 text-xs text-gray-500">
                  {trip.distance && <span>{trip.distance.toFixed(1)} km</span>}
                  {trip.fare && <span className="text-white font-medium">₹{trip.fare.total.toFixed(2)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
