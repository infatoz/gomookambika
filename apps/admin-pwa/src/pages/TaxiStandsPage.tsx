import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, AlertCircle, Loader2,
  QrCode, Download, RefreshCw, Building2, X,
} from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';
import { SearchInput, FilterSelect, SortHeader, Pagination, TableSkeleton } from '@/components/TableControls';

interface TaxiStand {
  _id: string; name: string; status: string; qrStatus: string; qrGeneratedAt?: string;
  maxQueueSize?: number; queueRadius: number;
  locationId: { _id: string; name: string; code: string };
  allowedVehicleCategories: Array<{ _id: string; name: string; code: string }>;
}
interface LocationOption  { _id: string; name: string; code: string; }
interface CategoryOption  { _id: string; name: string; code: string; }

const EMPTY_FORM = {
  name: '', locationId: '', queueRadius: 150, maxQueueSize: 50,
  allowedVehicleCategories: [] as string[], status: 'ACTIVE',
};

export function TaxiStandsPage() {
  const qc = useQueryClient();
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort]               = useState({ field: 'name', dir: 'asc' as 'asc' | 'desc' });
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<TaxiStand | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [deleteTarget, setDeleteTarget] = useState<TaxiStand | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [qrData, setQrData]           = useState<{ standName: string; url: string } | null>(null);
  const [qrLoading, setQrLoading]     = useState<string | null>(null);
  const LIMIT = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-taxi-stands', page, search, statusFilter, sort],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search)       p.set('search', search);
      if (statusFilter) p.set('status', statusFilter);
      p.set('sortBy', sort.field); p.set('sortOrder', sort.dir);
      const r = await apiClient.get(`/admin/taxi-stands?${p}`);
      return r.data;
    },
    
  });

  const { data: locationsData } = useQuery<LocationOption[]>({
    queryKey: ['locations-list'],
    queryFn: async () => { const r = await apiClient.get('/admin/locations?limit=200'); return r.data?.data ?? []; },
  });

  const { data: catData } = useQuery<CategoryOption[]>({
    queryKey: ['vehicle-categories-list'],
    queryFn: async () => { const r = await apiClient.get('/admin/vehicle-categories'); return r.data?.data ?? []; },
  });

  const stands    = data?.data ?? [];
  const meta      = data?.meta ?? { total: 0, totalPages: 1 };
  const locations = locationsData ?? [];
  const categories = catData ?? [];
  const refresh   = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-taxi-stands'] }), [qc]);

  const toggleSort = (field: string) => {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
    setPage(1);
  };

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true); };
  const openEdit = (s: TaxiStand) => {
    setEditTarget(s);
    setForm({
      name: s.name, locationId: s.locationId?._id ?? '',
      queueRadius: s.queueRadius, maxQueueSize: s.maxQueueSize ?? 50,
      allowedVehicleCategories: s.allowedVehicleCategories?.map(c => c._id) ?? [],
      status: s.status,
    });
    setFormError(''); setDrawerOpen(true);
  };

  const toggleCategory = (id: string) => setForm(f => ({
    ...f,
    allowedVehicleCategories: f.allowedVehicleCategories.includes(id)
      ? f.allowedVehicleCategories.filter(c => c !== id)
      : [...f.allowedVehicleCategories, id],
  }));

  const handleSave = async () => {
    if (!form.name.trim())   { setFormError('Stand name is required'); return; }
    if (!form.locationId)    { setFormError('Please select a location'); return; }
    setSaving(true); setFormError('');
    try {
      if (editTarget) {
        await apiClient.put(`/admin/taxi-stands/${editTarget._id}`, form);
        toast('Taxi stand updated');
      } else {
        await apiClient.post('/admin/taxi-stands', form);
        toast('Taxi stand created');
      }
      setDrawerOpen(false); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFormError(err.response?.data?.message ?? 'Failed to save taxi stand');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/taxi-stands/${deleteTarget._id}`);
      toast('Taxi stand deactivated');
      setDeleteTarget(null); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to deactivate taxi stand', 'error');
    } finally { setDeleting(false); }
  };

  const handleRegenerateQR = async (stand: TaxiStand) => {
    setQrLoading(stand._id);
    try {
      const res = await apiClient.post(`/admin/taxi-stands/${stand._id}/regenerate-qr`, {});
      const url = res.data?.data?.qrDataUrl ?? '';
      setQrData({ standName: stand.name, url });
      refresh(); toast('QR code regenerated');
    } catch { toast('Failed to regenerate QR', 'error'); }
    finally { setQrLoading(null); }
  };

  const hasFilters = search || statusFilter;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Taxi Stands</h1>
          <p className="page-subtitle">{meta.total ?? 0} stands configured</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={14} /> Add Stand
        </button>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1); }}
          placeholder="Search stands by name or location..."
        />
        <FilterSelect
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setPage(1); }}
          placeholder="All Statuses"
          options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
        />
        {hasFilters && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <SortHeader label="Stand Name"   field="name"        sort={sort} onSort={toggleSort} />
              <SortHeader label="Location"     field="locationId"  sort={sort} onSort={toggleSort} />
              <th>Vehicle Types</th>
              <SortHeader label="Radius" field="queueRadius" sort={sort} onSort={toggleSort} />
              <th>Max Queue</th>
              <th>QR</th>
              <SortHeader label="Status" field="status" sort={sort} onSort={toggleSort} />
              <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Actions</th>
            </tr>
          </thead>
          {isLoading ? (
            <TableSkeleton rows={6} cols={8} />
          ) : stands.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Building2 size={24} style={{ color: 'var(--brand-600)' }} />
                    </div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.375rem' }}>
                      No taxi stands found
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      {hasFilters ? 'Try adjusting your filters' : 'Add your first taxi stand to get started'}
                    </div>
                    {!hasFilters && (
                      <button onClick={openCreate} className="btn-primary">
                        <Plus size={14} /> Add Stand
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {stands.map((stand: TaxiStand) => (
                <tr key={stand._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.875rem' }}>{stand.name}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {stand.locationId?.name || 'â€”'}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {stand.locationId?.code}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: '180px' }}>
                      {stand.allowedVehicleCategories?.length > 0
                        ? stand.allowedVehicleCategories.map(cat => (
                          <span key={cat._id} style={{
                            display: 'inline-flex', padding: '0.15rem 0.5rem',
                            borderRadius: '999px', fontSize: '0.6rem', fontWeight: 600,
                            background: 'var(--brand-50)', color: 'var(--brand-700)',
                            border: '1px solid var(--brand-100)',
                          }}>
                            {cat.name}
                          </span>
                        ))
                        : <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>All types</span>
                      }
                    </div>
                  </td>
                  <td style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {stand.queueRadius}m
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {stand.maxQueueSize ?? 'â€”'}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-flex', padding: '0.2rem 0.5rem', borderRadius: '5px',
                      fontSize: '0.6875rem', fontWeight: 600,
                      background: stand.qrStatus === 'ACTIVE' ? '#EEF2FF' : '#F8FAFC',
                      color: stand.qrStatus === 'ACTIVE' ? 'var(--brand-700)' : 'var(--text-muted)',
                      border: `1px solid ${stand.qrStatus === 'ACTIVE' ? 'var(--brand-200)' : 'var(--border)'}`,
                    }}>
                      {stand.qrStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${stand.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}`}>
                      {stand.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem', paddingRight: '0.25rem' }}>
                      <button onClick={() => openEdit(stand)} className="btn-icon primary" title="Edit stand">
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => handleRegenerateQR(stand)}
                        disabled={qrLoading === stand._id}
                        className="btn-icon"
                        title="Regenerate QR Code"
                        style={{ color: 'var(--brand-600)' }}
                      >
                        {qrLoading === stand._id
                          ? <RefreshCw size={13} className="animate-spin" />
                          : <QrCode size={13} />
                        }
                      </button>
                      <button onClick={() => setDeleteTarget(stand)} className="btn-icon danger" title="Deactivate stand">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        <Pagination
          page={page} totalPages={meta.totalPages ?? 1}
          total={meta.total ?? 0} limit={LIMIT}
          onPage={setPage}
        />
      </div>

      {/* â”€â”€ DRAWER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Taxi Stand' : 'New Taxi Stand'}
        subtitle={editTarget ? `Editing: ${editTarget.name}` : 'Configure a queue stand linked to a location'}
        footer={
          <>
            <button onClick={() => setDrawerOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : editTarget ? 'Update Stand' : 'Create Stand'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {formError && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              padding: '0.75rem 1rem', borderRadius: '8px',
              background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '0.8125rem',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              {formError}
            </div>
          )}

          <FormSection title="Stand Details">
            <Field label="Stand Name" required>
              <input className="input-field" placeholder="e.g. Main Bus Stop Stand A"
                value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Location" required hint="The parent location this stand belongs to">
              <select className="input-field" value={form.locationId}
                onChange={e => setForm(f => ({ ...f, locationId: e.target.value }))}>
                <option value="">Select a location...</option>
                {locations.map(l => (
                  <option key={l._id} value={l._id}>{l.name} ({l.code})</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select className="input-field" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </FormSection>

          <FormSection title="Queue Configuration">
            <FormGrid cols={2}>
              <Field label="Queue Radius (m)" hint="Geo-fence radius in metres">
                <input type="number" min={10} max={2000} className="input-field"
                  value={form.queueRadius} onChange={e => setForm(f => ({ ...f, queueRadius: +e.target.value }))} />
              </Field>
              <Field label="Max Queue Size" hint="Maximum drivers in queue">
                <input type="number" min={1} max={500} className="input-field"
                  value={form.maxQueueSize} onChange={e => setForm(f => ({ ...f, maxQueueSize: +e.target.value }))} />
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="Allowed Vehicle Types">
            {categories.length === 0 ? (
              <div style={{
                padding: '0.875rem', borderRadius: '8px', background: 'var(--bg-surface-3)',
                border: '1px solid var(--border)', fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center',
              }}>
                No vehicle categories â€” create them in Vehicle Types first.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', maxHeight: '220px', overflowY: 'auto' }}>
                {categories.map(cat => {
                  const checked = form.allowedVehicleCategories.includes(cat._id);
                  return (
                    <label key={cat._id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      padding: '0.625rem 0.75rem', borderRadius: '8px',
                      border: `1.5px solid ${checked ? 'var(--brand-200)' : 'var(--border)'}`,
                      background: checked ? 'var(--brand-50)' : 'transparent',
                      cursor: 'pointer', transition: 'all 0.12s',
                    }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCategory(cat._id)}
                        style={{ width: '15px', height: '15px', accentColor: 'var(--brand-600)', cursor: 'pointer' }} />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: checked ? 600 : 400, flex: 1 }}>
                        {cat.name}
                      </span>
                      <code style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {cat.code}
                      </code>
                    </label>
                  );
                })}
              </div>
            )}
          </FormSection>
        </div>
      </Drawer>

      {/* QR Modal */}
      {qrData && (
        <div className="modal-backdrop" onClick={() => setQrData(null)} style={{ zIndex: 100 }}>
          <div className="modal-panel animate-scale-in" style={{ maxWidth: '340px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-header-title">{qrData.standName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Drivers scan to join queue
                </div>
              </div>
              <button onClick={() => setQrData(null)} className="btn-icon" style={{ border: 'none', background: 'transparent' }}>
                <X size={15} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', justifyContent: 'center' }}>
              {qrData.url
                ? <img src={qrData.url} alt="QR Code" style={{ width: '200px', height: '200px', borderRadius: '12px', border: '1px solid var(--border)' }} />
                : <div style={{ width: '200px', height: '200px', background: 'var(--bg-surface-3)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No QR data</div>
              }
            </div>
            <div className="modal-footer">
              <button onClick={() => setQrData(null)} className="btn-secondary">Close</button>
              {qrData.url && (
                <a href={qrData.url} download={`${qrData.standName}-qr.png`} className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                  <Download size={13} /> Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget} danger
        title="Deactivate Taxi Stand"
        message={`Deactivate "${deleteTarget?.name}"? Drivers will no longer be able to join this stand's queue.`}
        confirmLabel="Deactivate"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
