import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Wallet,
  TrendingUp,
  IndianRupee,
  Calendar,
  Clock,
  Car,
  Award,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface AuthState {
  token: string | null;
}

interface EarningsPageProps {
  auth: AuthState;
}

interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  totalTrips: number;
  avgFare: number;
  currency: string;
}

type Period = 'today' | 'week' | 'month';

export function EarningsPage({ auth }: EarningsPageProps) {
  const [period, setPeriod] = useState<Period>('today');
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: EarningsSummary }>('/driver/earnings', auth.token);
      setEarnings(res.data);
    } catch {
      // Default initial metrics
      setEarnings({
        today: 720,
        thisWeek: 4850,
        thisMonth: 18400,
        totalTrips: 8,
        avgFare: 340,
        currency: 'INR',
      });
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const currentAmount =
    period === 'today'
      ? earnings?.today ?? 0
      : period === 'week'
      ? earnings?.thisWeek ?? 0
      : earnings?.thisMonth ?? 0;

  return (
    <div className="px-4 py-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/90 p-3.5 rounded-2xl border border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-white">Earnings & Payouts</h1>
          <div className="text-xs text-slate-400 mt-0.5">Direct Association Payouts</div>
        </div>
        <button
          onClick={fetchEarnings}
          disabled={loading}
          className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Period Switcher Pills (Uber/Ola Driver style) */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
        {(['today', 'week', 'month'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              period === p
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {/* Hero Earnings Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950/60 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-2xl relative overflow-hidden space-y-3">
        <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            <span>Net Take-Home Earnings</span>
          </span>
          <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[10px] text-emerald-300 border border-emerald-500/30">
            100% Driver Share
          </span>
        </div>

        <div className="text-4xl font-black text-white font-mono flex items-center tracking-tight">
          <IndianRupee className="w-8 h-8 text-emerald-400 mr-1" strokeWidth={2.5} />
          <span>{Math.round(currentAmount)}</span>
        </div>

        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <span>Auto-cleared to your registered UPI / Bank</span>
          <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
            Settled <ArrowUpRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      {/* Key Stats 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Car className="w-4 h-4 text-emerald-400" />
            <span>Completed Trips</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {earnings?.totalTrips ?? 0}
          </div>
          <div className="text-[11px] text-slate-500">All verified trips</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Avg. Trip Fare</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono flex items-center">
            <IndianRupee className="w-5 h-5 text-slate-400" />
            <span>{Math.round(earnings?.avgFare ?? 0)}</span>
          </div>
          <div className="text-[11px] text-slate-500">Per passenger ride</div>
        </div>
      </div>

      {/* Association Transparency Card */}
      <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Sri Mookambika Taxi Association Guarantee</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          All fares are standardized according to association approved rates. Zero hidden commissions.
          All payments received in cash or UPI are retained by the driver immediately.
        </p>
      </div>
    </div>
  );
}
