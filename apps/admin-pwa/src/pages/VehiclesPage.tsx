import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, AlertCircle, Loader2, Car, X,
} from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';
import { SearchInput, FilterSelect, SortHeader, Pagination, TableSkeleton } from '@/components/TableControls';

interface Vehicle {
  _id: string; registrationNumber: string; brand: string; vehicleModel: string;
  manufacturingYear: number; color: string; fuelType: string; status: string;
  ac: boolean; seatCapacity: number; luggageCapacity: number; ownerName: string;
  categoryId?: { _id: string; name: string; code: string } | null;
  assignedDriverId?: { _id: string; name: string; phone: string; driverCode?: string } | null;
}
interface VehicleCategory { _id: string; name: string; code: string; }
interface DriverOption    { _id: string; name: string; phone: string; driverCode: string; }

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'badge-active', INACTIVE: 'badge-inactive',
  MAINTENANCE: 'badge-warning', SUSPENDED: 'badge-suspended',
};

const FUEL_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  PETROL:   { bg:'#FFF7ED', color:'#9A3412', border:'#FED7AA' },
  DIESEL:   { bg:'#F8FAFC', color:'#475569', border:'#E2E8F0' },
  CNG:      { bg:'#F0FDF4', color:'#166534', border:'#BBF7D0' },
  ELECTRIC: { bg:'#EFF6FF', color:'#1E40AF', border:'#BFDBFE' },
  HYBRID:   { bg:'#F5F3FF', color:'#5B21B6', border:'#DDD6FE' },
};

const EMPTY_FORM = {
  registrationNumber: '', brand: '', vehicleModel: '', manufacturingYear: new Date().getFullYear(),
  color: 'White', fuelType: 'DIESEL', seatCapacity: 4, luggageCapacity: 2, ac: true,
  ownerName: '', categoryId: '', assignedDriverId: '', status: 'ACTIVE',
};

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

export function VehiclesPage() {
  const qc = useQueryClient();
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter]     = useState('');
  const [sort, setSort]               = useState({ field: 'registrationNumber', dir: 'asc' as 'asc' | 'desc' });
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Vehicle | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const LIMIT = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vehicles', page, search, statusFilter, catFilter, sort],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search)       p.set('search', search);
      if (statusFilter) p.set('status', statusFilter);
      if (catFilter)    p.set('categoryId', catFilter);
      p.set('sortBy', sort.field); p.set('sortOrder', sort.dir);
      const res = await apiClient.get(`/admin/vehicles?${p}`);
      return res.data;
    },
    
  });

  const { data: catData } = useQuery<VehicleCategory[]>({
    queryKey: ['vehicle-categories-list'],
    queryFn: async () => { const r = await apiClient.get('/admin/vehicle-categories'); return r.data?.data ?? []; },
  });

  const { data: driversData } = useQuery<DriverOption[]>({
    queryKey: ['drivers-list-simple'],
    queryFn: async () => { const r = await apiClient.get('/admin/drivers?limit=200&status=AVAILABLE'); return r.data?.data ?? []; },
  });

  const vehicles: Vehicle[] = data?.data ?? [];
  const meta       = data?.meta ?? data?.pagination ?? { total: 0, totalPages: 1 };
  const categories = catData ?? [];
  const drivers    = driversData ?? [];
  const refresh    = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-vehicles'] }), [qc]);

  const toggleSort = (field: string) => {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
    setPage(1);
  };

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true); };
  const openEdit = (v: Vehicle) => {
    setEditTarget(v);
    setForm({
      registrationNumber: v.registrationNumber, brand: v.brand, vehicleModel: v.vehicleModel,
      manufacturingYear: v.manufacturingYear, color: v.color, fuelType: v.fuelType,
      seatCapacity: v.seatCapacity, luggageCapacity: v.luggageCapacity, ac: v.ac,
      ownerName: v.ownerName, categoryId: v.categoryId?._id ?? '', status: v.status,
      assignedDriverId: (v.assignedDriverId as DriverOption)?._id ?? '',
    });
    setFormError(''); setDrawerOpen(true);
  };

  const sf = (k: keyof typeof EMPTY_FORM, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.registrationNumber.trim()) { setFormError('Registration number is required'); return; }
    if (!form.brand.trim())              { setFormError('Brand is required'); return; }
    if (!form.categoryId)                { setFormError('Please select a vehicle category'); return; }
    setSaving(true); setFormError('');
    try {
      const payload = { ...form, assignedDriverId: form.assignedDriverId || undefined };
      if (editTarget) {
        await apiClient.put(`/admin/vehicles/${editTarget._id}`, payload);
        toast('Vehicle updated successfully');
      } else {
        await apiClient.post('/admin/vehicles', payload);
        toast('Vehicle added successfully');
      }
      setDrawerOpen(false); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFormError(err.response?.data?.message ?? 'Failed to save vehicle');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/vehicles/${deleteTarget._id}`);
      toast('Vehicle deactivated');
      setDeleteTarget(null); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to deactivate vehicle', 'error');
    } finally { setDeleting(false); }
  };

  const hasFilters = search || statusFilter || catFilter;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      <div className="page-header">
        <div>
          <h1 className="page-title">Vehicles</h1>
          <p className="page-subtitle">{meta.total ?? 0} vehicles registered</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={14} /> Add Vehicle
        </button>
      </div>

      <div className="filter-bar">
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Reg. no, brand, model..." />
        <FilterSelect
          value={catFilter} onChange={v => { setCatFilter(v); setPage(1); }}
          placeholder="All Types"
          options={categories.map(c => ({ value: c._id, label: c.name }))}
        />
        <FilterSelect
          value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }}
          placeholder="All Statuses"
          options={Object.keys(STATUS_BADGE).map(s => ({ value: s, label: s }))}
        />
        {hasFilters && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setCatFilter(''); setPage(1); }} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <SortHeader label="Registration" field="registrationNumber" sort={sort} onSort={toggleSort} />
              <SortHeader label="Brand / Model" field="brand" sort={sort} onSort={toggleSort} />
              <th>Category</th>
              <th>Fuel</th>
              <th>Specs</th>
              <th>Driver</th>
              <SortHeader label="Status" field="status" sort={sort} onSort={toggleSort} />
              <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Actions</th>
            </tr>
          </thead>
          {isLoading ? (
            <TableSkeleton rows={6} cols={8} />
          ) : vehicles.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon"><Car size={24} style={{ color: 'var(--brand-600)' }} /></div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.375rem' }}>No vehicles found</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      {hasFilters ? 'Try adjusting your filters' : 'Add your first vehicle to get started'}
                    </div>
                    {!hasFilters && <button onClick={openCreate} className="btn-primary"><Plus size={14} /> Add Vehicle</button>}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {vehicles.map(v => {
                const fs = FUEL_STYLE[v.fuelType] ?? FUEL_STYLE.DIESEL;
                return (
                  <tr key={v._id}>
                    <td>
                      <code style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-heading)', letterSpacing: '0.03em' }}>
                        {v.registrationNumber}
                      </code>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, color: 'var(--text-heading)', fontSize: '0.875rem' }}>
                        {v.brand}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {v.vehicleModel} Â· {v.manufacturingYear}
                      </div>
                    </td>
                    <td>
                      {v.categoryId ? (
                        <span style={{
                          display: 'inline-flex', padding: '0.2rem 0.625rem', borderRadius: '999px',
                          fontSize: '0.6875rem', fontWeight: 600,
                          background: 'var(--brand-50)', color: 'var(--brand-700)', border: '1px solid var(--brand-100)',
                        }}>
                          {v.categoryId.name}
                        </span>
                      ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>â€”</span>}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', padding: '0.2rem 0.5rem', borderRadius: '6px',
                        fontSize: '0.6875rem', fontWeight: 600,
                        background: fs.bg, color: fs.color, border: `1px solid ${fs.border}`,
                      }}>
                        {v.fuelType}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {v.seatCapacity} seats
                        </span>
                        {v.ac && <span style={{ fontSize: '0.6875rem', color: '#1D4ED8', background: '#EFF6FF', padding: '0.1rem 0.375rem', borderRadius: '4px', border: '1px solid #BFDBFE' }}>AC</span>}
                      </div>
                    </td>
                    <td>
                      {v.assignedDriverId ? (
                        <div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-heading)', fontWeight: 500 }}>
                            {(v.assignedDriverId as { name: string }).name}
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[v.status] ?? 'badge-inactive'}`}>{v.status}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem', paddingRight: '0.25rem' }}>
                        <button onClick={() => openEdit(v)} className="btn-icon primary" title="Edit vehicle"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteTarget(v)} className="btn-icon danger" title="Deactivate vehicle"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
        <Pagination page={page} totalPages={meta.totalPages ?? 1} total={meta.total ?? 0} limit={LIMIT} onPage={setPage} />
      </div>

      <Drawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Vehicle' : 'Add Vehicle'}
        subtitle={editTarget ? `Editing: ${editTarget.registrationNumber}` : 'Register a new vehicle in the fleet'}
        width={520}
        footer={
          <>
            <button onClick={() => setDrawerOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : editTarget ? 'Update Vehicle' : 'Add Vehicle'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {formError && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.75rem 1rem', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: '0.8125rem' }}>
              <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              {formError}
            </div>
          )}

          <FormSection title="Registration">
            <FormGrid cols={2}>
              <Field label="Registration Number" required>
                <input className="input-field" placeholder="KA 13 AB 1234" value={form.registrationNumber}
                  onChange={e => sf('registrationNumber', e.target.value.toUpperCase())}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }} />
              </Field>
              <Field label="Vehicle Category" required>
                <select className="input-field" value={form.categoryId} onChange={e => sf('categoryId', e.target.value)}>
                  <option value="">Select category...</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="Vehicle Details">
            <FormGrid cols={2}>
              <Field label="Brand" required>
                <input className="input-field" placeholder="Toyota" value={form.brand} onChange={e => sf('brand', e.target.value)} />
              </Field>
              <Field label="Model" required>
                <input className="input-field" placeholder="Innova Crysta" value={form.vehicleModel} onChange={e => sf('vehicleModel', e.target.value)} />
              </Field>
              <Field label="Year">
                <input type="number" min={2000} max={2030} className="input-field" value={form.manufacturingYear} onChange={e => sf('manufacturingYear', +e.target.value)} />
              </Field>
              <Field label="Color">
                <input className="input-field" placeholder="White" value={form.color} onChange={e => sf('color', e.target.value)} />
              </Field>
              <Field label="Fuel Type">
                <select className="input-field" value={form.fuelType} onChange={e => sf('fuelType', e.target.value)}>
                  {['PETROL','DIESEL','CNG','ELECTRIC','HYBRID'].map(f => <option key={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select className="input-field" value={form.status} onChange={e => sf('status', e.target.value)}>
                  {Object.keys(STATUS_BADGE).map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="Capacity">
            <FormGrid cols={2}>
              <Field label="Seat Capacity">
                <input type="number" min={1} max={60} className="input-field" value={form.seatCapacity} onChange={e => sf('seatCapacity', +e.target.value)} />
              </Field>
              <Field label="Luggage (bags)">
                <input type="number" min={0} className="input-field" value={form.luggageCapacity} onChange={e => sf('luggageCapacity', +e.target.value)} />
              </Field>
            </FormGrid>
            <ToggleSwitch value={form.ac} onChange={() => sf('ac', !form.ac)} label="Air Conditioned" />
          </FormSection>

          <FormSection title="Ownership & Assignment">
            <Field label="Owner Name">
              <input className="input-field" placeholder="Vehicle owner full name" value={form.ownerName} onChange={e => sf('ownerName', e.target.value)} />
            </Field>
            <Field label="Assign Driver" hint="Only available drivers are shown">
              <select className="input-field" value={form.assignedDriverId} onChange={e => sf('assignedDriverId', e.target.value)}>
                <option value="">Unassigned</option>
                {drivers.map(d => <option key={d._id} value={d._id}>{d.name} â€” {d.driverCode}</option>)}
              </select>
            </Field>
          </FormSection>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget} danger
        title="Deactivate Vehicle"
        message={`Deactivate "${deleteTarget?.registrationNumber} â€“ ${deleteTarget?.brand} ${deleteTarget?.vehicleModel}"? It will be marked as INACTIVE.`}
        confirmLabel="Deactivate"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
