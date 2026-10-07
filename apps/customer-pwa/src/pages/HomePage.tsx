import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AuthState { token: string | null; user: { name?: string; phone: string } | null; }

interface HomePageProps {
  auth: AuthState;
  onBook: () => void;
}

interface ActiveBooking {
  _id: string;
  bookingNumber: string;
  status: string;
  pickupLocation: { address: string };
  dropLocation?: { address: string };
  assignedDriverId?: { name: string; phone: string };
}

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Finding driver...', color: 'text-yellow-400', icon: '🔍' },
  CONFIRMED: { label: 'Confirmed', color: 'text-blue-400', icon: '✅' },
  DRIVER_ASSIGNED: { label: 'Driver assigned', color: 'text-indigo-400', icon: '👤' },
  EN_ROUTE: { label: 'Driver on the way', color: 'text-cyan-400', icon: '🚗' },
  ARRIVED: { label: 'Driver arrived', color: 'text-teal-400', icon: '📍' },
  TRIP_STARTED: { label: 'Trip in progress', color: 'text-green-400', icon: '🛣️' },
};

export function HomePage({ auth, onBook }: HomePageProps) {
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await api.get<{ data: ActiveBooking[] }>(
          '/bookings?status=PENDING,CONFIRMED,DRIVER_ASSIGNED,EN_ROUTE,ARRIVED,TRIP_STARTED&limit=1',
          auth
        );
        setActiveBooking(res.data?.[0] ?? null);
      } catch {
        // No active booking
      } finally {
        setLoadingBooking(false);
      }
    };
    fetchActive();
    const interval = setInterval(fetchActive, 10000);
    return () => clearInterval(interval);
  }, [auth]);

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="safe-area-top">
      {/* Header */}
      <div className="px-5 pt-6 pb-4">
        <p className="text-gray-400 text-sm">{greeting()},</p>
        <h1 className="text-2xl font-bold text-white">
          {auth.user?.name ?? 'Welcome back'} 👋
        </h1>
      </div>

      {/* Active Booking Banner */}
      {!loadingBooking && activeBooking && (
        <div className="mx-5 mb-4 p-4 rounded-2xl bg-blue-600/20 border border-blue-500/30 fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="pulse-dot" />
            <span className="text-sm font-medium text-blue-300">Active Trip</span>
            <span className="text-xs text-blue-400 ml-auto font-mono">{activeBooking.bookingNumber}</span>
          </div>
          <div className={`text-sm font-semibold ${STATUS_DISPLAY[activeBooking.status]?.color ?? 'text-white'} mb-2`}>
            {STATUS_DISPLAY[activeBooking.status]?.icon} {STATUS_DISPLAY[activeBooking.status]?.label ?? activeBooking.status}
          </div>
          <div className="text-xs text-gray-300 truncate">
            📍 {activeBooking.pickupLocation.address}
          </div>
          {activeBooking.dropLocation && (
            <div className="text-xs text-gray-400 truncate mt-0.5">
              🏁 {activeBooking.dropLocation.address}
            </div>
          )}
          {activeBooking.assignedDriverId && (
            <div className="mt-3 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-400">Driver</div>
                <div className="text-sm text-white font-medium">{activeBooking.assignedDriverId.name}</div>
              </div>
              <a
                href={`tel:${activeBooking.assignedDriverId.phone}`}
                className="bg-green-500/20 text-green-400 text-xs px-3 py-1.5 rounded-full border border-green-500/30"
              >
                📞 Call
              </a>
            </div>
          )}
        </div>
      )}

      {/* Quick Book Card */}
      <div className="px-5 mb-6">
        <div
          className="rounded-2xl p-6 cursor-pointer active:scale-98 transition-all"
          style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #3b82f6 100%)' }}
          onClick={onBook}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white">Book a Cab</h2>
              <p className="text-blue-200 text-sm mt-1">Fast, safe, and affordable</p>
            </div>
            <span className="text-5xl">🚖</span>
          </div>
          <div className="bg-white/20 rounded-xl px-4 py-3 text-white/70 text-sm">
            Where do you want to go? →
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 mb-6">
        <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider">Quick Actions</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: '🏥', label: 'Hospital', action: onBook },
            { icon: '✈️', label: 'Airport', action: onBook },
            { icon: '🕌', label: 'Mookambika', action: onBook },
            { icon: '🏨', label: 'Hotel', action: onBook },
            { icon: '🚉', label: 'Railway', action: onBook },
            { icon: '📍', label: 'Custom', action: onBook },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className="card text-center py-4 hover:border-blue-500/30 transition-all active:scale-95"
            >
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-xs text-gray-400">{item.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Info Strip */}
      <div className="px-5 mb-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Safe', icon: '🛡️', desc: 'Verified drivers' },
            { label: 'Fast', icon: '⚡', desc: 'Quick pickup' },
            { label: 'Fair', icon: '💰', desc: 'No surge pricing' },
          ].map(item => (
            <div key={item.label} className="card py-4">
              <div className="text-2xl mb-1">{item.icon}</div>
              <div className="text-xs font-semibold text-white">{item.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
