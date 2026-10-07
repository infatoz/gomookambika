import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCw, QrCode, Users, MapPin, AlertTriangle, Clock } from 'lucide-react';
import apiClient from '@/lib/apiClient';

interface QueueEntry {
  _id: string;
  position: number;
  status: string;
  driverId: { name: string; phone: string; driverCode: string };
  vehicleId: { registrationNumber: string; vehicleModel: string; brand: string };
  vehicleCategoryId: { _id: string; name: string; code: string };
  joinedAt: string;
  lastHeartbeat: string;
}

interface TaxiStand {
  _id: string;
  name: string;
  status: string;
  locationId: { name: string };
  allowedVehicleCategories: { _id: string; name: string; code: string }[];
}

interface QueueData {
  stand: TaxiStand;
  entries: QueueEntry[];
  byCategory: Record<string, QueueEntry[]>;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function minutesAgo(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

function heartbeatColor(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 2) return 'text-emerald-400';
  if (mins < 5) return 'text-yellow-400';
  return 'text-red-400';
}

const STATUS_BADGE: Record<string, string> = {
  WAITING: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  OFFERED: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  ON_TRIP: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const categoryIcon = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('bus') || n.includes('mini')) return 'ðŸšŒ';
  if (n.includes('tempo') || n.includes('traveller')) return 'ðŸš';
  if (n.includes('auto')) return 'ðŸ›º';
  if (n.includes('luxury') || n.includes('premium')) return 'ðŸš˜';
  if (n.includes('suv') || n.includes('innova')) return 'ðŸš™';
  return 'ðŸš—';
};

// â”€â”€â”€ Category Queue Panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CategoryQueuePanel({ categoryName, categoryCode, entries }: {
  categoryName: string;
  categoryCode: string;
  entries: QueueEntry[];
}) {
  const waiting = entries.filter(e => e.status === 'WAITING');
  const offered = entries.filter(e => e.status === 'OFFERED');

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      {/* Category header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">{categoryIcon(categoryName)}</span>
          <div>
            <div className="text-sm font-semibold text-slate-900">{categoryName}</div>
            <div className="text-xs text-slate-400 font-mono">{categoryCode}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            <span className="text-emerald-400 font-semibold">{waiting.length}</span> waiting
            {offered.length > 0 && <span className="ml-2 text-yellow-400 font-semibold">{offered.length} offered</span>}
          </span>
        </div>
      </div>

      {/* Queue entries */}
      {entries.length === 0 ? (
        <div className="py-6 text-center text-gray-600 text-sm">No drivers in queue</div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {entries
            .slice()
            .sort((a, b) => a.position - b.position)
            .map(entry => (
              <div key={entry._id} className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                {/* Position badge */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                  ${entry.position === 1 ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40' : 'bg-slate-50 text-slate-500'}`}>
                  {entry.position}
                </div>

                {/* Driver info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-900">
                      {entry.driverId?.name ?? 'Unknown'}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${STATUS_BADGE[entry.status] ?? 'bg-gray-500/10 text-slate-500 border-gray-500/20'}`}>
                      {entry.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{entry.driverId?.driverCode}</span>
                    {entry.vehicleId && (
                      <span>Â· {entry.vehicleId.registrationNumber}</span>
                    )}
                  </div>
                </div>

                {/* Heartbeat */}
                <div className="text-right shrink-0">
                  <div className={`text-xs flex items-center gap-1 ${heartbeatColor(entry.lastHeartbeat)}`}>
                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                    {minutesAgo(entry.lastHeartbeat)}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5 flex items-center gap-1">
                    <Clock size={10} />
                    {minutesAgo(entry.joinedAt)}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Stand Queue Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StandQueueCard({ standId, onRegenerateQR }: { standId: string; onRegenerateQR: (id: string, name: string) => void }) {
  const { data, isLoading, error } = useQuery<QueueData>({
    queryKey: ['queue', standId],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/taxi-stands/${standId}/queue`);
      return res.data?.data ?? res.data;
    },
    refetchInterval: 10_000,
  });

  const stand = data?.stand;
  const byCategory = data?.byCategory ?? {};
  const totalInQueue = data?.entries?.length ?? 0;

  return (
    <div className="card space-y-4">
      {/* Stand header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-blue-400 shrink-0" />
            <h3 className="font-semibold text-slate-900">{stand?.name ?? '...'}</h3>
            {stand?.status === 'ACTIVE'
              ? <span className="text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">Active</span>
              : <span className="text-xs bg-gray-500/15 text-slate-500 border border-gray-500/30 px-1.5 py-0.5 rounded">Inactive</span>
            }
          </div>
          {stand?.locationId && (
            <div className="text-xs text-slate-400 mt-1 ml-6">{stand.locationId.name}</div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="text-2xl font-bold text-slate-900">{totalInQueue}</div>
            <div className="text-xs text-slate-400">in queue</div>
          </div>
          <button
            onClick={() => onRegenerateQR(standId, stand?.name ?? standId)}
            className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-all"
            title="Regenerate QR"
          >
            <QrCode size={16} />
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertTriangle size={14} /> Failed to load queue
        </div>
      )}

      {/* Per-category queues */}
      {!isLoading && (
        <div className="space-y-3">
          {Object.keys(byCategory).length === 0 ? (
            <div className="text-center py-6 text-gray-600 text-sm">
              <Users size={24} className="mx-auto mb-2 opacity-30" />
              No drivers in queue
            </div>
          ) : (
            Object.entries(byCategory).map(([catName, entries]) => {
              const code = (entries[0] as QueueEntry)?.vehicleCategoryId?.code ?? catName;
              return (
                <CategoryQueuePanel
                  key={catName}
                  categoryName={catName}
                  categoryCode={code}
                  entries={entries}
                />
              );
            })
          )}

          {/* Show allowed categories with 0 drivers */}
          {stand?.allowedVehicleCategories?.filter(c => !byCategory[c.name]).map(cat => (
            <CategoryQueuePanel
              key={cat._id}
              categoryName={cat.name}
              categoryCode={cat.code}
              entries={[]}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function QueuePage() {
  const qc = useQueryClient();
  const [qrLoading, setQrLoading] = useState<string | null>(null);

  const { data: stands, isLoading } = useQuery<TaxiStand[]>({
    queryKey: ['admin-taxi-stands'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/taxi-stands');
      return res.data?.data ?? [];
    },
    refetchInterval: 30_000,
  });

  const handleRegenerateQR = async (standId: string, standName: string) => {
    if (!confirm(`Regenerate QR code for "${standName}"?\n\nAll printed QR codes will become invalid.`)) return;
    setQrLoading(standId);
    try {
      const res = await apiClient.post(`/admin/taxi-stands/${standId}/regenerate-qr`, {});
      const url = res.data?.data?.qrDataUrl ?? res.data?.qrDataUrl;
      if (url) {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(`
            <html><head><title>QR Code â€“ ${standName}</title>
            <style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#0f111a;flex-direction:column;gap:16px;}
            h2{color:#fff;font-family:sans-serif;} img{border-radius:12px;}</style></head>
            <body><h2>${standName}</h2><img src="${url}" style="width:400px"/></body></html>
          `);
          w.document.close();
        }
      }
      qc.invalidateQueries({ queryKey: ['admin-taxi-stands'] });
    } catch {
      alert('Failed to regenerate QR. Please try again.');
    } finally {
      setQrLoading(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Queue Management</h1>
          <p className="text-slate-500 text-sm mt-1">
            Live driver queues â€” separated by vehicle category per stand
          </p>
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['queue'] })}
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:text-slate-900 hover:border-slate-300 transition-all"
        >
          <RefreshCw size={14} /> Refresh All
        </button>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
        Auto-refreshes every 10 seconds
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Stand cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {stands?.map(stand => (
          <StandQueueCard
            key={stand._id}
            standId={stand._id}
            onRegenerateQR={handleRegenerateQR}
          />
        ))}
      </div>

      {!isLoading && (!stands || stands.length === 0) && (
        <div className="text-center py-16 text-gray-600">
          <MapPin size={40} className="mx-auto mb-3 opacity-30" />
          <p>No taxi stands configured.</p>
          <p className="text-sm mt-1">Go to Locations â†’ Taxi Stands to add one.</p>
        </div>
      )}

      {qrLoading && (
        <div className="fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-600 text-slate-900 text-sm shadow-lg">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Generating QR code...
        </div>
      )}
    </div>
  );
}
