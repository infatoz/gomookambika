import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  Car,
  Calendar,
  Clock,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Navigation,
  ArrowRight,
  Filter,
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

type FilterTab = 'ALL' | 'COMPLETED' | 'CANCELLED';

const STATUS_CONFIG: Record<
  string,
  { label: string; textClass: string; bgClass: string; icon: typeof CheckCircle2 }
> = {
  COMPLETED: {
    label: 'Completed',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10 border-emerald-500/25',
    icon: CheckCircle2,
  },
  TRIP_STARTED: {
    label: 'In Progress',
    textClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10 border-blue-500/25',
    icon: Navigation,
  },
  DRIVER_ACCEPTED: {
    label: 'Accepted',
    textClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/10 border-cyan-500/25',
    icon: Clock,
  },
  CANCELLED: {
    label: 'Cancelled',
    textClass: 'text-rose-400',
    bgClass: 'bg-rose-500/10 border-rose-500/25',
    icon: XCircle,
  },
};

export function TripPage({ auth }: TripPageProps) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('ALL');

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Trip[] }>('/driver/trips?limit=40', auth.token);
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

  const filteredTrips = useMemo(() => {
    if (filter === 'ALL') return trips;
    if (filter === 'COMPLETED') return trips.filter(t => t.status === 'COMPLETED');
    if (filter === 'CANCELLED') return trips.filter(t => t.status === 'CANCELLED');
    return trips;
  }, [trips, filter]);

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
    <div className="px-3.5 py-3 space-y-4 safe-area-top">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-neutral-900/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/[0.08] shadow-lg">
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">Trip History</h1>
          <div className="text-xs text-neutral-400 mt-0.5">
            {trips.length} {trips.length === 1 ? 'total ride' : 'total rides'}
          </div>
        </div>
        <button
          onClick={fetchTrips}
          disabled={loading}
          className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 hover:text-white transition-all active:scale-95"
          title="Refresh trips"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filter Tabs (Uber Style) */}
      <div className="grid grid-cols-3 p-1 bg-neutral-900 rounded-2xl border border-white/[0.08] gap-1">
        {(['ALL', 'COMPLETED', 'CANCELLED'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              filter === tab
                ? 'bg-white text-black shadow-md font-extrabold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {tab === 'ALL' ? 'All Rides' : tab === 'COMPLETED' ? 'Completed' : 'Cancelled'}
          </button>
        ))}
      </div>

      {/* Trips list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-neutral-900/60 border border-white/[0.06] animate-pulse h-32"
            />
          ))}
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="text-center py-16 p-6 rounded-3xl bg-neutral-900/40 border border-white/[0.06] space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.05] text-neutral-500 flex items-center justify-center mx-auto mb-2">
            <Car className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-white">No Trips Found</h3>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto">
            {filter === 'ALL'
              ? 'Check into a taxi stand queue to receive passenger rides.'
              : `No ${filter.toLowerCase()} trips recorded yet.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTrips.map(trip => {
            const booking = trip.bookingId;
            const cfg = STATUS_CONFIG[trip.status] || {
              label: trip.status,
              textClass: 'text-neutral-400',
              bgClass: 'bg-neutral-800 border-neutral-700',
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
                className="p-4 rounded-2xl bg-neutral-900 border border-white/[0.08] hover:border-white/[0.15] transition-all shadow-md space-y-3"
              >
                {/* Top: Booking # and Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-white">
                      #{bookingNumber}
                    </span>
                    <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(trip.createdAt || trip.startTime)}
                    </span>
                  </div>

                  <div
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${cfg.bgClass} ${cfg.textClass}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    <span>{cfg.label}</span>
                  </div>
                </div>

                {/* Route visualizer */}
                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0 ring-2 ring-emerald-500/20" />
                    <span className="text-neutral-200 font-medium truncate">{pickup}</span>
                  </div>

                  {drop && (
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-400 mt-1 shrink-0 ring-2 ring-rose-500/20" />
                      <span className="text-neutral-400 truncate">{drop}</span>
                    </div>
                  )}
                </div>

                {/* Footer: Distance & Fare */}
                <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                  <div className="text-neutral-400 font-medium">
                    {trip.distance ? `${trip.distance.toFixed(1)} km ride` : 'Standard ride'}
                  </div>

                  {fareAmount > 0 ? (
                    <div className="flex items-center font-black text-base text-white font-mono">
                      <IndianRupee className="w-4 h-4 text-emerald-400 mr-0.5" />
                      <span>{Math.round(fareAmount)}</span>
                    </div>
                  ) : (
                    <div className="text-neutral-500 font-medium">₹0</div>
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
