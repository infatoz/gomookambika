import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Edit2, Trash2, X, Loader2, AlertCircle,
  ChevronLeft, ChevronRight, UserCheck, UserX, Star, Filter, Users,
} from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Modal, Field, FormGrid, FormSection } from '@/components/Modal';

const STATUS_BADGE: Record<string, string> = {
  AVAILABLE: 'badge-active',
  IN_QUEUE:  'badge-waiting',
  ON_TRIP:   'badge-on-trip',
  SUSPENDED: 'badge-suspended',
  OFFLINE:   'badge-inactive',
  INACTIVE:  'badge-inactive',
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  IN_QUEUE:  'In Queue',
  ON_TRIP:   'On Trip',
  SUSPENDED: 'Suspended',
  OFFLINE:   'Offline',
  INACTIVE:  'Inactive',
};

interface Driver {
  _id: string; name: string; phone: string; email?: string;
  driverCode: string; status: string;
  rating?: number; ratingCount?: number; totalTrips?: number;
  joiningDate?: string; licenseNumber?: string;
  address?: { line1?: string; city?: string; state?: string };
}

const EMPTY = {
  name: '', phone: '', email: '', licenseNumber: '', licenseExpiry: '', joiningDate: '',
  address: { line1: '', city: '', state: 'Karnataka' },
};

function DriverAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const colors = ['#4F46E5', '#0369A1', '#7C3AED', '#059669', '#D97706', '#DC2626'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: '34px', height: '34px', borderRadius: '999px', flexShrink: 0,
      background: color + '18', border: `1.5px solid ${color}30`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color, fontWeight: 700, fontSize: '0.6875rem', letterSpacing: '-0.01em',
    }}>
      {initials}
    </div>
  );
}

export function DriversPage() {
  const qc = useQueryClient();
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm]       = useState(false);
  const [editTarget, setEditTarget]   = useState<Driver | null>(null);
  const [form, setForm]               = useState(EMPTY);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [deleting, setDeleting]       = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-drivers', page, search, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: '20' });
      if (search)       p.set('search', search);
      if (statusFilter) p.set('status', statusFilter);
      const res = await apiClient.get(`/admin/drivers?${p}`);
      return res.data;
    },
  });

  const drivers: Driver[] = data?.data ?? [];
  const meta = data?.meta ?? {};
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-drivers'] }), [qc]);

  const openCreate = () => { setEditTarget(null); setForm(EMPTY); setFormError(''); setShowForm(true); };
  const openEdit = (d: Driver) => {
    setEditTarget(d);
    setForm({
      name: d.name, phone: d.phone, email: d.email ?? '',
      licenseNumber: d.licenseNumber ?? '', licenseExpiry: '', joiningDate: '',
      address: { line1: d.address?.line1 ?? '', city: d.address?.city ?? '', state: d.address?.state ?? 'Karnataka' },
    });
    setFormError(''); setShowForm(true);
  };

  const setF = (patch: Partial<typeof EMPTY>) => setForm(f => ({ ...f, ...patch }));
  const setAddr = (patch: Partial<typeof EMPTY.address>) => setForm(f => ({ ...f, address: { ...f.address, ...patch } }));

  const handleSave = async () => {
    if (!form.name.trim())  { setFormError('Full name is required'); return; }
    if (!form.phone.trim()) { setFormError('Phone number is required'); return; }
    if (!editTarget && !form.licenseNumber.trim()) { setFormError('License number is required'); return; }
    setSaving(true); setFormError('');
    try {
      if (editTarget) {
        await apiClient.put(`/admin/drivers/${editTarget._id}`, form);
        toast('Driver updated successfully');
      } else {
        const payload = {
          ...form,
          licenseExpiry: form.licenseExpiry ? new Date(form.licenseExpiry).toISOString() : undefined,
          joiningDate: form.joiningDate ? new Date(form.joiningDate).toISOString() : undefined,
        };
        await apiClient.post('/admin/drivers', payload);
        toast('Driver created successfully');
      }
      setShowForm(false); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; error?: { details?: Record<string,string> } } } };
      const details = err.response?.data?.error?.details;
      if (details) {
        setFormError(Object.values(details).join(', '));
      } else {
        setFormError(err.response?.data?.message ?? 'Failed to save. Please try again.');
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/drivers/${deleteTarget._id}`);
      toast('Driver deactivated successfully');
      setDeleteTarget(null); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to deactivate driver', 'error');
    } finally { setDeleting(false); }
  };

  const handleToggleStatus = async (d: Driver) => {
    const newStatus = d.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    try {
      await apiClient.patch(`/admin/drivers/${d._id}/status`, { status: newStatus });
      toast(`Driver status changed to ${newStatus}`); refresh();
    } catch { toast('Status update failed', 'error'); }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Drivers</h1>
          <p className="page-subtitle">
            Manage association drivers · {meta.total ?? 0} total
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={14} /> Add Driver
        </button>
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search name, phone, driver code..."
            className="input-field"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <Filter size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="input-field"
            style={{ paddingLeft: '2.25rem', minWidth: '160px' }}
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* Table card */}
      <div className="card" style={{ overflow: 'hidden', padding: 0 }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: '34px', height: '34px', borderRadius: '999px', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <div className="skeleton" style={{ width: '140px', height: '13px' }} />
                  <div className="skeleton" style={{ width: '100px', height: '11px' }} />
                </div>
                <div className="skeleton" style={{ width: '60px', height: '22px', borderRadius: '999px' }} />
                <div className="skeleton" style={{ width: '80px', height: '28px', borderRadius: '8px' }} />
              </div>
            ))}
          </div>
        ) : drivers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Users size={24} style={{ color: 'var(--brand-600)' }} />
            </div>
            <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '0.375rem' }}>
              No drivers found
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              {search || statusFilter ? 'Try adjusting your filters' : 'Get started by adding your first driver'}
            </div>
            {!search && !statusFilter && (
              <button onClick={openCreate} className="btn-primary">
                <Plus size={14} /> Add First Driver
              </button>
            )}
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Code</th>
                  <th>Phone</th>
                  <th>Rating</th>
                  <th>Trips</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th style={{ textAlign: 'right', paddingRight: '1.25rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drivers.map(d => (
                  <tr key={d._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <DriverAvatar name={d.name} />
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-heading)', fontSize: '0.875rem', lineHeight: 1.3 }}>{d.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.2 }}>{d.email || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <code style={{
                        fontSize: '0.6875rem', fontWeight: 700, color: 'var(--brand-700)',
                        background: 'var(--brand-50)', padding: '0.2rem 0.5rem',
                        borderRadius: '5px', border: '1px solid var(--brand-100)', letterSpacing: '0.02em',
                      }}>
                        {d.driverCode}
                      </code>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {d.phone}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Star size={12} style={{ color: '#F59E0B', fill: '#F59E0B' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-heading)' }}>
                          {d.rating?.toFixed(1) ?? '—'}
                        </span>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          ({d.ratingCount ?? 0})
                        </span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {d.totalTrips ?? 0}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[d.status] ?? 'badge-inactive'}`}>
                        {STATUS_LABELS[d.status] ?? d.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {d.joiningDate ? new Date(d.joiningDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.375rem', paddingRight: '0.25rem' }}>
                        <button onClick={() => openEdit(d)} className="btn-icon primary" title="Edit driver">
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(d)}
                          className="btn-icon"
                          title={d.status === 'AVAILABLE' ? 'Set Offline' : 'Set Available'}
                          style={{ color: d.status === 'AVAILABLE' ? '#059669' : 'var(--text-muted)' }}
                        >
                          {d.status === 'AVAILABLE' ? <UserX size={13} /> : <UserCheck size={13} />}
                        </button>
                        <button onClick={() => setDeleteTarget(d)} className="btn-icon danger" title="Deactivate driver">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {(meta.totalPages ?? 0) > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.75rem 1rem', borderTop: '1px solid var(--border)',
                background: 'var(--bg-surface-2)',
              }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total} drivers
                </span>
                <div style={{ display: 'flex', gap: '0.375rem' }}>
                  <button onClick={() => setPage(p => p - 1)} disabled={!meta.hasPrev} className="btn-icon">
                    <ChevronLeft size={14} />
                  </button>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 0.75rem', height: '32px', borderRadius: '8px',
                    border: '1.5px solid var(--border)', fontSize: '0.75rem',
                    fontWeight: 600, color: 'var(--text-secondary)',
                  }}>
                    {meta.page} / {meta.totalPages}
                  </div>
                  <button onClick={() => setPage(p => p + 1)} disabled={!meta.hasNext} className="btn-icon">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <Modal
          title={editTarget ? 'Edit Driver' : 'Add New Driver'}
          subtitle={editTarget ? `Editing ${editTarget.name}` : 'Fill in driver details below'}
          onClose={() => setShowForm(false)}
          size="md"
          footer={
            <>
              <button onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : editTarget ? 'Update Driver' : 'Add Driver'}
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
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

            <FormSection title="Personal Information">
              <FormGrid cols={2}>
                <Field label="Full Name" required>
                  <input className="input-field" placeholder="e.g. Raju Kumar" value={form.name} onChange={e => setF({ name: e.target.value })} />
                </Field>
                <Field label="Phone Number" required>
                  <input className="input-field" placeholder="9876543210" value={form.phone} onChange={e => setF({ phone: e.target.value })} />
                </Field>
                <Field label="Email Address">
                  <input type="email" className="input-field" placeholder="driver@example.com" value={form.email} onChange={e => setF({ email: e.target.value })} />
                </Field>
                {!editTarget && (
                  <Field label="Joining Date">
                    <input type="date" className="input-field" value={form.joiningDate} onChange={e => setF({ joiningDate: e.target.value })} />
                  </Field>
                )}
              </FormGrid>
            </FormSection>

            {!editTarget && (
              <FormSection title="License Details">
                <FormGrid cols={2}>
                  <Field label="License Number" required>
                    <input className="input-field" placeholder="KA12 20230001234" value={form.licenseNumber} onChange={e => setF({ licenseNumber: e.target.value.toUpperCase() })} style={{ fontFamily: 'monospace' }} />
                  </Field>
                  <Field label="License Expiry" required>
                    <input type="date" className="input-field" value={form.licenseExpiry} onChange={e => setF({ licenseExpiry: e.target.value })} />
                  </Field>
                </FormGrid>
              </FormSection>
            )}

            <FormSection title="Address">
              <FormGrid cols={1}>
                <Field label="Street Address">
                  <input className="input-field" placeholder="House No., Street, Area" value={form.address.line1} onChange={e => setAddr({ line1: e.target.value })} />
                </Field>
              </FormGrid>
              <FormGrid cols={2}>
                <Field label="City">
                  <input className="input-field" placeholder="Udupi" value={form.address.city} onChange={e => setAddr({ city: e.target.value })} />
                </Field>
                <Field label="State">
                  <input className="input-field" value={form.address.state} onChange={e => setAddr({ state: e.target.value })} />
                </Field>
              </FormGrid>
            </FormSection>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={!!deleteTarget} danger
        title="Deactivate Driver"
        message={`Are you sure you want to deactivate "${deleteTarget?.name}"? They will no longer be able to join queues or accept trips.`}
        confirmLabel="Deactivate"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
