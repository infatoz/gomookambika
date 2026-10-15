import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  Wallet,
  TrendingUp,
  IndianRupee,
  Car,
  Award,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  QrCode,
  CheckCircle2,
} from 'lucide-react';

interface AuthState {
  token: string | null;
  driver?: {
    upiId?: string;
    upiBeneficiaryName?: string;
  } | null;
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
      setEarnings({
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        totalTrips: 0,
        avgFare: 0,
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
    <div className="px-3.5 py-3 space-y-4 safe-area-top">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-neutral-900/90 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/[0.08] shadow-lg">
        <div>
          <h1 className="text-lg font-black text-white tracking-tight">Earnings</h1>
          <div className="text-xs text-neutral-400 mt-0.5">Direct Payouts & Settlement</div>
        </div>
        <button
          onClick={fetchEarnings}
          disabled={loading}
          className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 hover:text-white transition-all active:scale-95"
          title="Refresh earnings"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Period Switcher (Uber Driver Style) */}
      <div className="grid grid-cols-3 p-1 bg-neutral-900 rounded-2xl border border-white/[0.08] gap-1">
        {(['today', 'week', 'month'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`py-2 rounded-xl text-xs font-bold transition-all ${
              period === p
                ? 'bg-white text-black shadow-md font-extrabold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
          </button>
        ))}
      </div>

      {/* Hero Earnings Card (Uber Driver Style) */}
      <div className="p-6 rounded-3xl bg-neutral-900 border border-white/[0.08] shadow-2xl relative overflow-hidden space-y-3">
        <div className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4" />
          <span>Net Take-Home Earnings</span>
        </div>

        <div className="text-4xl font-black text-white font-mono flex items-center tracking-tight">
          <IndianRupee className="w-8 h-8 text-emerald-400 mr-1 stroke-[2.5]" />
          <span>{Math.round(currentAmount)}</span>
        </div>

        <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs text-neutral-400">
          <span>Settled to Bank UPI / Cash</span>
          <span className="text-emerald-400 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Instant</span>
          </span>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/[0.08] space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Car className="w-4 h-4 text-emerald-400" />
            <span>Total Rides</span>
          </div>
          <div className="text-2xl font-black text-white font-mono">
            {earnings?.totalTrips ?? 0}
          </div>
          <div className="text-[11px] text-neutral-500">Completed rides</div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900 border border-white/[0.08] space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Avg. Per Ride</span>
          </div>
          <div className="text-2xl font-black text-white font-mono flex items-center">
            <IndianRupee className="w-5 h-5 text-neutral-400 mr-0.5" />
            <span>{Math.round(earnings?.avgFare ?? 0)}</span>
          </div>
          <div className="text-[11px] text-neutral-500">Average ticket size</div>
        </div>
      </div>

      {/* Payout Details Card */}
      <div className="p-4 rounded-2xl bg-neutral-900 border border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center text-emerald-400">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-white">Registered UPI Settlement</div>
            <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
              {auth.driver?.upiId || 'Direct Bank UPI'}
            </div>
          </div>
        </div>
        <div className="text-[11px] text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          Active
        </div>
      </div>
    </div>
  );
}
