import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Tag, Space, Input, Typography,
  Tooltip, Switch, InputNumber, Checkbox, Select, Segmented,
  Divider, Card, Badge,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, CarOutlined, CheckCircleOutlined, CloseCircleOutlined,
  UndoOutlined, CloudUploadOutlined, CalculatorOutlined,
  ThunderboltOutlined, ClockCircleOutlined, SyncOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';

const { Title, Text } = Typography;
const INR = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export interface TripFareConfig {
  baseFare: number;
  ratePerKm?: number;
  minimumKm?: number;
  waitingChargePerMin: number;
  nightChargeMultiplier: number;
  driverAllowance?: number;
  baseHours?: number;
  baseKm?: number;
  extraKmRate?: number;
  extraHourRate?: number;
}

export interface VehicleCategoryFares {
  oneWay: TripFareConfig;
  roundTrip: TripFareConfig;
  rental: TripFareConfig;
}

export interface VehicleCategory {
  _id: string;
  name: string;
  code: string;
  description?: string;
  icon?: string;
  image?: string;
  seatCapacity: number;
  luggageCapacity: number;
  ac: boolean;
  fuelType?: string;
  baseFare: number;
  minimumKm: number;
  ratePerKm: number;
  ratePerHour?: number;
  extraKmRate?: number;
  extraHourRate?: number;
  waitingChargePerMin: number;
  nightChargeMultiplier: number;
  fares?: VehicleCategoryFares;
  status: 'ACTIVE' | 'INACTIVE';
  sortOrder: number;
}

const DEFAULT_FARES: VehicleCategoryFares = {
  oneWay: {
    baseFare: 100,
    ratePerKm: 18,
    minimumKm: 5,
    waitingChargePerMin: 2,
    nightChargeMultiplier: 1.15,
  },
  roundTrip: {
    baseFare: 200,
    ratePerKm: 16,
    minimumKm: 60,
    waitingChargePerMin: 2,
    nightChargeMultiplier: 1.15,
    driverAllowance: 300,
  },
  rental: {
    baseFare: 600,
    baseHours: 2,
    baseKm: 20,
    extraKmRate: 18,
    extraHourRate: 150,
    waitingChargePerMin: 2,
    nightChargeMultiplier: 1.15,
  },
};

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  icon: '',
  seatCapacity: 4,
  luggageCapacity: 2,
  ac: true,
  fuelType: 'DIESEL',
  sortOrder: 0,
  fares: DEFAULT_FARES,
};

const FUEL_TYPES = ['PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID'];
const LIMIT = 20;

export function VehicleCategoriesPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [page, setPage]                         = useState(1);
  const [search, setSearch]                     = useState('');
  const [statusFilter, setStatusFilter]         = useState('');
  const [drawerOpen, setDrawerOpen]             = useState(false);
  const [editTarget, setEditTarget]             = useState<VehicleCategory | null>(null);
  const [form, setForm]                         = useState(EMPTY_FORM);
  const [activeFareTab, setActiveFareTab]       = useState<'ONE_WAY' | 'ROUND_TRIP' | 'RENTAL'>('ONE_WAY');
  const [saving, setSaving]                     = useState(false);
  const [uploadingIcon, setUploadingIcon]       = useState(false);
  const [formError, setFormError]               = useState('');
  const [deleteTarget, setDeleteTarget]         = useState<VehicleCategory | null>(null);
  const [permanentDelete, setPermanentDelete]   = useState(false);
  const [deleting, setDeleting]                 = useState(false);
  const [reactivatingId, setReactivatingId]     = useState<string | null>(null);
  const [purgeOpen, setPurgeOpen]               = useState(false);
  const [purging, setPurging]                   = useState(false);

  // Live Simulator state
  const [simTripType, setSimTripType]           = useState<'ONE_WAY' | 'ROUND_TRIP' | 'RENTAL'>('ONE_WAY');
  const [simDistanceKm, setSimDistanceKm]       = useState<number>(25);
  const [simDurationHours, setSimDurationHours] = useState<number>(2);
  const [simWaitingMins, setSimWaitingMins]     = useState<number>(10);
  const [simIsNight, setSimIsNight]             = useState<boolean>(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-vehicle-categories', page, search, statusFilter],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search)       p.set('search', search);
      if (statusFilter) p.set('status', statusFilter);
      const res = await apiClient.get(`/admin/vehicle-categories?${p}`);
      if (Array.isArray(res.data?.data)) return { data: res.data.data, meta: res.data.meta ?? { total: res.data.data.length, totalPages: 1 } };
      if (Array.isArray(res.data))       return { data: res.data, meta: { total: res.data.length, totalPages: 1 } };
      return res.data;
    },
  });

  const categories: VehicleCategory[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, totalPages: 1 };
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['admin-vehicle-categories'] }), [qc]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setActiveFareTab('ONE_WAY');
    setDrawerOpen(true);
  };

  const openEdit = (c: VehicleCategory) => {
    setEditTarget(c);
    setForm({
      name: c.name,
      code: c.code,
      description: c.description ?? '',
      icon: c.icon || c.image || '',
      seatCapacity: c.seatCapacity ?? 4,
      luggageCapacity: c.luggageCapacity ?? 2,
      ac: c.ac ?? true,
      fuelType: c.fuelType ?? 'DIESEL',
      sortOrder: c.sortOrder ?? 0,
      fares: {
        oneWay: {
          baseFare: c.fares?.oneWay?.baseFare ?? c.baseFare ?? 100,
          ratePerKm: c.fares?.oneWay?.ratePerKm ?? c.ratePerKm ?? 18,
          minimumKm: c.fares?.oneWay?.minimumKm ?? c.minimumKm ?? 5,
          waitingChargePerMin: c.fares?.oneWay?.waitingChargePerMin ?? c.waitingChargePerMin ?? 2,
          nightChargeMultiplier: c.fares?.oneWay?.nightChargeMultiplier ?? c.nightChargeMultiplier ?? 1.15,
        },
        roundTrip: {
          baseFare: c.fares?.roundTrip?.baseFare ?? c.baseFare ?? 200,
          ratePerKm: c.fares?.roundTrip?.ratePerKm ?? c.ratePerKm ?? 16,
          minimumKm: c.fares?.roundTrip?.minimumKm ?? Math.max(50, (c.minimumKm ?? 5) * 2),
          waitingChargePerMin: c.fares?.roundTrip?.waitingChargePerMin ?? c.waitingChargePerMin ?? 2,
          nightChargeMultiplier: c.fares?.roundTrip?.nightChargeMultiplier ?? c.nightChargeMultiplier ?? 1.15,
          driverAllowance: c.fares?.roundTrip?.driverAllowance ?? 300,
        },
        rental: {
          baseFare: c.fares?.rental?.baseFare ?? (c.baseFare ? c.baseFare * 3 : 600),
          baseHours: c.fares?.rental?.baseHours ?? 2,
          baseKm: c.fares?.rental?.baseKm ?? 20,
          extraKmRate: c.fares?.rental?.extraKmRate ?? c.extraKmRate ?? c.ratePerKm ?? 18,
          extraHourRate: c.fares?.rental?.extraHourRate ?? c.extraHourRate ?? 150,
          waitingChargePerMin: c.fares?.rental?.waitingChargePerMin ?? c.waitingChargePerMin ?? 2,
          nightChargeMultiplier: c.fares?.rental?.nightChargeMultiplier ?? c.nightChargeMultiplier ?? 1.15,
        },
      },
    });
    setFormError('');
    setActiveFareTab('ONE_WAY');
    setDrawerOpen(true);
  };

  const sf = (k: keyof typeof EMPTY_FORM, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const setFareField = <T extends keyof VehicleCategoryFares>(
    tier: T,
    field: keyof VehicleCategoryFares[T],
    val: number
  ) => {
    setForm(prev => ({
      ...prev,
      fares: {
        ...prev.fares,
        [tier]: {
          ...prev.fares[tier],
          [field]: val,
        },
      },
    }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('png') && !file.type.startsWith('image/')) {
      toast('Please upload a PNG or image file', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Icon image must be less than 5MB', 'error');
      return;
    }

    setUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append('icon', file);
      const res = await apiClient.post('/admin/vehicle-categories/upload-icon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const iconUrl = res.data?.data?.url ?? res.data?.url;
      setForm(f => ({ ...f, icon: iconUrl }));
      toast('Vehicle PNG icon uploaded successfully');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast(e.response?.data?.message ?? 'Failed to upload icon', 'error');
    } finally {
      setUploadingIcon(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Category name is required'); return; }
    if (!form.code.trim()) { setFormError('Category code is required'); return; }
    setSaving(true);
    setFormError('');

    try {
      const payload = {
        ...form,
        code: form.code.toUpperCase(),
        // Keep top-level legacy fields synchronized with One Way & Rental
        baseFare: form.fares.oneWay.baseFare,
        ratePerKm: form.fares.oneWay.ratePerKm,
        minimumKm: form.fares.oneWay.minimumKm,
        waitingChargePerMin: form.fares.oneWay.waitingChargePerMin,
        nightChargeMultiplier: form.fares.oneWay.nightChargeMultiplier,
        extraKmRate: form.fares.rental.extraKmRate,
        extraHourRate: form.fares.rental.extraHourRate,
      };

      if (editTarget) {
        await apiClient.put(`/admin/vehicle-categories/${editTarget._id}`, payload);
        toast('Vehicle type updated successfully');
      } else {
        await apiClient.post('/admin/vehicle-categories', payload);
        toast('New vehicle type created successfully');
      }
      setDrawerOpen(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setFormError(err.response?.data?.message ?? 'Failed to save vehicle category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const isPerm = permanentDelete || deleteTarget.status === 'INACTIVE';
      await apiClient.delete(`/admin/vehicle-categories/${deleteTarget._id}${isPerm ? '?permanent=true' : ''}`);
      toast(isPerm ? 'Category permanently deleted' : 'Category deactivated');
      setDeleteTarget(null);
      setPermanentDelete(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? (permanentDelete ? 'Failed to permanently delete category' : 'Failed to deactivate category'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleReactivate = async (c: VehicleCategory) => {
    setReactivatingId(c._id);
    try {
      await apiClient.patch(`/admin/vehicle-categories/${c._id}`, { status: 'ACTIVE' });
      toast(`Category "${c.name}" reactivated`);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to reactivate category', 'error');
    } finally {
      setReactivatingId(null);
    }
  };

  const handlePurge = async () => {
    setPurging(true);
    try {
      const res = await apiClient.delete('/admin/vehicle-categories/purge-inactive');
      toast(res.data?.message ?? 'Inactive categories purged successfully');
      setPurgeOpen(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast(err.response?.data?.message ?? 'Failed to purge inactive categories', 'error');
    } finally {
      setPurging(false);
    }
  };

  // Live Fare Calculation Simulation
  const calculateSimulatedFare = () => {
    let baseFare = 0;
    let distanceFare = 0;
    let driverAllowance = 0;
    let waitingRate = 0;
    let nightMult = 1.0;

    if (simTripType === 'ROUND_TRIP') {
      const cfg = form.fares.roundTrip;
      baseFare = cfg.baseFare || 0;
      const effKm = Math.max(simDistanceKm || 0, cfg.minimumKm || 0);
      distanceFare = effKm * (cfg.ratePerKm || 0);
      driverAllowance = cfg.driverAllowance || 0;
      waitingRate = cfg.waitingChargePerMin || 0;
      nightMult = cfg.nightChargeMultiplier || 1.0;
    } else if (simTripType === 'RENTAL') {
      const cfg = form.fares.rental;
      baseFare = cfg.baseFare || 0;
      const baseKm = cfg.baseKm || 20;
      const extraKm = Math.max(0, (simDistanceKm || 0) - baseKm);
      const extraKmCharge = extraKm * (cfg.extraKmRate || 0);

      const baseHours = cfg.baseHours || 2;
      const extraHours = Math.max(0, Math.ceil((simDurationHours || 0) - baseHours));
      const extraHoursCharge = extraHours * (cfg.extraHourRate || 0);

      distanceFare = extraKmCharge + extraHoursCharge;
      waitingRate = cfg.waitingChargePerMin || 0;
      nightMult = cfg.nightChargeMultiplier || 1.0;
    } else {
      // ONE_WAY
      const cfg = form.fares.oneWay;
      baseFare = cfg.baseFare || 0;
      const effKm = Math.max(simDistanceKm || 0, cfg.minimumKm || 0);
      distanceFare = effKm * (cfg.ratePerKm || 0);
      waitingRate = cfg.waitingChargePerMin || 0;
      nightMult = cfg.nightChargeMultiplier || 1.0;
    }

    const waitingCharge = (simWaitingMins || 0) * waitingRate;
    const nightSurchargePercent = simIsNight && nightMult > 1 ? nightMult - 1.0 : (simIsNight ? 0.1 : 0);
    const nightCharge = Math.round((baseFare + distanceFare) * nightSurchargePercent * 100) / 100;
    const subtotal = baseFare + distanceFare + waitingCharge + driverAllowance + nightCharge;
    const tax = Math.round(subtotal * 0.05 * 100) / 100; // 5% GST
    const total = Math.round((subtotal + tax) * 100) / 100;

    return { baseFare, distanceFare, waitingCharge, driverAllowance, nightCharge, subtotal, tax, total };
  };

  const simResult = calculateSimulatedFare();

  const columns: ColumnsType<VehicleCategory> = [
    {
      title: 'Vehicle Type',
      render: (_: unknown, c: VehicleCategory) => {
        const iconSrc = c.icon || c.image;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: '#EEF2FF', display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexShrink: 0, overflow: 'hidden',
              border: '1px solid #E0E7FF',
            }}>
              {iconSrc ? (
                <img
                  src={iconSrc}
                  alt={c.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }}
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <CarOutlined style={{ color: '#4F46E5', fontSize: 20 }} />
              )}
            </div>
            <div>
              <div style={{ fontWeight: 600, color: '#111827' }}>{c.name}</div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                <Text code style={{ fontSize: 11 }}>{c.code}</Text>
                {c.fuelType && <Tag color="blue" style={{ fontSize: 10, margin: 0, padding: '0 4px' }}>{c.fuelType}</Tag>}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Capacity',
      render: (_: unknown, c: VehicleCategory) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Text style={{ fontSize: 13 }}>{c.seatCapacity} seats</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{c.luggageCapacity} bags</Text>
        </div>
      ),
    },
    {
      title: 'AC',
      dataIndex: 'ac',
      align: 'center',
      render: (val: boolean) => val
        ? <CheckCircleOutlined style={{ color: '#10B981', fontSize: 16 }} />
        : <CloseCircleOutlined style={{ color: '#EF4444', fontSize: 16 }} />,
    },
    {
      title: 'Fare Engine Breakdown',
      render: (_: unknown, c: VehicleCategory) => {
        const ow = c.fares?.oneWay;
        const rt = c.fares?.roundTrip;
        const rent = c.fares?.rental;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color="cyan" style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '18px' }}>One-Way</Tag>
              <Text strong style={{ fontSize: 12 }}>{INR(ow?.baseFare ?? c.baseFare)}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>+{INR(ow?.ratePerKm ?? c.ratePerKm)}/km (min {ow?.minimumKm ?? c.minimumKm}km)</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color="purple" style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '18px' }}>Round-Trip</Tag>
              <Text style={{ fontSize: 12 }}>{INR(rt?.ratePerKm ?? c.ratePerKm)}/km</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>· Min {rt?.minimumKm ?? Math.max(50, c.minimumKm * 2)}km {rt?.driverAllowance ? `· +${INR(rt.driverAllowance)} DA` : ''}</Text>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag color="orange" style={{ margin: 0, fontSize: 10, padding: '0 4px', lineHeight: '18px' }}>Rental</Tag>
              <Text style={{ fontSize: 12 }}>{INR(rent?.baseFare ?? c.baseFare * 3)}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>for {rent?.baseHours ?? 2}h/{rent?.baseKm ?? 20}km</Text>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Night Multiplier',
      align: 'center',
      render: (_: unknown, c: VehicleCategory) => {
        const mult = c.fares?.oneWay?.nightChargeMultiplier ?? c.nightChargeMultiplier ?? 1.0;
        return <Tag color={mult > 1 ? 'gold' : 'default'}>{mult}×</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (val: string) => <Tag color={val === 'ACTIVE' ? 'success' : 'default'}>{val}</Tag>,
    },
    {
      title: 'Actions',
      align: 'right',
      render: (_: unknown, c: VehicleCategory) => (
        <Space size={4}>
          <Tooltip title="Edit vehicle type">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(c)} />
          </Tooltip>
          {c.status === 'INACTIVE' ? (
            <>
              <Tooltip title="Reactivate category">
                <Button
                  icon={<UndoOutlined />}
                  size="small"
                  style={{ color: '#059669', borderColor: '#A7F3D0' }}
                  loading={reactivatingId === c._id}
                  onClick={() => handleReactivate(c)}
                />
              </Tooltip>
              <Tooltip title="Permanently delete from database">
                <Button
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                  type="primary"
                  onClick={() => { setDeleteTarget(c); setPermanentDelete(true); }}
                />
              </Tooltip>
            </>
          ) : (
            <Tooltip title="Deactivate category">
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
                onClick={() => { setDeleteTarget(c); setPermanentDelete(false); }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="page-header">
        <div>
          <Title level={4} style={{ margin: 0, color: '#111827' }}>Vehicle Types</Title>
          <Text type="secondary">{meta.total ?? categories.length} vehicle categories configured with fare engines</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Vehicle Type
        </Button>
      </div>

      <div style={{
        display: 'flex', gap: '0.75rem', alignItems: 'center',
        background: '#fff', padding: '0.75rem 1rem',
        borderRadius: 12, border: '1.5px solid #E8ECF0',
        boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
      }}>
        <Input
          prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
          placeholder="Search by name or code..."
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
          style={{ minWidth: 150 }}
          options={[
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
        />
        {statusFilter === 'INACTIVE' && categories.length > 0 && (
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => setPurgeOpen(true)}
            style={{ marginLeft: 'auto' }}
          >
            Purge All Inactive ({categories.length})
          </Button>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #E8ECF0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(15,23,42,0.05)' }}>
        <Table
          columns={columns}
          dataSource={categories}
          rowKey="_id"
          loading={isLoading}
          onChange={(p: TablePaginationConfig) => setPage(p.current ?? 1)}
          pagination={{
            current: page, pageSize: LIMIT, total: meta.total ?? categories.length,
            showTotal: (t, r) => `${r[0]}–${r[1]} of ${t} categories`,
            showSizeChanger: false,
            style: { padding: '12px 16px', margin: 0 },
          }}
          size="middle"
          locale={{
            emptyText: (
              <div style={{ padding: '3rem 1rem', textAlign: 'center' }}>
                <CarOutlined style={{ fontSize: 32, color: '#C7D2FE', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: '#374151', marginBottom: 6 }}>No vehicle types found</div>
                <div style={{ color: '#9CA3AF', fontSize: 13, marginBottom: 16 }}>Define vehicle categories with custom PNG icons and rates</div>
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="small">Add Vehicle Type</Button>
              </div>
            ),
          }}
        />
      </div>

      {/* Drawer */}
      <Drawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title={editTarget ? 'Edit Vehicle Type' : 'New Vehicle Type'}
        subtitle={editTarget ? `Editing: ${editTarget.name}` : 'Configure vehicle specs, PNG icon, and multi-tier fare engine'}
        width={620}
        footer={
          <>
            <Button onClick={() => setDrawerOpen(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {editTarget ? 'Update Vehicle Type' : 'Create Vehicle Type'}
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

          {/* Section 1: Vehicle Icon (PNG Upload to Server) */}
          <FormSection title="Vehicle Icon (PNG)">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              accept="image/png,image/*"
              onChange={handleFileUpload}
            />

            <div style={{
              display: 'flex', alignItems: 'center', gap: '1.25rem',
              padding: '1rem', borderRadius: 10,
              background: '#F8FAFC', border: '1.5px dashed #CBD5E1',
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 12,
                background: '#EEF2FF', display: 'flex', alignItems: 'center',
                justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
                border: '1px solid #C7D2FE', position: 'relative',
              }}>
                {form.icon ? (
                  <img
                    src={form.icon}
                    alt="Vehicle icon preview"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }}
                  />
                ) : (
                  <CarOutlined style={{ fontSize: 28, color: '#6366F1' }} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#1E293B', marginBottom: 2 }}>
                  {form.icon ? 'Icon uploaded & stored on server' : 'Upload PNG Icon'}
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8 }}>
                  Transparent PNG recommended. Stored in server storage. Max 5MB.
                </div>
                <Space size={8}>
                  <Button
                    size="small"
                    icon={<CloudUploadOutlined />}
                    loading={uploadingIcon}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {form.icon ? 'Replace Icon' : 'Select PNG Image'}
                  </Button>
                  {form.icon && (
                    <Button
                      size="small"
                      danger
                      onClick={() => setForm(f => ({ ...f, icon: '' }))}
                    >
                      Remove
                    </Button>
                  )}
                </Space>
              </div>
            </div>
          </FormSection>

          {/* Section 2: Basic Info & Specs */}
          <FormSection title="Basic Details & Specs">
            <FormGrid cols={2}>
              <Field label="Category Name" required>
                <input
                  className="input-field"
                  placeholder="e.g. Sedan AC"
                  value={form.name}
                  onChange={e => sf('name', e.target.value)}
                />
              </Field>
              <Field label="Code" required hint="Unique uppercase identifier">
                <input
                  className="input-field"
                  placeholder="SEDAN_AC"
                  value={form.code}
                  onChange={e => sf('code', e.target.value.toUpperCase())}
                  style={{ fontFamily: 'monospace' }}
                />
              </Field>
            </FormGrid>
            <Field label="Description">
              <textarea
                className="input-field"
                rows={2}
                placeholder="Description of comfort, suitable passengers, etc..."
                value={form.description}
                onChange={e => sf('description', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </Field>

            <FormGrid cols={2}>
              <Field label="Seat Capacity">
                <InputNumber min={1} max={60} value={form.seatCapacity} onChange={v => sf('seatCapacity', v ?? 4)} style={{ width: '100%' }} />
              </Field>
              <Field label="Luggage (bags)">
                <InputNumber min={0} value={form.luggageCapacity} onChange={v => sf('luggageCapacity', v ?? 2)} style={{ width: '100%' }} />
              </Field>
              <Field label="Fuel Type">
                <select className="input-field" value={form.fuelType} onChange={e => sf('fuelType', e.target.value)}>
                  {FUEL_TYPES.map(f => <option key={f}>{f}</option>)}
                </select>
              </Field>
              <Field label="Sort Order">
                <InputNumber min={0} value={form.sortOrder} onChange={v => sf('sortOrder', v ?? 0)} style={{ width: '100%' }} />
              </Field>
            </FormGrid>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <Switch checked={form.ac} onChange={v => sf('ac', v)} size="small" />
              <span style={{ fontSize: 14, color: '#4B5563', fontWeight: 500 }}>Air Conditioned (AC)</span>
            </div>
          </FormSection>

          {/* Section 3: Multi-Tier Fare Engine */}
          <FormSection title="Multi-Tier Fare Engine Configuration">
            <div style={{ marginBottom: 12 }}>
              <Segmented
                block
                value={activeFareTab}
                onChange={val => setActiveFareTab(val as typeof activeFareTab)}
                options={[
                  { label: '🚗 One-Way', value: 'ONE_WAY' },
                  { label: '🔄 Round-Trip', value: 'ROUND_TRIP' },
                  { label: '⏱️ Local Rental', value: 'RENTAL' },
                ]}
              />
            </div>

            {/* TAB 1: ONE WAY */}
            {activeFareTab === 'ONE_WAY' && (
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <ThunderboltOutlined style={{ color: '#0EA5E9' }} />
                  <span style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>One-Way (Point-to-Point) Fare Rules</span>
                </div>
                <FormGrid cols={2}>
                  <Field label="Base Fare" required hint="Initial starting charge">
                    <InputNumber
                      min={0} prefix="₹" style={{ width: '100%' }}
                      value={form.fares.oneWay.baseFare}
                      onChange={v => setFareField('oneWay', 'baseFare', v ?? 0)}
                    />
                  </Field>
                  <Field label="Rate per km" required hint="Per km after minimum distance">
                    <InputNumber
                      min={0} step={0.5} prefix="₹" style={{ width: '100%' }}
                      value={form.fares.oneWay.ratePerKm}
                      onChange={v => setFareField('oneWay', 'ratePerKm', v ?? 0)}
                    />
                  </Field>
                  <Field label="Minimum Distance" hint="Minimum billed distance">
                    <InputNumber
                      min={0} suffix="km" style={{ width: '100%' }}
                      value={form.fares.oneWay.minimumKm}
                      onChange={v => setFareField('oneWay', 'minimumKm', v ?? 0)}
                    />
                  </Field>
                  <Field label="Waiting Charge" hint="Per minute rate">
                    <InputNumber
                      min={0} prefix="₹" suffix="/min" style={{ width: '100%' }}
                      value={form.fares.oneWay.waitingChargePerMin}
                      onChange={v => setFareField('oneWay', 'waitingChargePerMin', v ?? 0)}
                    />
                  </Field>
                  <Field label="Night Multiplier" hint="e.g. 1.25 = +25% night surcharge">
                    <InputNumber
                      min={1} max={3} step={0.05} style={{ width: '100%' }}
                      value={form.fares.oneWay.nightChargeMultiplier}
                      onChange={v => setFareField('oneWay', 'nightChargeMultiplier', v ?? 1)}
                    />
                  </Field>
                </FormGrid>
              </div>
            )}

            {/* TAB 2: ROUND TRIP */}
            {activeFareTab === 'ROUND_TRIP' && (
              <div style={{ background: '#FAF5FF', padding: '1rem', borderRadius: 10, border: '1px solid #F3E8FF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <SyncOutlined style={{ color: '#9333EA' }} />
                  <span style={{ fontWeight: 600, color: '#581C87', fontSize: 13 }}>Round-Trip Fare Rules</span>
                </div>
                <FormGrid cols={2}>
                  <Field label="Base Fare" hint="Starting charge for round trip">
                    <InputNumber
                      min={0} prefix="₹" style={{ width: '100%' }}
                      value={form.fares.roundTrip.baseFare}
                      onChange={v => setFareField('roundTrip', 'baseFare', v ?? 0)}
                    />
                  </Field>
                  <Field label="Rate per km" required hint="Total return distance rate">
                    <InputNumber
                      min={0} step={0.5} prefix="₹" style={{ width: '100%' }}
                      value={form.fares.roundTrip.ratePerKm}
                      onChange={v => setFareField('roundTrip', 'ratePerKm', v ?? 0)}
                    />
                  </Field>
                  <Field label="Minimum Distance" hint="e.g. 100km minimum for round trips">
                    <InputNumber
                      min={0} suffix="km" style={{ width: '100%' }}
                      value={form.fares.roundTrip.minimumKm}
                      onChange={v => setFareField('roundTrip', 'minimumKm', v ?? 0)}
                    />
                  </Field>
                  <Field label="Driver Allowance / Day" hint="Daily allowance / bata">
                    <InputNumber
                      min={0} prefix="₹" style={{ width: '100%' }}
                      value={form.fares.roundTrip.driverAllowance}
                      onChange={v => setFareField('roundTrip', 'driverAllowance', v ?? 0)}
                    />
                  </Field>
                  <Field label="Waiting Charge" hint="Per minute rate">
                    <InputNumber
                      min={0} prefix="₹" suffix="/min" style={{ width: '100%' }}
                      value={form.fares.roundTrip.waitingChargePerMin}
                      onChange={v => setFareField('roundTrip', 'waitingChargePerMin', v ?? 0)}
                    />
                  </Field>
                  <Field label="Night Multiplier" hint="e.g. 1.25 = +25% night surcharge">
                    <InputNumber
                      min={1} max={3} step={0.05} style={{ width: '100%' }}
                      value={form.fares.roundTrip.nightChargeMultiplier}
                      onChange={v => setFareField('roundTrip', 'nightChargeMultiplier', v ?? 1)}
                    />
                  </Field>
                </FormGrid>
              </div>
            )}

            {/* TAB 3: LOCAL RENTALS */}
            {activeFareTab === 'RENTAL' && (
              <div style={{ background: '#FFFBEB', padding: '1rem', borderRadius: 10, border: '1px solid #FEF3C7' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <ClockCircleOutlined style={{ color: '#D97706' }} />
                  <span style={{ fontWeight: 600, color: '#78350F', fontSize: 13 }}>Local Rental (Hourly Package) Rules</span>
                </div>
                <FormGrid cols={2}>
                  <Field label="Package Base Fare" required hint="Initial package price">
                    <InputNumber
                      min={0} prefix="₹" style={{ width: '100%' }}
                      value={form.fares.rental.baseFare}
                      onChange={v => setFareField('rental', 'baseFare', v ?? 0)}
                    />
                  </Field>
                  <Field label="Included Package Hours" hint="Base package duration">
                    <InputNumber
                      min={1} suffix="hrs" style={{ width: '100%' }}
                      value={form.fares.rental.baseHours}
                      onChange={v => setFareField('rental', 'baseHours', v ?? 2)}
                    />
                  </Field>
                  <Field label="Included Package Distance" hint="Base package distance">
                    <InputNumber
                      min={0} suffix="km" style={{ width: '100%' }}
                      value={form.fares.rental.baseKm}
                      onChange={v => setFareField('rental', 'baseKm', v ?? 20)}
                    />
                  </Field>
                  <Field label="Extra Rate / km" hint="Beyond included package km">
                    <InputNumber
                      min={0} prefix="₹" suffix="/km" style={{ width: '100%' }}
                      value={form.fares.rental.extraKmRate}
                      onChange={v => setFareField('rental', 'extraKmRate', v ?? 0)}
                    />
                  </Field>
                  <Field label="Extra Rate / hour" hint="Beyond included package hours">
                    <InputNumber
                      min={0} prefix="₹" suffix="/hr" style={{ width: '100%' }}
                      value={form.fares.rental.extraHourRate}
                      onChange={v => setFareField('rental', 'extraHourRate', v ?? 0)}
                    />
                  </Field>
                  <Field label="Night Multiplier" hint="e.g. 1.25 = +25% surcharge">
                    <InputNumber
                      min={1} max={3} step={0.05} style={{ width: '100%' }}
                      value={form.fares.rental.nightChargeMultiplier}
                      onChange={v => setFareField('rental', 'nightChargeMultiplier', v ?? 1)}
                    />
                  </Field>
                </FormGrid>
              </div>
            )}
          </FormSection>

          {/* Section 4: Live Fare Engine Simulator */}
          <Card
            size="small"
            style={{ borderRadius: 12, background: '#F0FDF4', border: '1.5px solid #BBF7D0' }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534' }}>
                <CalculatorOutlined />
                <span>Live Fare Engine Simulator</span>
                <Badge count="Real-time" style={{ backgroundColor: '#22C55E' }} />
              </div>
            }
          >
            <div style={{ fontSize: 12, color: '#15803D', marginBottom: 10 }}>
              Verify and test how the fare engine calculates fares with your configured numbers:
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Trip Mode</label>
                <Select
                  size="small"
                  value={simTripType}
                  onChange={v => setSimTripType(v)}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'ONE_WAY', label: 'One-Way' },
                    { value: 'ROUND_TRIP', label: 'Round-Trip' },
                    { value: 'RENTAL', label: 'Rental' },
                  ]}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Distance (km)</label>
                <InputNumber
                  size="small" min={1} value={simDistanceKm}
                  onChange={v => setSimDistanceKm(v ?? 10)}
                  style={{ width: '100%' }}
                />
              </div>

              {simTripType === 'RENTAL' && (
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Duration (hours)</label>
                  <InputNumber
                    size="small" min={1} value={simDurationHours}
                    onChange={v => setSimDurationHours(v ?? 2)}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Waiting (mins)</label>
                <InputNumber
                  size="small" min={0} value={simWaitingMins}
                  onChange={v => setSimWaitingMins(v ?? 0)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Night Ride?</label>
                <Switch size="small" checked={simIsNight} onChange={v => setSimIsNight(v)} />
              </div>
            </div>

            <Divider style={{ margin: '8px 0' }} />

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
              gap: 8, background: '#fff', padding: '0.625rem 0.75rem',
              borderRadius: 8, border: '1px solid #DCFCE7',
            }}>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Base Fare</Text>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{INR(simResult.baseFare)}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>Distance Fare</Text>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{INR(simResult.distanceFare)}</div>
              </div>
              {simResult.waitingCharge > 0 && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Waiting</Text>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{INR(simResult.waitingCharge)}</div>
                </div>
              )}
              {simResult.driverAllowance > 0 && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>DA Allowance</Text>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{INR(simResult.driverAllowance)}</div>
                </div>
              )}
              {simResult.nightCharge > 0 && (
                <div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Night Surcharge</Text>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#D97706' }}>{INR(simResult.nightCharge)}</div>
                </div>
              )}
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>GST (5%)</Text>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#6B7280' }}>{INR(simResult.tax)}</div>
              </div>
              <div style={{ gridColumn: 'span 2', textAlign: 'right' }}>
                <Text type="secondary" style={{ fontSize: 11 }}>Calculated Total</Text>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#16A34A' }}>{INR(simResult.total)}</div>
              </div>
            </div>
          </Card>
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!deleteTarget} danger
        title={permanentDelete || deleteTarget?.status === 'INACTIVE' ? 'Permanently Delete Category' : 'Deactivate Category'}
        message={
          permanentDelete || deleteTarget?.status === 'INACTIVE'
            ? `Are you sure you want to permanently delete category "${deleteTarget?.name}" (${deleteTarget?.code})? This will completely remove it from the database and cannot be undone.`
            : `Deactivate "${deleteTarget?.name}"? It will be marked as INACTIVE.`
        }
        confirmLabel={permanentDelete || deleteTarget?.status === 'INACTIVE' ? 'Delete Permanently' : 'Deactivate'}
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
        title="Purge All Inactive Categories"
        message="Permanently delete all inactive vehicle categories from the database? Categories with linked vehicles will be safely preserved."
        confirmLabel="Purge Inactive"
        loading={purging}
        onConfirm={handlePurge}
        onCancel={() => setPurgeOpen(false)}
      />
    </div>
  );
}
