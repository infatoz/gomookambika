import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Edit2, Trash2, AlertCircle, MapPin, Loader2,
  Navigation, CheckCircle2, X,
} from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';
import { SearchInput, FilterSelect, SortHeader, Pagination, TableSkeleton } from '@/components/TableControls';
import { useOsmSearch, parseOsmAddress, type OsmResult } from '@/hooks/useOsmSearch';

interface Location {
  _id: string; name: string; code: string; type: string; status: string;
  address: { line1: string; city: string; state: string };
  geoPoint?: { coordinates: [number, number] };
  queueEnabled: boolean; queueRadius: number; bookingEnabled: boolean; qrEnabled: boolean;
}

const LOCATION_TYPES = [
  'TAXI_STAND','HOTEL','HOSPITAL','AIRPORT','RAILWAY_STATION',
  'BUS_STAND','TEMPLE','CITY_LOCATION','CUSTOM',
];
const TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  TAXI_STAND:      { bg:'#EEF2FF', color:'#4338CA', border:'#C7D2FE' },
  HOTEL:           { bg:'#F5F3FF', color:'#6D28D9', border:'#DDD6FE' },
  HOSPITAL:        { bg:'#FEF2F2', color:'#B91C1C', border:'#FECACA' },
  AIRPORT:         { bg:'#F0F9FF', color:'#0369A1', border:'#BAE6FD' },
  RAILWAY_STATION: { bg:'#FFFBEB', color:'#92400E', border:'#FDE68A' },
  BUS_STAND:       { bg:'#FFF7ED', color:'#9A3412', border:'#FED7AA' },
  TEMPLE:          { bg:'#FEFCE8', color:'#854D0E', border:'#FEF08A' },
  CITY_LOCATION:   { bg:'#F0FDF4', color:'#166534', border:'#BBF7D0' },
  CUSTOM:          { bg:'#F8FAFC', color:'#475569', border:'#E2E8F0' },
};

const EMPTY_FORM = {
  name: '', code: '', type: 'CITY_LOCATION', description: '',
  address: { line1: '', city: '', state: 'Karnataka', country: 'India' },
  latitude: '', longitude: '',
  queueEnabled: true, queueRadius: 150, bookingEnabled: true, qrEnabled: false, status: 'ACTIVE',
};

function ToggleSwitch({ value, onChange, label }: { value: boolean; onChange: () => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
      <div
        onClick={onChange}
        className={`toggle-track ${value ? 'on' : 'off'}`}
      >
        <div className="toggle-thumb" />
      </div>
      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', userSelect: 'none' }}>{label}</span>
    </label>
  );
}

/** OSM address search widget */
function OsmAddressSearch({ onSelect }: { onSelect: (r: OsmResult) => void }) {
  const { results, loading, query, search, clear } = useOsmSearch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Navigation size={14} style={{
          position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)',
          color: 'var(--brand-600)', pointerEvents: 'none',
        }} />
        {loading && (
          <Loader2 size={13} style={{
            position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', animation: 'spin 1s linear infinite',
          }} />
        )}
        <input
          value={query}
          onChange={e => { search(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search address, city or landmark..."
          className="input-field"
          style={{ paddingLeft: '2.25rem', paddingRight: '2rem' }}
        />
        {query && (
          <button onClick={() => { clear(); setOpen(false); }} style={{
            position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', padding: '0.25rem',
          }}>
            <X size={13} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: 'var(--bg-surface)', border: '1.5px solid var(--border)',
          borderRadius: '10px', boxShadow: '0 12px 40px rgba(15,23,42,0.14)',
          overflow: 'hidden',
        }}>
          {results.map(r => (
            <button
              key={r.place_id}
              onClick={() => { onSelect(r); clear(); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left', padding: '0.75rem 1rem',
                background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                transition: 'background 0.1s', display: 'flex', gap: '0.625rem', alignItems: 'flex-start',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-surface-2)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <MapPin size={14} style={{ color: 'var(--brand-600)', flexShrink: 0, marginTop: '0.125rem' }} />
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                {r.display_name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function LocationsPage() {
  const qc = useQueryClient();
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort]               = useState({ field: 'name', dir: 'asc' as 'asc' | 'desc' });
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Location | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Location | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const LIMIT = 15;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-locations', page, search, typeFilter, statusFilter, sort],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search)       p.set('search', search);
      if (typeFilter)   p.set('type', typeFilter);
      if (statusFilter) p.set('status', statusFilter);
      p.set('sortBy', sort.field); p.set('sortOrder', sort.dir);
      const res = await apiClient.get(`/admin/locations?${p}`);
      return res.data;
    },
    
  });

  const locations: Location[] = data?.data ?? [];
  const meta = data?.meta ?? data?.pagination ?? { total: 0, totalPages: 1 };
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-locations'] }), [qc]);

  const toggleSort = (field: string) => {
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
    setPage(1);
  };

  const openCreate = () => { setEditTarget(null); setForm(EMPTY_FORM); setFormError(''); setDrawerOpen(true); };
  const openEdit = (loc: Location) => {
    setEditTarget(loc);
    setForm({
      name: loc.name, code: loc.code, type: loc.type, description: '',
      address: { line1: loc.address.line1, city: loc.address.city, state: loc.address.state, country: 'India' },
      latitude: String(loc.geoPoint?.coordinates[1] ?? ''),
      longitude: String(loc.geoPoint?.coordinates[0] ?? ''),
      queueEnabled: loc.queueEnabled, queueRadius: loc.queueRadius,
      bookingEnabled: loc.bookingEnabled, qrEnabled: loc.qrEnabled, status: loc.status,
    });
    setFormError(''); setDrawerOpen(true);
  };

  const sf = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const setAddr = (patch: Partial<typeof EMPTY_FORM.address>) => setForm(f => ({ ...f, address: { ...f.address, ...patch } }));

  const handleOsmSelect = (r: OsmResult) => {
    const parsed = parseOsmAddress(r);
    setForm(f => ({
      ...f,
      address: { line1: parsed.line1, city: parsed.city, state: parsed.state, country: parsed.country },
      latitude:  parsed.latitude,
      longitude: parsed.longitude,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Location name is required'); return; }
    if (!form.code.trim()) { setFormError('Location code is required'); return; }
    setSaving(true); setFormError('');
    try {
      const payload: Record<string, unknown> = {
        ...form, code: form.code.toUpperCase(),
        geoPoint: form.latitude && form.longitude
          ? { type: 'Point', coordinates: [+form.longitude, +form.latitude] } : undefined,
      };
      delete payload.latitude; delete payload.longitude;
      if (editTarget) {
        await apiClient.put(`/admin/locations/${editTarget._id}`, payload);
        toast('Location updated successfully');
      } else {
        await apiClient.post('/admin/locations', payload);
        toast('Location created successfully');
      }
      setDrawerOpen(false); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFormError(err.response?.data?.message ?? 'Failed to save location');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/locations/${deleteTarget._id}`);
      toast('Location deactivated');
      setDeleteTarget(null); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to deactivate location', 'error');
    } finally { setDeleting(false); }
  };

  const hasFilters = search || typeFilter || statusFilter;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Locations</h1>
          <p className="page-subtitle">{meta.total ?? 0} locations configured</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={14} /> Add Location
        </button>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <SearchInput
          value={search}
          onChange={v => { setSearch(v); setPage(1); }}
          placeholder="Search by name, code, city..."
        />
        <FilterSelect
          value={typeFilter}
          onChange={v => { setTypeFilter(v); setPage(1); }}
          placeholder="All Types"
          options={LOCATION_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') }))}
        />
        <FilterSelect
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setPage(1); }}
          placeholder="All Statuses"
          options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]}
        />
        {hasFilters && (
          <button onClick={() => { setSearch(''); setTypeFilter(''); setStatusFilter(''); setPage(1); }} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
            <X size={13} /> Clear filters
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <SortHeader label="Name"    field="name"   sort={sort} onSort={toggleSort} />
              <SortHeader label="Code"    field="code"   sort={sort} onSort={toggleSort} />
              <th>Type</th>
              <SortHeader label="City"   field="address.city" sort={sort} onSort={toggleSort} />
              <th>Features</th>
              <th>Coordinates</th>
              <SortHeader label="Status" field="status" sort={sort} onSort={toggleSort} />
              <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Actions</th>
            </tr>
          </thead>
          {isLoading ? (
            <TableSkeleton rows={8} cols={8} />
          ) : locations.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={8}>
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <MapPin size={24} style={{ color: 'var(--brand-600)' }} />
                    </div>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.375rem' }}>
                      No locations found
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                      {hasFilters ? 'Try adjusting your filters' : 'Get started by adding your first location'}
                    </div>
                    {!hasFilters && (
                      <button onClick={openCreate} className="btn-primary">
                        <Plus size={14} /> Add Location
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {locations.map(loc => {
                const tc = TYPE_COLORS[loc.type] ?? TYPE_COLORS.CUSTOM;
                const lat = loc.geoPoint?.coordinates[1];
                const lng = loc.geoPoint?.coordinates[0];
                return (
                  <tr key={loc._id}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.875rem' }}>{loc.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.125rem' }}>{loc.address.line1 || 'â€”'}</div>
                    </td>
                    <td>
                      <code style={{
                        fontSize: '0.6875rem', fontWeight: 700, color: 'var(--brand-700)',
                        background: 'var(--brand-50)', padding: '0.2rem 0.5rem',
                        borderRadius: '5px', border: '1px solid var(--brand-100)',
                      }}>
                        {loc.code}
                      </code>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        padding: '0.2rem 0.625rem', borderRadius: '999px',
                        fontSize: '0.6875rem', fontWeight: 600,
                        background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {loc.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      {loc.address.city || 'â€”'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                        {loc.queueEnabled    && <span className="badge badge-active" style={{ fontSize: '0.6rem' }}>Queue {loc.queueRadius}m</span>}
                        {loc.bookingEnabled  && <span className="badge badge-info"   style={{ fontSize: '0.6rem' }}>Booking</span>}
                        {loc.qrEnabled       && <span className="badge badge-purple" style={{ fontSize: '0.6rem' }}>QR</span>}
                      </div>
                    </td>
                    <td>
                      {lat && lng ? (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
                          target="_blank" rel="noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--brand-600)', fontSize: '0.75rem', textDecoration: 'none' }}
                          title={`${lat}, ${lng}`}
                        >
                          <MapPin size={12} />
                          <span style={{ fontFamily: 'monospace' }}>{Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}</span>
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>â€”</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${loc.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}`}>
                        {loc.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem', paddingRight: '0.25rem' }}>
                        <button onClick={() => openEdit(loc)} className="btn-icon primary" title="Edit location">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => setDeleteTarget(loc)} className="btn-icon danger" title="Deactivate location">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
        title={editTarget ? 'Edit Location' : 'Add New Location'}
        subtitle={editTarget ? `Editing: ${editTarget.name}` : 'Fill in details to create a location'}
        width={520}
        footer={
          <>
            <button onClick={() => setDrawerOpen(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : editTarget ? 'Update Location' : 'Create Location'}
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

          {/* OSM Address Search */}
          <FormSection title="Address Search (OpenStreetMap)">
            <OsmAddressSearch onSelect={handleOsmSelect} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={11} style={{ color: '#10B981' }} />
              Selecting a result auto-fills address, latitude &amp; longitude
            </div>
          </FormSection>

          {/* Basic Info */}
          <FormSection title="Basic Information">
            <FormGrid cols={2}>
              <Field label="Location Name" required>
                <input className="input-field" placeholder="e.g. Kollur Temple" value={form.name} onChange={e => sf('name', e.target.value)} />
              </Field>
              <Field label="Code" required hint="Unique identifier, auto-uppercased">
                <input className="input-field" placeholder="KOLLUR_TEMPLE" value={form.code}
                  onChange={e => sf('code', e.target.value.toUpperCase().replace(/\s/g, '_'))}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.02em' }} />
              </Field>
            </FormGrid>
            <Field label="Type">
              <select className="input-field" value={form.type} onChange={e => sf('type', e.target.value)}>
                {LOCATION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="input-field" value={form.status} onChange={e => sf('status', e.target.value)}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </Field>
          </FormSection>

          {/* Address */}
          <FormSection title="Address">
            <Field label="Street / Landmark">
              <input className="input-field" placeholder="Road, landmark, area" value={form.address.line1} onChange={e => setAddr({ line1: e.target.value })} />
            </Field>
            <FormGrid cols={2}>
              <Field label="City">
                <input className="input-field" placeholder="Udupi" value={form.address.city} onChange={e => setAddr({ city: e.target.value })} />
              </Field>
              <Field label="State">
                <input className="input-field" value={form.address.state} onChange={e => setAddr({ state: e.target.value })} />
              </Field>
            </FormGrid>
          </FormSection>

          {/* Coordinates */}
          <FormSection title="GPS Coordinates">
            <FormGrid cols={2}>
              <Field label="Latitude" hint="e.g. 13.8617">
                <input type="number" step="any" className="input-field" placeholder="13.8617" value={form.latitude} onChange={e => sf('latitude', e.target.value)} />
              </Field>
              <Field label="Longitude" hint="e.g. 74.8100">
                <input type="number" step="any" className="input-field" placeholder="74.8100" value={form.longitude} onChange={e => sf('longitude', e.target.value)} />
              </Field>
            </FormGrid>
            {form.latitude && form.longitude && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}#map=16/${form.latitude}/${form.longitude}`}
                target="_blank" rel="noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--brand-600)' }}
              >
                <Navigation size={12} /> Preview on OpenStreetMap
              </a>
            )}
          </FormSection>

          {/* Settings */}
          <FormSection title="Queue &amp; Booking Settings">
            <Field label="Queue Radius (metres)" hint="Drivers must be within this radius to join queue">
              <input type="number" min={10} max={2000} className="input-field" value={form.queueRadius} onChange={e => sf('queueRadius', +e.target.value)} />
            </Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingTop: '0.25rem' }}>
              <ToggleSwitch value={form.queueEnabled}   onChange={() => sf('queueEnabled',   !form.queueEnabled)}   label="Enable Queue Joining" />
              <ToggleSwitch value={form.bookingEnabled} onChange={() => sf('bookingEnabled', !form.bookingEnabled)} label="Enable Bookings from this location" />
              <ToggleSwitch value={form.qrEnabled}      onChange={() => sf('qrEnabled',      !form.qrEnabled)}      label="Enable QR Code Check-in" />
            </div>
          </FormSection>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget} danger
        title="Deactivate Location"
        message={`Deactivate "${deleteTarget?.name}"? It will be hidden from drivers and customers.`}
        confirmLabel="Deactivate"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
