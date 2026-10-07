import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

interface AuthState { token: string | null; }
interface EarningsPageProps { auth: AuthState; }

interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  totalTrips: number;
  avgFare: number;
  currency: string;
}

export function EarningsPage({ auth }: EarningsPageProps) {
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: EarningsSummary }>('/driver/earnings', auth.token);
      setEarnings(res.data);
    } catch {
      // Use placeholders if endpoint not ready
      setEarnings({ today: 0, thisWeek: 0, thisMonth: 0, totalTrips: 0, avgFare: 0, currency: 'INR' });
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => { fetchEarnings(); }, [fetchEarnings]);

  const fmt = (n: number) => `₹${n.toFixed(2)}`;

  return (
    <div className="safe-area-top px-5 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Earnings</h1>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="card animate-pulse h-24" />)}</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card text-center py-5">
              <div className="text-xs text-gray-400 mb-1">Today</div>
              <div className="text-green-400 font-bold text-2xl">{fmt(earnings?.today ?? 0)}</div>
            </div>
            <div className="card text-center py-5">
              <div className="text-xs text-gray-400 mb-1">This Week</div>
              <div className="text-white font-bold text-2xl">{fmt(earnings?.thisWeek ?? 0)}</div>
            </div>
            <div className="card text-center py-5">
              <div className="text-xs text-gray-400 mb-1">This Month</div>
              <div className="text-white font-bold text-2xl">{fmt(earnings?.thisMonth ?? 0)}</div>
            </div>
            <div className="card text-center py-5">
              <div className="text-xs text-gray-400 mb-1">Total Trips</div>
              <div className="text-blue-400 font-bold text-2xl">{earnings?.totalTrips ?? 0}</div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-white font-semibold mb-3">Trip Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Average Fare</span>
              <span className="text-white">{fmt(earnings?.avgFare ?? 0)}</span>
            </div>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Earnings are updated after each trip is completed
          </div>
        </>
      )}
    </div>
  );
}
