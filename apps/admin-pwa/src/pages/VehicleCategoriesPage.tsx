import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, AlertCircle, Loader2,
  Bus, Car, Bike, Truck, Users, Zap, Info, X,
  CheckCircle2, XCircle,
} from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';
import { SearchInput, SortHeader, Pagination, TableSkeleton } from '@/components/TableControls';

interface VehicleCategory {
  _id: string; name: string; code: string; description?: string;
  seatCapacity: number; luggageCapacity: number; ac: boolean; fuelType?: string;
  baseFare: number; minimumKm: number; ratePerKm: number;
  waitingChargePerMin: number; nightChargeMultiplier: number;
  status: 'ACTIVE' | 'INACTIVE'; sortOrder: number;
}

const EMPTY_FORM = {
  name: '', code: '', description: '',
  seatCapacity: 4, luggageCapacity: 2, ac: true, fuelType: 'DIESEL',
  baseFare: 0, minimumKm: 5, ratePerKm: 0,
  waitingChargePerMin: 2, nightChargeMultiplier: 1.1, sortOrder: 0,
};

const FUEL_TYPES = ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID'];

function CategoryIcon({ name, size = 18 }: { name: string; size?: number }) {
  const n = name.toLowerCase();
  if (n.includes('bus') || n.includes('mini'))              return <Bus  size={size} style={{ color: '#6366F1' }} />;
  if (n.includes('tempo') || n.includes('traveller'))       return <Truck size={size} style={{ color: '#7C3AED' }} />;
  if (n.includes('auto') || n.includes('bike') || n.includes('two')) return <Bike size={size} style={{ color: '#EA580C' }} />;
  return <Car size={size} style={{ color: '#475569' }} />;
}

function ToggleSwitch({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
      <div onClick={onChange} className={`toggle-track ${value ? 'on' : 'off'}`}>
        <div className="toggle-thumb" />
      </div>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', userSelect: 'none' }}>{label}</span>
    </label>
  );
}

const INR = (n: number) => `\u20B9${Number(n).toLocaleString('en-IN')}`;

export function VehicleCategoriesPage() {
  const qc = useQueryClient();
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [sort, setSort]               = useState({ field: 'sortOrder', dir: 'asc' as 'asc' | 'desc' });
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<VehicleCategory | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [deleteTarget, setDeleteTarget] = useState<VehicleCategory | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const LIMIT = 20;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-vehicle-categories', page, search, sort],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) p.set('search', search);
      p.set('sortBy', sort.field); p.set('sortOrder', sort.dir);
      const res = await apiClient.get(`/admin/vehicle-categories?${p}`);
      // Support both paginated and flat responses
      if (Array.isArray(res.data?.data)) return { data: res.data.data, meta: res.data.meta ?? { total: res.data.data.length, totalPages: 1 } };
      if (Array.isArray(res.data))       return { data: res.data, meta: { total: res.data.length, totalPages: 1 } };
      return res.data;
    },
    
  });

  const categories: VehicleCategory[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, totalPages: 1 };
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-vehicle-categories'] }).then(() => refetch()), [qc, refetch]);

  const toggleSort = (field: string) => {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
    setPage(1);
  };

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true); };
  const openEdit = (cat: VehicleCategory) => {
    setEditTarget(cat);
    setForm({
      name: cat.name, code: cat.code, description: cat.description ?? '',
      seatCapacity: cat.seatCapacity, luggageCapacity: cat.luggageCapacity,
      ac: cat.ac, fuelType: cat.fuelType ?? 'DIESEL',
      baseFare: cat.baseFare, minimumKm: cat.minimumKm, ratePerKm: cat.ratePerKm,
      waitingChargePerMin: cat.waitingChargePerMin, nightChargeMultiplier: cat.nightChargeMultiplier,
      sortOrder: cat.sortOrder,
    });
    setFormError(''); setDrawerOpen(true);
  };

  const sf = (k: keyof typeof EMPTY_FORM, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Category name is required'); return; }
    if (!form.code.trim()) { setFormError('Category code is required'); return; }
    if (form.baseFare < 0 || form.ratePerKm < 0) { setFormError('Fare values must be non-negative'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = { ...form, code: form.code.toUpperCase().trim() };
      if (editTarget) {
        await apiClient.put(`/admin/vehicle-categories/${editTarget._id}`, payload);
        toast('Category updated');
      } else {
        await apiClient.post('/admin/vehicle-categories', payload);
        toast('Category created');
      }
      setDrawerOpen(false); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFormError(err.response?.data?.message ?? 'Failed to save category');
    } finally { setSaving(false); }
  };

  const handleToggleStatus = async (cat: VehicleCategory) => {
    const newStatus = cat.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiClient.put(`/admin/vehicle-categories/${cat._id}`, { status: newStatus });
      toast(`Category ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`);
      refresh();
    } catch { toast('Failed to update status', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/vehicle-categories/${deleteTarget._id}`);
      setDeleteTarget(null); refresh(); toast('Category deactivated');
    } catch { toast('Failed to deactivate category', 'error'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      <div className="page-header">
        <div>
          <h1 className="page-title">Vehicle Categories</h1>
          <p className="page-subtitle">Each category maintains a separate queue at every taxi stand</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={14} /> New Category
        </button>
      </div>

      {/* Info banner */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
        padding: '0.875rem 1rem', borderRadius: '10px',
        background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', fontSize: '0.8125rem',
      }}>
        <Info size={15} style={{ flexShrink: 0, marginTop: '0.1rem', color: '#3B82F6' }} />
        <span>
          <strong>Separate queues per category:</strong> When a driver joins a stand queue, they join the queue
          specific to their vehicle type (Car, Tempo, Bus, etc.). Each category queue is independent with its own
          position numbers and fare rules.
        </span>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by name or code..." />
        {search && (
          <button onClick={() => { setSearch(''); setPage(1); }} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <SortHeader label="Category"  field="name"      sort={sort} onSort={toggleSort} />
              <SortHeader label="Code"      field="code"      sort={sort} onSort={toggleSort} />
              <th>Specs</th>
              <SortHeader label="Base Fare" field="baseFare"  sort={sort} onSort={toggleSort} align="right" />
              <SortHeader label="Rate/KM"   field="ratePerKm" sort={sort} onSort={toggleSort} align="right" />
              <SortHeader label="Min KM"    field="minimumKm" sort={sort} onSort={toggleSort} align="right" />
              <th>Night</th>
              <SortHeader label="Order"     field="sortOrder" sort={sort} onSort={toggleSort} align="right" />
              <SortHeader label="Status"    field="status"    sort={sort} onSort={toggleSort} />
              <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Actions</th>
            </tr>
          </thead>
          {isLoading ? (
            <TableSkeleton rows={5} cols={10} />
          ) : categories.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Truck size={24} style={{ color: 'var(--brand-600)' }} /></div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.375rem' }}>No vehicle categories found</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      {search ? 'Try a different search term' : 'Create your first vehicle category to get started'}
                    </div>
                    {!search && <button onClick={openCreate} className="btn-primary"><Plus size={14} /> New Category</button>}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {categories.map(cat => (
                <tr key={cat._id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                        background: 'var(--bg-surface-3)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <CategoryIcon name={cat.name} size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.875rem' }}>{cat.name}</div>
                        {cat.description && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.1rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cat.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <code style={{
                      fontSize: '0.6875rem', fontWeight: 700, color: 'var(--brand-700)',
                      background: 'var(--brand-50)', padding: '0.2rem 0.5rem',
                      borderRadius: '5px', border: '1px solid var(--brand-100)',
                    }}>
                      {cat.code}
                    </code>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Users size={11} /> {cat.seatCapacity} seats
                      </span>
                      {cat.ac && (
                        <span style={{
                          display: 'flex', alignItems: 'center', gap: '0.2rem',
                          fontSize: '0.6875rem', fontWeight: 600,
                          color: '#1D4ED8', background: '#EFF6FF',
                          padding: '0.1rem 0.375rem', borderRadius: '4px', border: '1px solid #BFDBFE',
                        }}>
                          <Zap size={10} /> AC
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.875rem' }}>
                    {INR(cat.baseFare)}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {INR(cat.ratePerKm)}/km
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {cat.minimumKm} km
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    {cat.nightChargeMultiplier}x
                  </td>
                  <td style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                    {cat.sortOrder}
                  </td>
                  <td>
                    <button
                      onClick={() => handleToggleStatus(cat)}
                      title={cat.status === 'ACTIVE' ? 'Click to deactivate' : 'Click to activate'}
                    >
                      {cat.status === 'ACTIVE'
                        ? <CheckCircle2 size={18} style={{ color: '#10B981' }} />
                        : <XCircle     size={18} style={{ color: '#94A3B8' }} />
                      }
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem', paddingRight: '0.25rem' }}>
                      <button onClick={() => openEdit(cat)} className="btn-icon primary" title="Edit category"><Edit2 size={13} /></button>
                      <button onClick={() => setDeleteTarget(cat)} className="btn-icon danger" title="Deactivate category"><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          )}
        </table>
        <Pagination page={page} totalPages={meta.totalPages ?? 1} total={meta.total ?? 0} limit={LIMIT} onPage={setPage} />
      </div>

      {/* Drawer */}
      <Drawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Vehicle Category' : 'New Vehicle Category'}
        subtitle={editTarget ? `Editing: ${editTarget.name}` : 'Define fare rules and vehicle specs'}
        width={540}
        footer={
          <>
            <button onClick={() => setDrawerOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : editTarget ? 'Update Category' : 'Create Category'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {formError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '0.8125rem' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} /> {formError}
            </div>
          )}

          <FormSection title="Category Identity">
            <FormGrid cols={2}>
              <Field label="Category Name" required>
                <input className="input-field" placeholder="e.g. Tempo Traveller" value={form.name} onChange={e => sf('name', e.target.value)} />
              </Field>
              <Field label="Code" required hint="Unique, auto-uppercased">
                <input className="input-field" placeholder="TEMPO" value={form.code}
                  onChange={e => sf('code', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                  style={{ fontFamily: 'monospace' }} />
              </Field>
            </FormGrid>
            <Field label="Description">
              <textarea className="input-field" rows={2} placeholder="Optional description..."
                value={form.description} onChange={e => sf('description', e.target.value)}
                style={{ resize: 'vertical' }} />
            </Field>
          </FormSection>

          <FormSection title="Vehicle Specifications">
            <FormGrid cols={2}>
              <Field label="Seat Capacity">
                <input type="number" min={1} max={60} className="input-field" value={form.seatCapacity} onChange={e => sf('seatCapacity', +e.target.value)} />
              </Field>
              <Field label="Luggage Bags">
                <input type="number" min={0} max={20} className="input-field" value={form.luggageCapacity} onChange={e => sf('luggageCapacity', +e.target.value)} />
              </Field>
              <Field label="Fuel Type">
                <select className="input-field" value={form.fuelType} onChange={e => sf('fuelType', e.target.value)}>
                  {FUEL_TYPES.map(ft => <option key={ft}>{ft}</option>)}
                </select>
              </Field>
              <Field label="Display Order" hint="Lower = first">
                <input type="number" min={0} className="input-field" value={form.sortOrder} onChange={e => sf('sortOrder', +e.target.value)} />
              </Field>
            </FormGrid>
            <ToggleSwitch value={form.ac} onChange={() => sf('ac', !form.ac)} label="Air Conditioned (AC)" />
          </FormSection>

          <FormSection title="Fare Configuration">
            <FormGrid cols={2}>
              <Field label="Base Fare (INR)" hint="Minimum trip charge">
                <input type="number" min={0} step={10} className="input-field" placeholder="300" value={form.baseFare} onChange={e => sf('baseFare', +e.target.value)} />
              </Field>
              <Field label="Rate per KM (INR)">
                <input type="number" min={0} step={0.5} className="input-field" placeholder="18" value={form.ratePerKm} onChange={e => sf('ratePerKm', +e.target.value)} />
              </Field>
              <Field label="Minimum KM" hint="KMs included in base fare">
                <input type="number" min={0} className="input-field" placeholder="5" value={form.minimumKm} onChange={e => sf('minimumKm', +e.target.value)} />
              </Field>
              <Field label="Waiting Charge (INR/min)">
                <input type="number" min={0} step={0.5} className="input-field" placeholder="2" value={form.waitingChargePerMin} onChange={e => sf('waitingChargePerMin', +e.target.value)} />
              </Field>
            </FormGrid>
            <Field label="Night Charge Multiplier" hint="1.0 = no surcharge, 1.1 = 10% extra">
              <input type="number" min={1} max={3} step={0.05} className="input-field" value={form.nightChargeMultiplier} onChange={e => sf('nightChargeMultiplier', +e.target.value)} style={{ maxWidth: '160px' }} />
            </Field>
          </FormSection>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget} danger
        title="Deactivate Category"
        message={`Deactivate "${deleteTarget?.name}"? Drivers in this category will remain but no new queue entries will be accepted.`}
        confirmLabel="Deactivate"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
