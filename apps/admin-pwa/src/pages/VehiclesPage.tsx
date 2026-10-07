import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Tag, Space, Input, Select, Form,
  Row, Col, Typography, Tooltip, Switch, Checkbox,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, FilterOutlined, CarOutlined, UndoOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';

const { Title, Text } = Typography;

interface Vehicle {
  _id: string; registrationNumber: string; brand: string; vehicleModel: string;
  manufacturingYear: number; color: string; fuelType: string; status: string;
  ac: boolean; seatCapacity: number; luggageCapacity: number; ownerName: string;
  categoryId?: { _id: string; name: string; code: string } | null;
  assignedDriverId?: { _id: string; name: string; phone: string; driverCode?: string } | null;
}
interface VehicleCategory { _id: string; name: string; code: string; }
interface DriverOption    { _id: string; name: string; phone: string; driverCode: string; }

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'success', INACTIVE: 'default', MAINTENANCE: 'warning', SUSPENDED: 'error',
};

const FUEL_COLOR: Record<string, string> = {
  PETROL: 'orange', DIESEL: 'default', CNG: 'green', ELECTRIC: 'blue', HYBRID: 'purple',
};

const EMPTY_FORM = {
  registrationNumber: '', brand: '', vehicleModel: '', manufacturingYear: new Date().getFullYear(),
  color: 'White', fuelType: 'DIESEL', seatCapacity: 4, luggageCapacity: 2, ac: true,
  ownerName: '', categoryId: '', assignedDriverId: '', status: 'ACTIVE',
};
const LIMIT = 15;

export function VehiclesPage() {
  const qc = useQueryClient();
  const [page, setPage]               = useState(1);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [catFilter, setCatFilter]     = useState('');
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [editTarget, setEditTarget]   = useState<Vehicle | null>(null);
  const [form, setForm]               = useState(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState('');
  const [deleteTarget, setDeleteTarget]       = useState<Vehicle | null>(null);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [deleting, setDeleting]               = useState(false);
  const [reactivatingId, setReactivatingId]   = useState<string | null>(null);
  const [purgeOpen, setPurgeOpen]             = useState(false);
  const [purging, setPurging]                 = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vehicles', page, search, statusFilter, catFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search)       p.set('search', search);
      if (statusFilter) p.set('status', statusFilter);
      if (catFilter)    p.set('categoryId', catFilter);
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
  const meta = data?.meta ?? data?.pagination ?? { total: 0, totalPages: 1 };
  const categories = catData ?? [];
  const drivers    = driversData ?? [];
  const refresh    = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-vehicles'] }), [qc]);

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
      const isPerm = permanentDelete || deleteTarget.status === 'INACTIVE';
      await apiClient.delete(`/admin/vehicles/${deleteTarget._id}${isPerm ? '?permanent=true' : ''}`);
      toast(isPerm ? 'Vehicle permanently deleted' : 'Vehicle deactivated');
      setDeleteTarget(null);
      setPermanentDelete(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? (permanentDelete ? 'Failed to permanently delete vehicle' : 'Failed to deactivate vehicle'), 'error');
    } finally { setDeleting(false); }
  };

  const handleReactivate = async (v: Vehicle) => {
    setReactivatingId(v._id);
    try {
      await apiClient.patch(`/admin/vehicles/${v._id}`, { status: 'ACTIVE' });
      toast(`"${v.registrationNumber}" reactivated`);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to reactivate vehicle', 'error');
    } finally { setReactivatingId(null); }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res = await apiClient.delete('/admin/vehicles/purge-inactive');
      toast(res.data?.message ?? 'Inactive vehicles purged successfully');
      setPurgeOpen(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to purge inactive vehicles', 'error');
    } finally { setPurging(false); }
  };

  const columns: ColumnsType<Vehicle> = [
    {
      title: 'Registration',
      dataIndex: 'registrationNumber',
      sorter: true,
      render: (val: string) => (
        <Text code style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>{val}</Text>
      ),
    },
    {
      title: 'Brand / Model',
      render: (_: unknown, r: Vehicle) => (
        <div>
          <div style={{ fontWeight: 600, color: '#111827' }}>{r.brand}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>{r.vehicleModel} · {r.manufacturingYear}</Text>
        </div>
      ),
    },
    {
      title: 'Category',
      render: (_: unknown, r: Vehicle) => r.categoryId
        ? <Tag color="geekblue" style={{ fontWeight: 500 }}>{r.categoryId.name}</Tag>
        : <Text type="secondary">—</Text>,
    },
    {
      title: 'Fuel',
      dataIndex: 'fuelType',
      render: (val: string) => <Tag color={FUEL_COLOR[val] ?? 'default'}>{val}</Tag>,
    },
    {
      title: 'Specs',
      render: (_: unknown, r: Vehicle) => (
        <Space size={4}>
          <Tag style={{ fontSize: 11 }}>{r.seatCapacity} seats</Tag>
          {r.ac && <Tag color="blue" style={{ fontSize: 11 }}>AC</Tag>}
        </Space>
      ),
    },
    {
      title: 'Driver',
      render: (_: unknown, r: Vehicle) => r.assignedDriverId
        ? <Text style={{ fontSize: 13 }}>{(r.assignedDriverId as { name: string }).name}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>Unassigned</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (val: string) => <Tag color={STATUS_COLOR[val] ?? 'default'}>{val}</Tag>,
    },
    {
      title: 'Actions',
      align: 'right',
      render: (_: unknown, r: Vehicle) => (
        <Space size={4}>
          <Tooltip title="Edit vehicle">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          </Tooltip>
          {r.status === 'INACTIVE' ? (
            <>
              <Tooltip title="Reactivate vehicle">
                <Button
                  icon={<UndoOutlined />}
                  size="small"
                  style={{ color: '#059669', borderColor: '#A7F3D0' }}
                  loading={reactivatingId === r._id}
                  onClick={() => handleReactivate(r)}
                />
              </Tooltip>
              <Tooltip title="Permanently delete from database">
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  type="primary"
                  onClick={() => { setDeleteTarget(r); setPermanentDelete(true); }}
                />
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Deactivate vehicle">
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                onClick={() => { setDeleteTarget(r); setPermanentDelete(false); }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const handleTableChange = (pagination: TablePaginationConfig) => {
    setPage(pagination.current ?? 1);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <Title level={4} style={{ margin: 0, color: '#111827' }}>Vehicles</Title>
          <Text type="secondary">{meta.total ?? 0} vehicles registered</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Vehicle
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
          placeholder="Reg. no, brand, model..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          allowClear
          style={{ maxWidth: 260 }}
        />
        <Select
          value={catFilter || undefined}
          onChange={v => { setCatFilter(v ?? ''); setPage(1); }}
          placeholder="All Types"
          allowClear
          style={{ minWidth: 160 }}
          suffixIcon={<FilterOutlined />}
          options={categories.map(c => ({ value: c._id, label: c.name }))}
        />
        <Select
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }}
          placeholder="All Statuses"
          allowClear
          style={{ minWidth: 150 }}
          options={Object.keys(STATUS_COLOR).map(s => ({ value: s, label: s }))}
        />
        {statusFilter === 'INACTIVE' && vehicles.length > 0 && (
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => setPurgeOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            Purge All Inactive ({vehicles.length})
          </Button>
        )}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        <Table
          columns={columns}
          dataSource={vehicles}
          rowKey="_id"
          loading={isLoading}
          onChange={handleTableChange}
          pagination={{
            current: page,
            pageSize: LIMIT,
            total: meta.total ?? 0,
            showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} vehicles`,
            showSizeChanger: false,
            style: { padding: '12px 16px', margin: 0 },
          }}
          size="small"
          locale={{
            emptyText: (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <CarOutlined style={{ fontSize: 32, color: '#C7D2FE', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>No vehicles found</div>
                <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 16 }}>
                  {search || statusFilter || catFilter ? 'Try adjusting your filters' : 'Register your first vehicle to get started'}
                </div>
                {!search && !statusFilter && !catFilter && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="small">
                    Add Vehicle
                  </Button>
                )}
              </div>
            ),
          }}
        />
      </div>

      {/* Drawer */}
      <Drawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Vehicle' : 'Add Vehicle'}
        subtitle={editTarget ? `Editing: ${editTarget.registrationNumber}` : 'Register a new vehicle in the fleet'}
        width={520}
        footer={
          <>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {editTarget ? 'Update Vehicle' : 'Add Vehicle'}
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
                  {Object.keys(STATUS_COLOR).map(s => <option key={s}>{s}</option>)}
                </select>
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="Capacity & Comfort">
            <FormGrid cols={2}>
              <Field label="Seat Capacity">
                <input type="number" min={1} max={60} className="input-field" value={form.seatCapacity} onChange={e => sf('seatCapacity', +e.target.value)} />
              </Field>
              <Field label="Luggage (bags)">
                <input type="number" min={0} className="input-field" value={form.luggageCapacity} onChange={e => sf('luggageCapacity', +e.target.value)} />
              </Field>
            </FormGrid>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Switch checked={form.ac} onChange={v => sf('ac', v)} size="small" />
              <span style={{ fontSize: 14, color: '#4B5563' }}>Air Conditioned</span>
            </div>
          </FormSection>

          <FormSection title="Ownership & Assignment">
            <Field label="Owner Name">
              <input className="input-field" placeholder="Vehicle owner full name" value={form.ownerName} onChange={e => sf('ownerName', e.target.value)} />
            </Field>
            <Field label="Assign Driver" hint="Only available drivers are shown">
              <select className="input-field" value={form.assignedDriverId} onChange={e => sf('assignedDriverId', e.target.value)}>
                <option value="">Unassigned</option>
                {drivers.map(d => <option key={d._id} value={d._id}>{d.name} — {d.driverCode}</option>)}
              </select>
            </Field>
          </FormSection>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title={
          permanentDelete || deleteTarget?.status === 'INACTIVE'
            ? 'Permanently Delete Vehicle'
            : 'Deactivate Vehicle'
        }
        message={
          permanentDelete || deleteTarget?.status === 'INACTIVE'
            ? `Are you sure you want to permanently delete vehicle "${deleteTarget?.registrationNumber}" (${deleteTarget?.brand} ${deleteTarget?.vehicleModel})? This will completely remove it from the database and cannot be undone.`
            : `Deactivate "${deleteTarget?.registrationNumber} – ${deleteTarget?.brand} ${deleteTarget?.vehicleModel}"? It will be marked as INACTIVE.`
        }
        confirmLabel={
          permanentDelete || deleteTarget?.status === 'INACTIVE'
            ? 'Delete Permanently'
            : 'Deactivate'
        }
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteTarget(null); setPermanentDelete(false); }}
      >
        {deleteTarget?.status !== 'INACTIVE' && (
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
        title="Purge All Inactive Vehicles"
        message="Permanently delete all inactive vehicles from the database? Vehicles with ongoing trips or queue entries will be safely preserved."
        confirmLabel="Purge Inactive"
        loading={purging}
        onConfirm={handlePurge}
        onCancel={() => setPurgeOpen(false)}
      />
    </div>
  );
}
