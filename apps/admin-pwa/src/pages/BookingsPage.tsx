import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/apiClient';

interface Booking {
  _id: string;
  bookingNumber: string;
  status: string;
  tripType: string;
  customerId: { name: string; phone: string };
  pickupLocation: { address: string };
  dropLocation?: { address: string };
  vehicleCategoryId: { name: string; code: string };
  fareSnapshot?: { total: number; currency: string };
  paymentStatus: string;
  paymentOption: string;
  scheduledAt?: string;
  createdAt: string;
  assignedDriverId?: { name: string; phone: string };
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'text-yellow-400 bg-yellow-400/10',
  CONFIRMED: 'text-blue-400 bg-blue-400/10',
  DRIVER_ASSIGNED: 'text-indigo-400 bg-indigo-400/10',
  EN_ROUTE: 'text-cyan-400 bg-cyan-400/10',
  ARRIVED: 'text-teal-400 bg-teal-400/10',
  TRIP_STARTED: 'text-green-400 bg-green-400/10',
  COMPLETED: 'text-emerald-500 bg-emerald-500/10',
  CANCELLED: 'text-red-400 bg-red-400/10',
  EXPIRED: 'text-gray-400 bg-gray-400/10',
};

const PAYMENT_COLORS: Record<string, string> = {
  PAID: 'text-green-400',
  PENDING: 'text-yellow-400',
  FAILED: 'text-red-400',
  REFUNDED: 'text-purple-400',
};

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiClient.get(`/admin/bookings?${params}`);
      setBookings(res.data?.data ?? []);
      setTotalPages(res.data?.pagination?.totalPages ?? 1);
      setTotal(res.data?.pagination?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const formatDate = (d?: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  };

  const formatCurrency = (amount?: number) =>
    amount != null ? `₹${amount.toFixed(2)}` : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Bookings</h1>
          <p className="text-gray-400 text-sm mt-1">{total} total bookings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <input
          type="text"
          placeholder="Search by booking# or customer..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="input-field flex-1 min-w-64"
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-field"
        >
          <option value="">All Statuses</option>
          {Object.keys(STATUS_COLORS).map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left p-4">Booking#</th>
              <th className="text-left p-4">Customer</th>
              <th className="text-left p-4">Route</th>
              <th className="text-left p-4">Category</th>
              <th className="text-left p-4">Fare</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Payment</th>
              <th className="text-left p-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-white/5">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="p-4">
                      <div className="h-4 w-24 bg-white/5 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : bookings.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-12 text-center text-gray-500">
                  No bookings found
                </td>
              </tr>
            ) : (
              bookings.map(b => (
                <tr
                  key={b._id}
                  className="border-b border-white/5 hover:bg-white/3 cursor-pointer transition-colors"
                  onClick={() => setSelected(b)}
                >
                  <td className="p-4 font-mono text-blue-400">{b.bookingNumber}</td>
                  <td className="p-4">
                    <div className="font-medium text-white">{b.customerId?.name ?? '—'}</div>
                    <div className="text-gray-400 text-xs">{b.customerId?.phone}</div>
                  </td>
                  <td className="p-4 max-w-48">
                    <div className="text-white truncate" title={b.pickupLocation.address}>
                      📍 {b.pickupLocation.address}
                    </div>
                    {b.dropLocation && (
                      <div className="text-gray-400 text-xs truncate mt-1" title={b.dropLocation.address}>
                        🏁 {b.dropLocation.address}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-gray-300">{b.vehicleCategoryId?.name ?? '—'}</td>
                  <td className="p-4 text-white font-medium">{formatCurrency(b.fareSnapshot?.total)}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[b.status] ?? 'text-gray-400'}`}>
                      {b.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-medium ${PAYMENT_COLORS[b.paymentStatus] ?? 'text-gray-400'}`}>
                      {b.paymentStatus}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-xs whitespace-nowrap">
                    {formatDate(b.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <span className="text-gray-400 text-sm">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
                className="btn-secondary py-1 px-3 text-xs disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-end"
          onClick={() => setSelected(null)}>
          <div className="h-full w-full max-w-lg bg-surface-2 border-l border-white/10 overflow-y-auto p-6 space-y-6"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Booking Details</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-white text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-400 mb-1">Booking Number</div>
                <div className="font-mono text-blue-400 text-lg">{selected.bookingNumber}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Status</div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[selected.status] ?? ''}`}>
                    {selected.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Trip Type</div>
                  <div className="text-white text-sm">{selected.tripType.replace(/_/g, ' ')}</div>
                </div>
              </div>

              <div className="border-t border-white/5 pt-4">
                <div className="text-xs text-gray-400 mb-2">Customer</div>
                <div className="text-white font-medium">{selected.customerId?.name}</div>
                <div className="text-gray-400 text-sm">{selected.customerId?.phone}</div>
              </div>

              {selected.assignedDriverId && (
                <div className="border-t border-white/5 pt-4">
                  <div className="text-xs text-gray-400 mb-2">Assigned Driver</div>
                  <div className="text-white font-medium">{selected.assignedDriverId.name}</div>
                  <div className="text-gray-400 text-sm">{selected.assignedDriverId.phone}</div>
                </div>
              )}

              <div className="border-t border-white/5 pt-4 space-y-2">
                <div className="text-xs text-gray-400 mb-2">Route</div>
                <div className="flex gap-2">
                  <span className="text-green-400">📍</span>
                  <div className="text-white text-sm">{selected.pickupLocation.address}</div>
                </div>
                {selected.dropLocation && (
                  <div className="flex gap-2">
                    <span className="text-red-400">🏁</span>
                    <div className="text-white text-sm">{selected.dropLocation.address}</div>
                  </div>
                )}
              </div>

              <div className="border-t border-white/5 pt-4 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Vehicle Category</div>
                  <div className="text-white text-sm">{selected.vehicleCategoryId?.name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Fare</div>
                  <div className="text-white text-sm font-bold">
                    {formatCurrency(selected.fareSnapshot?.total)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Payment</div>
                  <div className={`text-sm font-medium ${PAYMENT_COLORS[selected.paymentStatus] ?? ''}`}>
                    {selected.paymentStatus} ({selected.paymentOption})
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Created</div>
                  <div className="text-white text-sm">{formatDate(selected.createdAt)}</div>
                </div>
                {selected.scheduledAt && (
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Scheduled</div>
                    <div className="text-white text-sm">{formatDate(selected.scheduledAt)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
