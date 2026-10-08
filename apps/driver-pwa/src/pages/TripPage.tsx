import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Car,
  MapPin,
  Calendar,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Navigation,
} from 'lucide-react';

interface AuthState {
  token: string | null;
}

interface TripPageProps {
  auth: AuthState;
}

interface Trip {
  _id: string;
  status: string;
  bookingId?: {
    bookingNumber?: string;
    pickupLocation?: { address: string };
    dropLocation?: { address: string };
    fareSnapshot?: { total: number };
  };
  pickupLocation?: { address: string };
  dropLocation?: { address: string };
  startTime?: string;
  endTime?: string;
  createdAt?: string;
  distance?: number;
  fare?: { total: number };
}

const STATUS_CONFIG: Record<
  string,
  { label: string; textClass: string; bgClass: string; icon: typeof CheckCircle2 }
> = {
  COMPLETED: {
    label: 'Completed',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/15 border-emerald-500/30',
    icon: CheckCircle2,
  },
  TRIP_STARTED: {
    label: 'In Progress',
    textClass: 'text-blue-400',
    bgClass: 'bg-blue-500/15 border-blue-500/30',
    icon: Navigation,
  },
  DRIVER_ACCEPTED: {
    label: 'Accepted',
    textClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/15 border-cyan-500/30',
    icon: Clock,
  },
  CANCELLED: {
    label: 'Cancelled',
    textClass: 'text-rose-400',
    bgClass: 'bg-rose-500/15 border-rose-500/30',
    icon: XCircle,
  },
};

export function TripPage({ auth }: TripPageProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Trip[] }>('/driver/trips?limit=30', auth.token);
      setTrips(res.data ?? []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white">My Trips History</h1>
          <div className="text-xs text-slate-400 mt-0.5">
            {trips.length} {trips.length === 1 ? 'trip completed' : 'trips completed'}
          </div>
        </div>
        <button
          onClick={fetchTrips}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Trips list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse h-32"
            />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-16 p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <Car className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-white">No Trips Yet</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
            Check in at a taxi stand queue to start receiving trip requests.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map(trip => {
            const booking = trip.bookingId;
            const cfg = STATUS_CONFIG[trip.status] || {
              label: trip.status,
              textClass: 'text-slate-400',
              bgClass: 'bg-slate-800 border-slate-700',
              icon: AlertCircle,
            };
            const StatusIcon = cfg.icon;
            const pickup =
              booking?.pickupLocation?.address || trip.pickupLocation?.address || 'Pickup Point';
            const drop = booking?.dropLocation?.address || trip.dropLocation?.address;
            const fareAmount = trip.fare?.total || booking?.fareSnapshot?.total || 0;
            const bookingNumber = booking?.bookingNumber || trip._id.slice(-8).toUpperCase();

            return (
              <div
                key={trip._id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all shadow-md space-y-3"
              >
                {/* Top: Booking # and Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400">
                      {bookingNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(trip.createdAt || trip.startTime)}
                    </span>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${cfg.bgClass} ${cfg.textClass}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    <span>{cfg.label}</span>
                  </div>
                </div>

                {/* Route timeline */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0 ring-2 ring-emerald-500/20" />
                    <span className="text-slate-300 font-medium truncate">{pickup}</span>
                  </div>

                  {drop && (
                    <div className="flex items-start gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400 mt-1 shrink-0 ring-2 ring-rose-500/20" />
                      <span className="text-slate-400 truncate">{drop}</span>
                    </div>
                  )}
                </div>

                {/* Footer: Distance & Fare */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                  <div className="text-slate-500">
                    {trip.distance ? `${trip.distance.toFixed(1)} km ride` : 'Standard route'}
                  </div>

                  {fareAmount > 0 && (
                    <div className="flex items-center font-bold text-sm text-white font-mono">
                      <IndianRupee className="w-3.5 h-3.5 text-emerald-400 mr-0.5" />
                      <span>{Math.round(fareAmount)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
