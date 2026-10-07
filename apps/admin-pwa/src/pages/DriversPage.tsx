import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Tag, Space, Input, Select, Typography,
  Tooltip, Avatar, Checkbox,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, FilterOutlined, UserOutlined,
  StarOutlined, PoweroffOutlined, UndoOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';

const { Title, Text } = Typography;

const STATUS_TAG: Record<string, string> = {
  AVAILABLE: 'success', IN_QUEUE: 'processing', ON_TRIP: 'blue',
  SUSPENDED: 'error', OFFLINE: 'default', INACTIVE: 'default',
};
const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available', IN_QUEUE: 'In Queue', ON_TRIP: 'On Trip',
  SUSPENDED: 'Suspended', OFFLINE: 'Offline', INACTIVE: 'Inactive',
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
  address: { line1: '', city: 'Kollur', state: 'Karnataka', pincode: '576220' },
};
const LIMIT = 20;

export function DriversPage() {
  const qc = useQueryClient();
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [showForm, setShowForm]     = useState(false);
  const [editTarget, setEditTarget] = useState<Driver | null>(null);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [deleteTarget, setDeleteTarget]       = useState<Driver | null>(null);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [reactivatingId, setReactivatingId]   = useState<string | null>(null);
  const [purgeOpen, setPurgeOpen]             = useState(false);
  const [purging, setPurging]                 = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-drivers', page, search, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
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
      address: {
        line1: d.address?.line1 ?? '',
        city: d.address?.city ?? 'Kollur',
        state: d.address?.state ?? 'Karnataka',
        pincode: (d.address as any)?.pincode ?? '576220',
      },
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
      const safeAddress = {
        line1: form.address.line1.trim() || 'Kollur',
        city: form.address.city.trim() || 'Kollur',
        state: form.address.state.trim() || 'Karnataka',
        pincode: form.address.pincode?.trim() || '576220',
        country: 'India',
      };

      if (editTarget) {
        await apiClient.put(`/admin/drivers/${editTarget._id}`, {
          ...form,
          address: safeAddress,
        });
        toast('Driver updated successfully');
      } else {
        const payload = {
          ...form,
          address: safeAddress,
          licenseExpiry: form.licenseExpiry ? new Date(form.licenseExpiry).toISOString() : new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          joiningDate: form.joiningDate ? new Date(form.joiningDate).toISOString() : new Date().toISOString(),
        };
        await apiClient.post('/admin/drivers', payload);
        toast('Driver created successfully');
      }
      setShowForm(false); refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; error?: { details?: Record<string,string> } } } };
      const details = err.response?.data?.error?.details;
      setFormError(details ? Object.values(details).join(', ') : (err.response?.data?.message ?? 'Failed to save. Please try again.'));
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const isPerm = permanentDelete || deleteTarget.status === 'INACTIVE' || deleteTarget.status === 'SUSPENDED';
      await apiClient.delete(`/admin/drivers/${deleteTarget._id}${isPerm ? '?permanent=true' : ''}`);
      toast(isPerm ? 'Driver permanently deleted' : 'Driver deactivated successfully');
      setDeleteTarget(null);
      setPermanentDelete(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? (permanentDelete ? 'Failed to permanently delete driver' : 'Failed to deactivate driver'), 'error');
    } finally { setDeleting(false); }
  };

  const handleReactivate = async (d: Driver) => {
    setReactivatingId(d._id);
    try {
      await apiClient.patch(`/admin/drivers/${d._id}/status`, { status: 'AVAILABLE' });
      toast(`"${d.name}" reactivated and set to Available`);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to reactivate driver', 'error');
    } finally { setReactivatingId(null); }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res = await apiClient.delete('/admin/drivers/purge-inactive');
      toast(res.data?.message ?? 'Inactive drivers purged successfully');
      setPurgeOpen(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to purge inactive drivers', 'error');
    } finally { setPurging(false); }
  };

  const handleToggleStatus = async (d: Driver) => {
    const newStatus = d.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    try {
      await apiClient.patch(`/admin/drivers/${d._id}/status`, { status: newStatus });
      toast(`Driver status changed to ${newStatus}`); refresh();
    } catch { toast('Status update failed', 'error'); }
  };

  // Avatar colour
  const avatarColor = (name: string) => {
    const colors = ['#4F46E5','#0369A1','#7C3AED','#059669','#D97706','#DC2626'];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const columns: ColumnsType<Driver> = [
    {
      title: 'Driver',
      render: (_: unknown, d: Driver) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Avatar
            style={{ background: avatarColor(d.name), fontWeight: 700, fontSize: 12, flexShrink: 0 }}
            size={34}
          >
            {d.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
          </Avatar>
          <div>
            <div style={{ fontWeight: 600, color: '#111827', fontSize: 14, lineHeight: 1.3 }}>{d.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>{d.email || '—'}</Text>
          </div>
        </div>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'driverCode',
      render: (val: string) => (
        <Text code style={{ fontSize: 12, fontWeight: 700, color: '#4338CA' }}>{val}</Text>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      render: (val: string) => <Text style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>{val}</Text>,
    },
    {
      title: 'Rating',
      render: (_: unknown, d: Driver) => (
        <Space size={4}>
          <StarOutlined style={{ color: '#F59E0B', fontSize: 13 }} />
          <Text strong style={{ fontSize: 13 }}>{d.rating?.toFixed(1) ?? '—'}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>({d.ratingCount ?? 0})</Text>
        </Space>
      ),
    },
    {
      title: 'Trips',
      dataIndex: 'totalTrips',
      align: 'center',
      render: (val: number) => <Text strong>{val ?? 0}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (val: string) => <Tag color={STATUS_TAG[val] ?? 'default'}>{STATUS_LABELS[val] ?? val}</Tag>,
    },
    {
      title: 'Joined',
      dataIndex: 'joiningDate',
      render: (val: string) => val
        ? <Text type="secondary" style={{ fontSize: 12 }}>{new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}</Text>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      align: 'right',
      render: (_: unknown, d: Driver) => (
        <Space size={4}>
          <Tooltip title="Edit driver">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(d)} />
          </Tooltip>
          {d.status === 'INACTIVE' || d.status === 'SUSPENDED' ? (
            <>
              <Tooltip title="Reactivate driver">
                <Button
                  icon={<UndoOutlined />}
                  size="small"
                  style={{ color: '#059669', borderColor: '#A7F3D0' }}
                  loading={reactivatingId === d._id}
                  onClick={() => handleReactivate(d)}
                />
              </Tooltip>
              <Tooltip title="Permanently delete from database">
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  type="primary"
                  onClick={() => { setDeleteTarget(d); setPermanentDelete(true); }}
                />
              </Tooltip>
            </>
          ) : (
            <>
              <Tooltip title={d.status === 'AVAILABLE' ? 'Set Offline' : 'Set Available'}>
                <Button
                  icon={<PoweroffOutlined />}
                  size="small"
                  style={{ color: d.status === 'AVAILABLE' ? '#059669' : '#9CA3AF' }}
                  onClick={() => handleToggleStatus(d)}
                />
              </Tooltip>
              <Tooltip title="Deactivate driver">
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  onClick={() => { setDeleteTarget(d); setPermanentDelete(false); }}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <Title level={4} style={{ margin: 0, color: '#111827' }}>Drivers</Title>
          <Text type="secondary">Manage association drivers · {meta.total ?? 0} total</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Driver
        </Button>
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', gap: '0.75rem', alignItems: 'center',
        background: '#fff', padding: '0.75rem 1rem',
        borderRadius: 12, border: '1.5px solid #E8ECF0',
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          placeholder="Search name, phone, code..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          allowClear
          style={{ maxWidth: 280 }}
        />
        <Select
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }}
          placeholder="All Statuses"
          allowClear
          style={{ minWidth: 160 }}
          suffixIcon={<FilterOutlined />}
          options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ value: v, label: l }))}
        />
        {(statusFilter === 'INACTIVE' || statusFilter === 'SUSPENDED') && drivers.length > 0 && (
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => setPurgeOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            Purge All Inactive ({drivers.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        <Table
          columns={columns}
          dataSource={drivers}
          rowKey="_id"
          loading={isLoading}
          onChange={(p: TablePaginationConfig) => setPage(p.current ?? 1)}
          pagination={{
            current: page, pageSize: LIMIT, total: meta.total ?? 0,
            showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} drivers`,
            showSizeChanger: false,
            style: { padding: '12px 16px', margin: 0 },
          }}
          size="small"
          locale={{
            emptyText: (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <UserOutlined style={{ fontSize: 32, color: '#C7D2FE', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>No drivers found</div>
                <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 16 }}>
                  {search || statusFilter ? 'Try adjusting your filters' : 'Add your first driver to get started'}
                </div>
                {!search && !statusFilter && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="small">Add First Driver</Button>
                )}
              </div>
            ),
          }}
        />
      </div>

      {/* Drawer */}
      <Drawer
        open={showForm} onClose={() => setShowForm(false)}
        title={editTarget ? 'Edit Driver' : 'Add New Driver'}
        subtitle={editTarget ? `Editing ${editTarget.name}` : 'Fill in driver details below'}
        width={500}
        footer={
          <>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {editTarget ? 'Update Driver' : 'Add Driver'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {formError && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: 8, background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B', fontSize: 13 }}>
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
                  <input className="input-field" placeholder="KA12 20230001234" value={form.licenseNumber}
                    onChange={e => setF({ licenseNumber: e.target.value.toUpperCase() })} style={{ fontFamily: 'monospace' }} />
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
                <input className="input-field" placeholder="Kollur / Udupi" value={form.address.city} onChange={e => setAddr({ city: e.target.value })} />
              </Field>
              <Field label="State">
                <input className="input-field" value={form.address.state} onChange={e => setAddr({ state: e.target.value })} />
              </Field>
            </FormGrid>
            <FormGrid cols={2}>
              <Field label="Pincode">
                <input className="input-field" placeholder="576220" value={form.address.pincode} onChange={e => setAddr({ pincode: e.target.value })} />
              </Field>
            </FormGrid>
          </FormSection>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={
          permanentDelete || deleteTarget?.status === 'INACTIVE' || deleteTarget?.status === 'SUSPENDED'
            ? 'Permanently Delete Driver'
            : 'Deactivate Driver'
        }
        message={
          permanentDelete || deleteTarget?.status === 'INACTIVE' || deleteTarget?.status === 'SUSPENDED'
            ? `Are you sure you want to permanently delete driver "${deleteTarget?.name}" (${deleteTarget?.driverCode})? This will permanently remove their driver record and login account from the database.`
            : `Are you sure you want to deactivate "${deleteTarget?.name}"? They will no longer be able to join queues or accept trips.`
        }
        confirmLabel={
          permanentDelete || deleteTarget?.status === 'INACTIVE' || deleteTarget?.status === 'SUSPENDED'
            ? 'Delete Permanently'
            : 'Deactivate'
        }
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setPermanentDelete(false); }}
      >
        {deleteTarget?.status !== 'INACTIVE' && deleteTarget?.status !== 'SUSPENDED' && (
          <div style={{
            padding: '0.625rem 0.75rem', borderRadius: 8,
            background: '#FEF2F2', border: '1px solid #FECACA',
          }}>
            <Checkbox
              checked={permanentDelete}
              onChange={e => setPermanentDelete(e.target.checked)}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: '#991B1B' }}>
                Permanently delete from database instead (irreversible)
              </span>
            </Checkbox>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={purgeOpen}
        danger
        title="Purge All Inactive Drivers"
        message="Permanently delete all inactive and suspended drivers from the database? Drivers with active trips or queue entries will be safely preserved."
        confirmLabel="Purge Inactive"
        loading={purging}
        onConfirm={handlePurge}
        onCancel={() => setPurgeOpen(false)}
      />
    </div>
  );
}
