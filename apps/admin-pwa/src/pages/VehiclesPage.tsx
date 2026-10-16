import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Tag, Space, Input, Select,
  Typography, Tooltip, Switch, Checkbox,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, FilterOutlined, CarOutlined, UndoOutlined,
  PoweroffOutlined, PhoneOutlined, MessageOutlined,
  UserOutlined, ReloadOutlined, CheckCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';

const { Title, Text } = Typography;

interface Vehicle {
  _id: string;
  registrationNumber: string;
  brand: string;
  vehicleModel: string;
  manufacturingYear: number;
  color: string;
  fuelType: string;
  status: string;
  ac: boolean;
  seatCapacity: number;
  luggageCapacity: number;
  ownerName: string;
  ownerPhone?: string;
  categoryId?: {
    _id: string;
    name: string;
    code: string;
    seatCapacity?: number;
    luggageCapacity?: number;
  } | null;
  assignedDriverId?: {
    _id: string;
    name: string;
    phone: string;
    driverCode?: string;
    licenseNumber?: string;
  } | null;
}

interface VehicleCategory {
  _id: string;
  name: string;
  code: string;
  seatCapacity?: number;
  luggageCapacity?: number;
  ac?: boolean;
  fuelType?: string;
}

interface DriverOption {
  _id: string;
  name: string;
  phone: string;
  driverCode: string;
  licenseNumber?: string;
  status: string;
  assignedVehicle?: {
    _id: string;
    registrationNumber: string;
  };
}

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'success',
  INACTIVE: 'default',
  MAINTENANCE: 'warning',
  SUSPENDED: 'error',
};

const FUEL_COLOR: Record<string, string> = {
  PETROL: 'orange',
  DIESEL: 'default',
  CNG: 'green',
  ELECTRIC: 'blue',
  HYBRID: 'purple',
};

const EMPTY_FORM = {
  registrationNumber: '',
  brand: '',
  vehicleModel: '',
  manufacturingYear: new Date().getFullYear(),
  color: 'White',
  fuelType: 'DIESEL',
  seatCapacity: 4,
  luggageCapacity: 2,
  ac: true,
  ownerName: '',
  ownerPhone: '',
  categoryId: '',
  assignedDriverId: '',
  status: 'ACTIVE',
};

const LIMIT = 15;

export function VehiclesPage() {
  const qc = useQueryClient();
  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [catFilter, setCatFilter]       = useState('');
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editTarget, setEditTarget]     = useState<Vehicle | null>(null);
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');

  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget]         = useState<Vehicle | null>(null);
  const [permanentDelete, setPermanentDelete]   = useState(false);
  const [deleting, setDeleting]                 = useState(false);
  const [reactivatingId, setReactivatingId]     = useState<string | null>(null);
  const [purgeOpen, setPurgeOpen]               = useState(false);
  const [purging, setPurging]                   = useState(false);

  // Fetch Vehicles
  const { data, isLoading, isFetching } = useQuery({
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

  // Fetch Vehicle Categories
  const { data: catData } = useQuery<VehicleCategory[]>({
    queryKey: ['vehicle-categories-list'],
    queryFn: async () => {
      const r = await apiClient.get('/admin/vehicle-categories');
      return r.data?.data ?? [];
    },
  });

  // Fetch All Platform Drivers for Driver Assignment Search
  const { data: driversData } = useQuery<DriverOption[]>({
    queryKey: ['admin-drivers-assign-list'],
    queryFn: async () => {
      const r = await apiClient.get('/admin/drivers?limit=200');
      return r.data?.data ?? [];
    },
  });

  const vehicles: Vehicle[] = data?.data ?? [];
  const meta = data?.meta ?? data?.pagination ?? { total: 0, totalPages: 1 };
  const categories = catData ?? [];
  const drivers    = driversData ?? [];
  const refresh    = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-vehicles'] }), [qc]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setDrawerOpen(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditTarget(v);
    setForm({
      registrationNumber: v.registrationNumber,
      brand: v.brand,
      vehicleModel: v.vehicleModel,
      manufacturingYear: v.manufacturingYear,
      color: v.color,
      fuelType: v.fuelType,
      seatCapacity: v.seatCapacity,
      luggageCapacity: v.luggageCapacity,
      ac: v.ac,
      ownerName: v.ownerName || '',
      ownerPhone: v.ownerPhone || '',
      categoryId: v.categoryId?._id ?? '',
      status: v.status,
      assignedDriverId: (v.assignedDriverId as DriverOption)?._id ?? '',
    });
    setFormError('');
    setDrawerOpen(true);
  };

  const sf = (k: keyof typeof EMPTY_FORM, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // Auto-populate seats and luggage capacity based on vehicle category selection
  const handleCategoryChange = (categoryId: string) => {
    const selectedCat = categories.find(c => c._id === categoryId);
    setForm(f => ({
      ...f,
      categoryId,
      seatCapacity: (selectedCat?.seatCapacity !== undefined && selectedCat?.seatCapacity !== null)
        ? selectedCat.seatCapacity
        : f.seatCapacity,
      luggageCapacity: (selectedCat?.luggageCapacity !== undefined && selectedCat?.luggageCapacity !== null)
        ? selectedCat.luggageCapacity
        : f.luggageCapacity,
      ac: selectedCat?.ac !== undefined ? selectedCat.ac : f.ac,
      fuelType: selectedCat?.fuelType || f.fuelType,
    }));
  };

  const handleSave = async () => {
    if (!form.registrationNumber.trim()) { setFormError('Registration number is required'); return; }
    if (!form.brand.trim())              { setFormError('Brand is required'); return; }
    if (!form.categoryId)                { setFormError('Please select a vehicle category'); return; }

    setSaving(true);
    setFormError('');
    try {
      const cleanOwnerPhone = form.ownerPhone?.trim()
        ? (form.ownerPhone.trim().startsWith('+91')
            ? form.ownerPhone.trim()
            : `+91${form.ownerPhone.replace(/\D/g, '').slice(-10)}`)
        : undefined;

      const payload = {
        ...form,
        ownerPhone: cleanOwnerPhone,
        assignedDriverId: form.assignedDriverId || undefined,
      };

      if (editTarget) {
        await apiClient.put(`/admin/vehicles/${editTarget._id}`, payload);
        toast('Vehicle updated successfully');
      } else {
        await apiClient.post('/admin/vehicles', payload);
        toast('Vehicle added successfully');
      }
      setDrawerOpen(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFormError(err.response?.data?.message ?? 'Failed to save vehicle');
    } finally {
      setSaving(false);
    }
  };

  // Quick Active/Inactive Toggle Button Handler
  const handleToggleStatus = async (v: Vehicle) => {
    setTogglingStatusId(v._id);
    const newStatus = v.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await apiClient.patch(`/admin/vehicles/${v._id}`, { status: newStatus });
      toast(`Vehicle "${v.registrationNumber}" is now ${newStatus}`);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to toggle vehicle status', 'error');
    } finally {
      setTogglingStatusId(null);
    }
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
    } finally {
      setDeleting(false);
    }
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
    } finally {
      setReactivatingId(null);
    }
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
    } finally {
      setPurging(false);
    }
  };

  const columns: ColumnsType<Vehicle> = [
    {
      title: 'Registration',
      dataIndex: 'registrationNumber',
      key: 'registrationNumber',
      width: 170,
      render: (val: string) => (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: '#F8FAFC',
            border: '1.5px solid #CBD5E1',
            borderRadius: 6,
            padding: '3px 8px',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.05em',
            color: '#0F172A',
            fontFamily: 'monospace',
          }}
        >
          <CarOutlined style={{ color: '#4F46E5' }} />
          <span>{val}</span>
        </div>
      ),
    },
    {
      title: 'Brand & Model',
      key: 'brandModel',
      width: 180,
      render: (_: unknown, r: Vehicle) => (
        <div>
          <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>{r.brand} {r.vehicleModel}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {r.manufacturingYear} · {r.color}
          </Text>
        </div>
      ),
    },
    {
      title: 'Category',
      key: 'category',
      width: 140,
      render: (_: unknown, r: Vehicle) => r.categoryId ? (
        <Tag color="geekblue" style={{ fontWeight: 600, fontSize: 12 }}>
          {r.categoryId.name}
        </Tag>
      ) : (
        <Text type="secondary">—</Text>
      ),
    },
    {
      title: 'Capacity & Specs',
      key: 'specs',
      width: 190,
      render: (_: unknown, r: Vehicle) => (
        <Space size={4} wrap>
          <Tag style={{ fontSize: 11, fontWeight: 500 }}>{r.seatCapacity} Seats</Tag>
          {r.luggageCapacity > 0 && (
            <Tag style={{ fontSize: 11, fontWeight: 500 }}>{r.luggageCapacity} Bags</Tag>
          )}
          {r.ac && <Tag color="blue" style={{ fontSize: 11 }}>AC</Tag>}
          <Tag color={FUEL_COLOR[r.fuelType] ?? 'default'} style={{ fontSize: 11 }}>
            {r.fuelType}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Owner Details',
      key: 'owner',
      width: 180,
      render: (_: unknown, r: Vehicle) => (
        <div>
          <div style={{ fontWeight: 600, color: '#1E293B', fontSize: 13 }}>
            {r.ownerName || 'Self / Association'}
          </div>
          {r.ownerPhone ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                {r.ownerPhone}
              </Text>
              <Tooltip title="Call Owner">
                <a
                  href={`tel:${r.ownerPhone}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: '#4F46E5',
                    fontSize: 11,
                  }}
                >
                  <PhoneOutlined />
                </a>
              </Tooltip>
              <Tooltip title="Chat on WhatsApp">
                <a
                  href={`https://wa.me/${r.ownerPhone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    color: '#059669',
                    fontSize: 11,
                  }}
                >
                  <MessageOutlined />
                </a>
              </Tooltip>
            </div>
          ) : (
            <Text type="secondary" style={{ fontSize: 11 }}>No contact recorded</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Assigned Driver',
      key: 'driver',
      width: 190,
      render: (_: unknown, r: Vehicle) => {
        if (!r.assignedDriverId) {
          return (
            <Tag color="default" style={{ fontSize: 11, color: '#9CA3AF' }}>
              Unassigned
            </Tag>
          );
        }
        const d = r.assignedDriverId as { name: string; phone?: string; driverCode?: string };
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>{d.name}</span>
              {d.driverCode && (
                <Tag color="geekblue" style={{ fontSize: 10, margin: 0, fontFamily: 'monospace' }}>
                  {d.driverCode}
                </Tag>
              )}
            </div>
            {d.phone && (
              <Text type="secondary" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                📞 {d.phone}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (val: string, r: Vehicle) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag
            color={STATUS_COLOR[val] ?? 'default'}
            style={{ fontWeight: 600, fontSize: 12, padding: '2px 8px', borderRadius: 6, margin: 0 }}
          >
            ● {val}
          </Tag>
          <Tooltip title={r.status === 'ACTIVE' ? 'Click to deactivate vehicle' : 'Click to activate vehicle'}>
            <Button
              type="text"
              size="small"
              loading={togglingStatusId === r._id}
              icon={<PoweroffOutlined />}
              style={{
                color: r.status === 'ACTIVE' ? '#10B981' : '#9CA3AF',
                padding: '0 4px',
                height: 24,
              }}
              onClick={() => handleToggleStatus(r)}
            />
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 140,
      render: (_: unknown, r: Vehicle) => (
        <Space size={4}>
          {/* Quick Active / Inactive Toggle Button */}
          <Tooltip title={r.status === 'ACTIVE' ? 'Set Inactive / Off Duty' : 'Set Active / In Service'}>
            <Button
              icon={<PoweroffOutlined />}
              size="small"
              loading={togglingStatusId === r._id}
              style={{
                color: r.status === 'ACTIVE' ? '#059669' : '#6B7280',
                borderColor: r.status === 'ACTIVE' ? '#A7F3D0' : '#E5E7EB',
                background: r.status === 'ACTIVE' ? '#ECFDF5' : '#F9FAFB',
              }}
              onClick={() => handleToggleStatus(r)}
            />
          </Tooltip>

          <Tooltip title="Edit Vehicle">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          </Tooltip>

          {r.status === 'INACTIVE' ? (
            <>
              <Tooltip title="Reactivate Vehicle">
                <Button
                  icon={<UndoOutlined />}
                  size="small"
                  style={{ color: '#059669', borderColor: '#A7F3D0', background: '#ECFDF5' }}
                  loading={reactivatingId === r._id}
                  onClick={() => handleReactivate(r)}
                />
              </Tooltip>
              <Tooltip title="Permanently Delete Vehicle">
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
            <Tooltip title="Deactivate Vehicle">
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
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
            Fleet Vehicles
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Manage taxi fleet, assign drivers, verify registration and configure passenger capacity · {meta.total ?? 0} vehicles
          </Text>
        </div>
        <Space size={8}>
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={refresh}
            title="Refresh list"
          >
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Vehicle
          </Button>
        </Space>
      </div>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: '#fff',
          padding: '0.875rem 1rem',
          borderRadius: 12,
          border: '1.5px solid #E8ECF0',
          boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        }}
      >
        <Input
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          placeholder="Search reg. no, brand, model, owner..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          allowClear
          style={{ flex: '1 1 240px', minWidth: 220 }}
        />
        <Select
          value={catFilter || undefined}
          onChange={v => { setCatFilter(v ?? ''); setPage(1); }}
          placeholder="Category: All Types"
          allowClear
          style={{ width: 180 }}
          suffixIcon={<FilterOutlined />}
          options={categories.map(c => ({ value: c._id, label: c.name }))}
        />
        <Select
          value={statusFilter || undefined}
          onChange={v => { setStatusFilter(v ?? ''); setPage(1); }}
          placeholder="Status: All Statuses"
          allowClear
          style={{ width: 170 }}
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'ACTIVE', label: '🟢 Active' },
            { value: 'INACTIVE', label: '⚪ Inactive' },
            { value: 'MAINTENANCE', label: '🟡 Maintenance' },
            { value: 'SUSPENDED', label: '🔴 Suspended' },
          ]}
        />
        {(statusFilter || catFilter || search) && (
          <Button
            onClick={() => {
              setSearch('');
              setStatusFilter('');
              setCatFilter('');
              setPage(1);
            }}
          >
            Clear Filters
          </Button>
        )}
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
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          border: '1.5px solid #E8ECF0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        }}
      >
        <Table
          columns={columns}
          dataSource={vehicles}
          rowKey="_id"
          loading={isLoading}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
          pagination={{
            current: page,
            pageSize: LIMIT,
            total: meta.total ?? 0,
            showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} vehicles`,
            showSizeChanger: false,
            style: { padding: '12px 16px', margin: 0 },
          }}
          size="middle"
          locale={{
            emptyText: (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <CarOutlined style={{ fontSize: 36, color: '#C7D2FE', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: '#1F2937', fontSize: 15, marginBottom: 6 }}>
                  No vehicles found
                </div>
                <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 16 }}>
                  {search || statusFilter || catFilter
                    ? 'No vehicles match your active search or filters'
                    : 'Register your first vehicle to get started'}
                </div>
                {!search && !statusFilter && !catFilter && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    Add Vehicle
                  </Button>
                )}
              </div>
            ),
          }}
        />
      </div>

      {/* Add / Edit Vehicle Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Vehicle' : 'Add Vehicle'}
        subtitle={editTarget ? `Editing: ${editTarget.registrationNumber}` : 'Register a new vehicle into the fleet'}
        width={560}
        footer={
          <>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {editTarget ? 'Update Vehicle' : 'Register Vehicle'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {formError && (
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 8,
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#991B1B',
                fontSize: 13,
              }}
            >
              {formError}
            </div>
          )}

          {/* Registration & Category */}
          <FormSection title="Registration & Category">
            <FormGrid cols={2}>
              <Field label="Registration Number" required>
                <input
                  className="input-field"
                  placeholder="KA 20 B 1234"
                  value={form.registrationNumber}
                  onChange={e => sf('registrationNumber', e.target.value.toUpperCase())}
                  style={{ fontFamily: 'monospace', letterSpacing: '0.05em', fontWeight: 600 }}
                />
              </Field>

              {/* Requirement #1: Searchable Vehicle Category */}
              <Field label="Vehicle Category" required hint="Type to search category">
                <Select
                  showSearch
                  placeholder="Search & select category..."
                  value={form.categoryId || undefined}
                  onChange={handleCategoryChange}
                  filterOption={(input, option) =>
                    (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase().trim())
                  }
                  options={categories.map(c => ({
                    value: c._id,
                    label: `${c.name} (${c.code || 'Cab'})`,
                  }))}
                  style={{ width: '100%', height: 42 }}
                />
              </Field>
            </FormGrid>
          </FormSection>

          {/* Vehicle Details */}
          <FormSection title="Vehicle Details">
            <FormGrid cols={2}>
              <Field label="Brand" required>
                <input
                  className="input-field"
                  placeholder="e.g. Maruti Suzuki / Toyota"
                  value={form.brand}
                  onChange={e => sf('brand', e.target.value)}
                />
              </Field>
              <Field label="Model" required>
                <input
                  className="input-field"
                  placeholder="e.g. Dzire / Innova Crysta"
                  value={form.vehicleModel}
                  onChange={e => sf('vehicleModel', e.target.value)}
                />
              </Field>
              <Field label="Manufacturing Year">
                <input
                  type="number"
                  min={2000}
                  max={2030}
                  className="input-field"
                  value={form.manufacturingYear}
                  onChange={e => sf('manufacturingYear', +e.target.value)}
                />
              </Field>
              <Field label="Color">
                <input
                  className="input-field"
                  placeholder="White / Silver"
                  value={form.color}
                  onChange={e => sf('color', e.target.value)}
                />
              </Field>
              <Field label="Fuel Type">
                <select
                  className="input-field"
                  value={form.fuelType}
                  onChange={e => sf('fuelType', e.target.value)}
                >
                  {['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID'].map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </Field>
              <Field label="Initial Status">
                <select
                  className="input-field"
                  value={form.status}
                  onChange={e => sf('status', e.target.value)}
                >
                  {Object.keys(STATUS_COLOR).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </FormGrid>
          </FormSection>

          {/* Requirement #2: Auto-populated seats and luggage capacity with manual entry option */}
          <FormSection title="Capacity & Comfort">
            <FormGrid cols={2}>
              <Field
                label="Seat Capacity"
                hint="Auto-filled from category; editable manually"
              >
                <input
                  type="number"
                  min={1}
                  max={60}
                  className="input-field"
                  value={form.seatCapacity}
                  onChange={e => sf('seatCapacity', +e.target.value)}
                />
              </Field>
              <Field
                label="Luggage Capacity (bags)"
                hint="Auto-filled from category; editable manually"
              >
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={form.luggageCapacity}
                  onChange={e => sf('luggageCapacity', +e.target.value)}
                />
              </Field>
            </FormGrid>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Switch checked={form.ac} onChange={v => sf('ac', v)} size="small" />
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Air Conditioned (AC)</span>
            </div>
          </FormSection>

          {/* Requirement #3: Owner Name & Owner Contact Number */}
          <FormSection title="Vehicle Ownership">
            <FormGrid cols={2}>
              <Field label="Owner Name">
                <input
                  className="input-field"
                  placeholder="Association / Self / Owner Name"
                  value={form.ownerName}
                  onChange={e => sf('ownerName', e.target.value)}
                />
              </Field>
              <Field label="Owner Contact Number" hint="10-digit mobile number">
                <input
                  className="input-field"
                  placeholder="9876543210"
                  value={form.ownerPhone}
                  onChange={e => sf('ownerPhone', e.target.value)}
                />
              </Field>
            </FormGrid>
          </FormSection>

          {/* Requirement #4: Searchable Driver Assignment (search by name, phone, license, driver id) */}
          <FormSection title="Driver Assignment">
            <Field
              label="Assign Driver"
              hint="Search drivers by name, phone number, DL number, or driver code"
            >
              <Select
                showSearch
                allowClear
                placeholder="Search driver by name, phone, DL, or code..."
                value={form.assignedDriverId || undefined}
                onChange={val => sf('assignedDriverId', val ?? '')}
                filterOption={(input, option) => {
                  const d = (option as any)?._driver as DriverOption | undefined;
                  if (!d) return false;
                  const q = input.toLowerCase().trim();
                  return (
                    (d.name || '').toLowerCase().includes(q) ||
                    (d.phone || '').includes(q) ||
                    (d.driverCode || '').toLowerCase().includes(q) ||
                    (d.licenseNumber || '').toLowerCase().includes(q)
                  );
                }}
                style={{ width: '100%' }}
                options={drivers.map(d => ({
                  value: d._id,
                  label: `${d.name} (${d.driverCode}) - ${d.phone}`,
                  _driver: d,
                }))}
                optionRender={(option) => {
                  const d = (option.data as any)?._driver as DriverOption | undefined;
                  if (!d) return option.label;
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 0' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontWeight: 600, color: '#111827' }}>{d.name}</span>
                          <Tag color="geekblue" style={{ margin: 0, fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}>
                            {d.driverCode}
                          </Tag>
                          <Tag
                            color={d.status === 'AVAILABLE' ? 'success' : d.status === 'SUSPENDED' ? 'error' : 'default'}
                            style={{ margin: 0, fontSize: 10 }}
                          >
                            {d.status}
                          </Tag>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                          📞 {d.phone} {d.licenseNumber ? `• DL: ${d.licenseNumber}` : ''}
                        </div>
                      </div>
                      {d.assignedVehicle && (
                        <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>
                          🚗 {d.assignedVehicle.registrationNumber}
                        </Tag>
                      )}
                    </div>
                  );
                }}
              />
            </Field>
          </FormSection>
        </div>
      </Drawer>

      {/* Confirmation Dialogs */}
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
          <div
            style={{
              padding: '0.625rem 0.75rem',
              borderRadius: 8,
              background: '#FEF2F2',
              border: '1px solid #FECACA',
            }}
          >
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
