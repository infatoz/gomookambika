import { useState, useEffect, useCallback } from 'react';
import { api, AuthState } from '@/lib/api';
import { Clock, MapPin, CheckCircle2, ChevronRight, X, Phone, Car, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { getVehicleImage } from '@/components/UberRideSelector';

interface BookingsListPageProps {
  auth: AuthState;
  onOpenLogin: () => void;
  onSelectBooking?: (booking: Booking) => void;
  onRebook?: (pickup: string, drop?: string) => void;
}

export interface Booking {
  _id: string;
  bookingNumber: string;
  status: string;
  tripType: string;
  pickupLocation: { address: string };
  dropLocation?: { address: string };
  vehicleCategoryId?: { name: string; code?: string };
  fareSnapshot?: { total: number };
  scheduledAt?: string;
  createdAt: string;
  assignedDriverId?: { name: string; phone: string };
  assignedVehicleId?: { registrationNumber?: string; brand?: string; vehicleModel?: string };
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: 'Finding driver', color: 'text-amber-800', bg: 'bg-amber-50 border-amber-200' },
  CONFIRMED: { label: 'Confirmed', color: 'text-blue-800', bg: 'bg-blue-50 border-blue-200' },
  DRIVER_ASSIGNED: { label: 'Driver Assigned', color: 'text-indigo-800', bg: 'bg-indigo-50 border-indigo-200' },
  EN_ROUTE: { label: 'En Route', color: 'text-cyan-800', bg: 'bg-cyan-50 border-cyan-200' },
  ARRIVED: { label: 'Driver Arrived', color: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-200' },
  TRIP_STARTED: { label: 'In Progress', color: 'text-emerald-800', bg: 'bg-emerald-50 border-emerald-200' },
  COMPLETED: { label: 'Completed', color: 'text-neutral-700', bg: 'bg-neutral-100 border-neutral-200' },
  TRIP_COMPLETED: { label: 'Completed', color: 'text-neutral-700', bg: 'bg-neutral-100 border-neutral-200' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  EXPIRED: { label: 'Expired', color: 'text-neutral-500', bg: 'bg-neutral-100 border-neutral-200' },
};

export function BookingsListPage({
  auth,
  onOpenLogin,
  onRebook,
}: BookingsListPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!auth.token) return;
    setLoading(true);
    try {
      const res = await api.get<{ data: Booking[] }>('/bookings?limit=30', auth);
      setBookings(res.data ?? []);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  if (!auth.token) {
    return (
      <div className="max-w-md mx-auto min-h-[calc(100vh-140px)] flex flex-col items-center justify-center p-6 text-center text-black">
        <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center text-3xl mb-4">
          📋
        </div>
        <h2 className="text-2xl font-bold text-neutral-900">Your Activity</h2>
        <p className="text-sm text-neutral-500 mt-2 max-w-xs">
          Sign in to view your ongoing rides, receipts, and past trip history.
        </p>
        <button
          onClick={onOpenLogin}
          className="mt-6 px-6 py-3.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-2xl text-sm transition-all shadow-md active:scale-95"
        >
          Log in or Sign up
        </button>
      </div>
    );
  }

  const isActive = (b: Booking) =>
    ['PENDING', 'SEARCHING_DRIVER', 'CONFIRMED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRIP_STARTED'].includes(
      b.status
    );

  const active = bookings.filter(isActive);
  const past = bookings.filter(b => !isActive(b));

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 text-black">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-neutral-900">
          Activity
        </h1>
        <button
          onClick={fetchBookings}
          className="text-xs font-semibold text-neutral-500 hover:text-black transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-neutral-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-neutral-200 p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center text-3xl mx-auto mb-3">
            🚕
          </div>
          <h3 className="font-bold text-lg text-neutral-900">No past activity</h3>
          <p className="text-xs text-neutral-500 mt-1">
            When you book a ride with Go Mookambika, your receipts and tracking will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Trips Section */}
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Active Rides</span>
              </h2>

              {active.map(b => (
                <BookingCard
                  key={b._id}
                  booking={b}
                  onClick={() => setSelected(b)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}

          {/* Past Trips Section */}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                Past Rides
              </h2>

              {past.map(b => (
                <BookingCard
                  key={b._id}
                  booking={b}
                  onClick={() => setSelected(b)}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Detail Slide-up Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-0 md:p-4 backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full md:max-w-md bg-white rounded-t-3xl md:rounded-3xl p-6 space-y-4 uber-slide-up max-h-[85vh] overflow-y-auto shadow-2xl text-black"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div>
                <span className="text-xs font-mono text-neutral-400">Receipt Details</span>
                <h3 className="text-lg font-bold text-neutral-900">{selected.bookingNumber}</h3>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-neutral-700" />
              </button>
            </div>

            {/* Ride Image & Category */}
            <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200">
              <div className="flex items-center gap-3">
                <img
                  src={getVehicleImage(selected.vehicleCategoryId as any)}
                  alt="Vehicle"
                  className="w-14 h-10 object-contain"
                />
                <div>
                  <h4 className="font-bold text-sm text-neutral-900">
                    {selected.vehicleCategoryId?.name || 'Sedan Comfort'}
                  </h4>
                  <p className="text-xs text-neutral-500">{formatDate(selected.createdAt)}</p>
                </div>
              </div>

              <div className="text-right">
                <div className="font-black text-lg text-neutral-900 font-mono">
                  ₹{Math.round(selected.fareSnapshot?.total || 300)}
                </div>
                <span className="text-[10px] text-neutral-400">Total Paid</span>
              </div>
            </div>

            {/* Route Points */}
            <div className="space-y-3 py-1 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-3.5 h-3.5 rounded-full bg-black mt-0.5 shrink-0" />
                <div>
                  <span className="text-neutral-400 uppercase text-[10px] font-bold block">
                    Pickup
                  </span>
                  <span className="font-medium text-neutral-900">{selected.pickupLocation.address}</span>
                </div>
              </div>

              {selected.dropLocation && (
                <div className="flex items-start gap-2.5">
                  <div className="w-3.5 h-3.5 rounded-sm bg-black mt-0.5 shrink-0" />
                  <div>
                    <span className="text-neutral-400 uppercase text-[10px] font-bold block">
                      Destination
                    </span>
                    <span className="font-medium text-neutral-900">{selected.dropLocation.address}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Rebook CTA */}
            {onRebook && (
              <button
                onClick={() => {
                  onRebook(selected.pickupLocation.address, selected.dropLocation?.address);
                  setSelected(null);
                }}
                className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold rounded-2xl text-sm transition-all"
              >
                Rebook This Ride
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BookingCard({
  booking,
  onClick,
  formatDate,
}: {
  booking: Booking;
  onClick: () => void;
  formatDate: (s: string) => string;
}) {
  const meta = STATUS_META[booking.status] || {
    label: booking.status,
    color: 'text-neutral-700',
    bg: 'bg-neutral-100 border-neutral-200',
  };

  const imageSrc = getVehicleImage(booking.vehicleCategoryId as any);

  return (
    <div
      onClick={onClick}
      className="p-4 rounded-2xl bg-white border border-neutral-200 hover:border-black/30 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 text-black"
    >
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <div className="w-14 h-11 flex items-center justify-center shrink-0">
          <img src={imageSrc} alt="Vehicle" className="max-h-full max-w-full object-contain" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-sm text-neutral-900 truncate">
              {booking.dropLocation?.address || 'Kollur Temple Area'}
            </h4>
          </div>

          <div className="text-xs text-neutral-500 truncate mt-0.5">
            {formatDate(booking.createdAt)}
          </div>

          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}
            >
              {meta.label}
            </span>
            {booking.scheduledAt && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700">
                Scheduled: {formatDate(booking.scheduledAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        <div className="font-black text-sm text-neutral-900 font-mono">
          ₹{Math.round(booking.fareSnapshot?.total || 300)}
        </div>
        <ChevronRight className="w-4 h-4 text-neutral-400 ml-auto mt-1" />
      </div>
    </div>
  );
}
