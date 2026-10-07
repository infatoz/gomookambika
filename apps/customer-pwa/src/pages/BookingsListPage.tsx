import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface AuthState { token: string | null; }
interface BookingsListPageProps { auth: AuthState; }

interface Booking {
  _id: string;
  bookingNumber: string;
  status: string;
  tripType: string;
  pickupLocation: { address: string };
  dropLocation?: { address: string };
  vehicleCategoryId: { name: string };
  fareSnapshot?: { total: number };
  createdAt: string;
  assignedDriverId?: { name: string; phone: string };
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'text-yellow-400' },
  CONFIRMED: { label: 'Confirmed', color: 'text-blue-400' },
  DRIVER_ASSIGNED: { label: 'Driver Assigned', color: 'text-indigo-400' },
  EN_ROUTE: { label: 'Driver En Route', color: 'text-cyan-400' },
  ARRIVED: { label: 'Driver Arrived', color: 'text-teal-400' },
  TRIP_STARTED: { label: 'Trip Started', color: 'text-green-400' },
  COMPLETED: { label: 'Completed', color: 'text-emerald-400' },
  CANCELLED: { label: 'Cancelled', color: 'text-red-400' },
  EXPIRED: { label: 'Expired', color: 'text-gray-400' },
};

export function BookingsListPage({ auth }: BookingsListPageProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: Booking[] }>('/bookings?limit=30', auth);
      setBookings(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const isActive = (b: Booking) =>
    ['PENDING', 'CONFIRMED', 'DRIVER_ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'TRIP_STARTED'].includes(b.status);

  const active = bookings.filter(isActive);
  const past = bookings.filter(b => !isActive(b));

  return (
    <div className="safe-area-top px-5 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">My Trips</h1>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card animate-pulse h-28" />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🚖</div>
          <div className="text-gray-400">No trips yet</div>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active</h2>
              <div className="space-y-3">
                {active.map(b => <BookingCard key={b._id} booking={b} onClick={() => setSelected(b)} />)}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Past</h2>
              <div className="space-y-3">
                {past.map(b => <BookingCard key={b._id} booking={b} onClick={() => setSelected(b)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end" onClick={() => setSelected(null)}>
          <div
            className="w-full bg-[rgb(22,26,40)] border-t border-white/10 rounded-t-3xl p-6 space-y-4 slide-up max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-2" />

            <div className="flex justify-between items-start">
              <div>
                <div className="font-mono text-blue-400 text-lg">{selected.bookingNumber}</div>
                <div className={`text-sm ${STATUS_META[selected.status]?.color ?? 'text-gray-400'}`}>
                  {STATUS_META[selected.status]?.label ?? selected.status}
                </div>
              </div>
              {selected.fareSnapshot && (
                <div className="text-green-400 font-bold text-xl">
                  ₹{selected.fareSnapshot.total.toFixed(2)}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex gap-3 text-sm">
                <span className="text-green-400">📍</span>
                <div><div className="text-xs text-gray-400">Pickup</div><div className="text-white">{selected.pickupLocation.address}</div></div>
              </div>
              {selected.dropLocation && (
                <div className="flex gap-3 text-sm">
                  <span className="text-red-400">🏁</span>
                  <div><div className="text-xs text-gray-400">Drop</div><div className="text-white">{selected.dropLocation.address}</div></div>
                </div>
              )}
            </div>

            {selected.assignedDriverId && (
              <div className="card">
                <div className="text-xs text-gray-400 mb-2">Driver</div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{selected.assignedDriverId.name}</div>
                    <div className="text-gray-400 text-sm">{selected.assignedDriverId.phone}</div>
                  </div>
                  <a href={`tel:${selected.assignedDriverId.phone}`}
                    className="bg-green-500/20 text-green-400 px-4 py-2 rounded-xl text-sm border border-green-500/30">
                    📞 Call
                  </a>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500">
              {new Date(selected.createdAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}
            </div>

            <button onClick={() => setSelected(null)} className="btn-secondary w-full">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookingCard({ booking, onClick }: { booking: Booking; onClick: () => void }) {
  const meta = STATUS_META[booking.status] ?? { label: booking.status, color: 'text-gray-400' };
  return (
    <div className="card cursor-pointer active:scale-[0.99] transition-all hover:border-white/15" onClick={onClick}>
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-blue-400 text-sm">{booking.bookingNumber}</span>
        <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
      </div>
      <div className="text-sm text-gray-300 truncate mb-1">
        📍 {booking.pickupLocation.address}
      </div>
      {booking.dropLocation && (
        <div className="text-sm text-gray-500 truncate">
          🏁 {booking.dropLocation.address}
        </div>
      )}
      <div className="flex justify-between mt-3 text-xs text-gray-500">
        <span>{booking.vehicleCategoryId?.name}</span>
        {booking.fareSnapshot && <span className="text-white font-medium">₹{booking.fareSnapshot.total.toFixed(2)}</span>}
      </div>
    </div>
  );
}
