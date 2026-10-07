import { useQuery } from '@tanstack/react-query';
import {
  Car, Users, ListOrdered, TrendingUp,
  CheckCircle2, XCircle, Clock, Banknote, RefreshCw,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import apiClient from '@/lib/apiClient';

interface DashboardData {
  todayBookings:   number;
  todayRevenue:    number;
  activeDrivers:   number;
  driversInQueue:  number;
  activeTrips:     number;
  completedToday:  number;
  cancelledToday:  number;
  pendingPayments: number;
}

const bookingTrend = [
  { time: '6am',  bookings: 2 },
  { time: '8am',  bookings: 8 },
  { time: '10am', bookings: 12 },
  { time: '12pm', bookings: 18 },
  { time: '2pm',  bookings: 14 },
  { time: '4pm',  bookings: 22 },
  { time: '6pm',  bookings: 28 },
  { time: '8pm',  bookings: 16 },
  { time: '10pm', bookings: 6 },
];

const statusDistribution = [
  { name: 'Completed', value: 68, color: '#10B981' },
  { name: 'Active',    value: 18, color: '#4F46E5' },
  { name: 'Cancelled', value: 9,  color: '#EF4444' },
  { name: 'Pending',   value: 5,  color: '#F59E0B' },
];

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  accentBg: string;
  trend?: { value: string; up: boolean };
}

function StatCard({ icon: Icon, label, value, sub, accent, accentBg, trend }: StatCardProps) {
  return (
    <div className="stat-card" style={{ padding: '1.25rem 1.375rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px',
          background: accentBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
        {trend && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
            fontSize: '0.6875rem', fontWeight: 600, padding: '0.2rem 0.5rem',
            borderRadius: '999px',
            background: trend.up ? '#ECFDF5' : '#FEF2F2',
            color: trend.up ? '#065F46' : '#991B1B',
          }}>
            {trend.up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trend.value}
          </div>
        )}
      </div>
      <div style={{ fontSize: '1.625rem', fontWeight: 800, color: 'var(--text-heading)', letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.375rem', fontWeight: 500 }}>
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: '0.6875rem', color: accent, marginTop: '0.5rem', fontWeight: 600, opacity: 0.8 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function SkeletonStatCard() {
  return (
    <div style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '1.25rem 1.375rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div className="skeleton" style={{ width: '38px', height: '38px', borderRadius: '10px' }} />
        <div className="skeleton" style={{ width: '50px', height: '20px', borderRadius: '999px' }} />
      </div>
      <div className="skeleton" style={{ width: '80px', height: '26px', borderRadius: '6px', marginBottom: '0.5rem' }} />
      <div className="skeleton" style={{ width: '120px', height: '14px', borderRadius: '6px' }} />
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff', border: '1px solid var(--border)',
      borderRadius: '10px', padding: '0.625rem 0.875rem',
      boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
      fontSize: '0.75rem',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 500 }}>{label}</div>
      <div style={{ color: 'var(--text-heading)', fontWeight: 700, fontSize: '0.9375rem' }}>
        {payload[0].value} bookings
      </div>
    </div>
  );
};

export function DashboardPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/dashboard');
      return res.data.data;
    },
    refetchInterval: 30_000,
  });

  const kpiCards: StatCardProps[] = [
    {
      icon: ListOrdered, label: "Today's Bookings",
      value: data?.todayBookings ?? 0,
      accent: '#4F46E5', accentBg: '#EEF2FF',
      trend: { value: '+12%', up: true },
    },
    {
      icon: Banknote, label: "Today's Revenue",
      value: `₹${((data?.todayRevenue ?? 0) / 100).toLocaleString('en-IN')}`,
      accent: '#059669', accentBg: '#ECFDF5',
      trend: { value: '+8%', up: true },
    },
    {
      icon: Users, label: 'Active Drivers',
      value: data?.activeDrivers ?? 0,
      sub: `${data?.driversInQueue ?? 0} currently in queue`,
      accent: '#7C3AED', accentBg: '#F5F3FF',
    },
    {
      icon: Car, label: 'Live Trips',
      value: data?.activeTrips ?? 0,
      accent: '#D97706', accentBg: '#FFFBEB',
    },
    {
      icon: CheckCircle2, label: 'Completed Today',
      value: data?.completedToday ?? 0,
      accent: '#059669', accentBg: '#ECFDF5',
    },
    {
      icon: XCircle, label: 'Cancelled Today',
      value: data?.cancelledToday ?? 0,
      accent: '#DC2626', accentBg: '#FEF2F2',
      trend: { value: '-3%', up: false },
    },
    {
      icon: Clock, label: 'Pending Payments',
      value: data?.pendingPayments ?? 0,
      accent: '#EA580C', accentBg: '#FFF7ED',
    },
    {
      icon: TrendingUp, label: 'Drivers in Queue',
      value: data?.driversInQueue ?? 0,
      accent: '#2563EB', accentBg: '#EFF6FF',
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          <p className="page-subtitle">Real-time overview · Auto-refreshes every 30 seconds</p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', whiteSpace: 'nowrap' }}
        >
          <RefreshCw size={13} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonStatCard key={i} />)
          : kpiCards.map(card => <StatCard key={card.label} {...card} />)
        }
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1rem' }}>

        {/* Area Chart */}
        <div className="card" style={{ padding: '1.375rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                Booking Volume
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Hourly breakdown for today
              </div>
            </div>
            <div style={{
              fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 500,
              background: 'var(--bg-surface-3)', padding: '0.25rem 0.625rem',
              borderRadius: '6px', border: '1px solid var(--border)',
            }}>
              Today
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={bookingTrend} margin={{ left: -20, right: 4, top: 4 }}>
              <defs>
                <linearGradient id="bgrd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#4F46E5" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#4F46E5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="time" tick={{ fill: '#9CA3AF', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#E0E7FF', strokeWidth: 2 }} />
              <Area
                type="monotone" dataKey="bookings"
                stroke="#4F46E5" strokeWidth={2.5}
                fill="url(#bgrd)"
                dot={false}
                activeDot={{ r: 5, fill: '#4F46E5', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut + Legend */}
        <div className="card" style={{ padding: '1.375rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-heading)' }}>
              Trip Status
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Distribution for today
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <ResponsiveContainer width={180} height={180}>
              <PieChart>
                <Pie
                  data={statusDistribution}
                  cx="50%" cy="50%"
                  innerRadius={56} outerRadius={82}
                  paddingAngle={3} dataKey="value"
                  strokeWidth={0}
                >
                  {statusDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {statusDistribution.map(item => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '999px', background: item.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    {item.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '60px', height: '4px', borderRadius: '999px', background: 'var(--bg-surface-3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${item.value}%`, background: item.color, borderRadius: '999px' }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-heading)', width: '28px', textAlign: 'right' }}>
                    {item.value}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
