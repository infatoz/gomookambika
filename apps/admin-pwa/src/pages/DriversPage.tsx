import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table, Button, Tag, Space, Input, Select, Typography,
  Tooltip, Avatar, Checkbox,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, FilterOutlined, UserOutlined,
  StarFilled, PoweroffOutlined, UndoOutlined,
  CarOutlined, PhoneOutlined, EnvironmentOutlined,
  ReloadOutlined, CloseCircleOutlined, MessageOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';
import { Drawer } from '@/components/Drawer';
import { Field, FormGrid, FormSection } from '@/components/Modal';

const { Title, Text } = Typography;

const STATUS_TAG: Record<string, string> = {
  AVAILABLE: 'success',
  IN_QUEUE: 'processing',
  ON_TRIP: 'purple',
  TRIP_ACCEPTED: 'purple',
  TRIP_OFFERED: 'warning',
  SUSPENDED: 'error',
  OFFLINE: 'default',
  INACTIVE: 'default',
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  IN_QUEUE: 'In Queue',
  ON_TRIP: 'On Trip',
  TRIP_ACCEPTED: 'Trip Accepted',
  TRIP_OFFERED: 'Trip Offered',
  SUSPENDED: 'Suspended',
  OFFLINE: 'Offline',
  INACTIVE: 'Inactive',
};

interface AssignedVehicle {
  _id: string;
  registrationNumber: string;
  brand: string;
  vehicleModel: string;
  category?: string;
}

interface ActiveQueueEntry {
  _id: string;
  taxiStandId: string;
  position: number;
  status: string;
  joinedAt?: string;
  taxiStand?: { _id: string; name: string; code?: string };
}

interface ActiveTrip {
  _id: string;
  bookingNumber?: string;
  status: string;
  pickupLocation?: string;
  dropLocation?: string;
}

interface Driver {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  driverCode: string;
  status: string;
  rating?: number;
  ratingCount?: number;
  totalTrips?: number;
  totalEarnings?: number;
  joiningDate?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  address?: { line1?: string; line2?: string; city?: string; state?: string; pincode?: string };
  assignedVehicle?: AssignedVehicle;
  activeQueueEntryId?: ActiveQueueEntry;
  activeTripId?: ActiveTrip;
  upiId?: string;
  upiBeneficiaryName?: string;
}

interface TaxiStandOption {
  _id: string;
  name: string;
  code: string;
}

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  status: 'AVAILABLE',
  licenseNumber: '',
  licenseExpiry: '',
  joiningDate: '',
  upiId: '',
  upiBeneficiaryName: '',
  assignedVehicleId: '',
  address: { line1: '', line2: '', city: 'Kollur', state: 'Karnataka', pincode: '576220' },
};

export function DriversPage() {
  const qc = useQueryClient();

  // Filter States - Default statusFilter is '' so ALL drivers are loaded on initial page load
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [standFilter, setStandFilter] = useState('');
  const [sortKey, setSortKey] = useState('createdAt:desc');

  // Form / Action States
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Driver | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [permanentDelete, setPermanentDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const [sortBy, sortOrder] = sortKey.split(':');

  // Query Drivers
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-drivers', page, pageSize, search, statusFilter, vehicleFilter, standFilter, sortBy, sortOrder],
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(pageSize) });
      if (search.trim()) p.set('search', search.trim());
      if (statusFilter)  p.set('status', statusFilter);
      if (vehicleFilter) p.set('vehicleAssigned', vehicleFilter);
      if (standFilter)   p.set('taxiStandId', standFilter);
      if (sortBy)        p.set('sortBy', sortBy);
      if (sortOrder)     p.set('sortOrder', sortOrder);
      const res = await apiClient.get(`/admin/drivers?${p}`);
      return res.data;
    },
  });

  // Query Taxi Stands for filtering
  const { data: standsData } = useQuery<TaxiStandOption[]>({
    queryKey: ['admin-taxi-stands-filter-list'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/taxi-stands');
      return res.data?.data ?? [];
    },
  });

  // Query Vehicles for vehicle assignment in driver form
  const { data: vehiclesData } = useQuery({
    queryKey: ['admin-vehicles-for-driver-assign'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/vehicles?limit=500');
      return res.data?.data ?? [];
    },
  });

  const drivers: Driver[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, totalPages: 1 };
  const stats = data?.stats ?? {
    TOTAL: 0,
    AVAILABLE: 0,
    IN_QUEUE: 0,
    ON_TRIP: 0,
    OFFLINE: 0,
    SUSPENDED: 0,
  };
  const stands = standsData ?? [];
  const allVehicles: any[] = (vehiclesData as any) ?? [];

  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['admin-drivers'] });
    qc.invalidateQueries({ queryKey: ['admin-vehicles-for-driver-assign'] });
  }, [qc]);

  const hasActiveFilters = Boolean(
    search.trim() ||
    statusFilter ||
    vehicleFilter ||
    standFilter ||
    sortKey !== 'createdAt:desc'
  );

  const resetAllFilters = () => {
    setSearch('');
    setStatusFilter('');
    setVehicleFilter('');
    setStandFilter('');
    setSortKey('createdAt:desc');
    setPage(1);
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm({
      ...EMPTY_FORM,
      joiningDate: new Date().toISOString().substring(0, 10),
      licenseExpiry: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
    });
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (d: Driver) => {
    setEditTarget(d);
    setForm({
      name: d.name || '',
      phone: d.phone || '',
      email: d.email ?? '',
      status: d.status || 'AVAILABLE',
      licenseNumber: d.licenseNumber ?? '',
      licenseExpiry: d.licenseExpiry ? d.licenseExpiry.substring(0, 10) : '',
      joiningDate: d.joiningDate ? d.joiningDate.substring(0, 10) : '',
      upiId: d.upiId ?? '',
      upiBeneficiaryName: d.upiBeneficiaryName ?? '',
      assignedVehicleId: d.assignedVehicle?._id ?? '',
      address: {
        line1: d.address?.line1 ?? '',
        line2: (d.address as any)?.line2 ?? '',
        city: d.address?.city ?? 'Kollur',
        state: d.address?.state ?? 'Karnataka',
        pincode: (d.address as any)?.pincode ?? '576220',
      },
    });
    setFormError('');
    setShowForm(true);
  };

  const setF = (patch: Partial<typeof EMPTY_FORM>) => setForm(f => ({ ...f, ...patch }));
  const setAddr = (patch: Partial<typeof EMPTY_FORM.address>) => setForm(f => ({ ...f, address: { ...f.address, ...patch } }));

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Full name is required'); return; }
    if (!form.phone.trim()) { setFormError('Phone number is required'); return; }
    if (!form.licenseNumber.trim()) { setFormError('License number is required'); return; }

    setSaving(true);
    setFormError('');
    try {
      const safeAddress = {
        line1: form.address.line1.trim() || 'Kollur',
        line2: form.address.line2?.trim() || '',
        city: form.address.city.trim() || 'Kollur',
        state: form.address.state.trim() || 'Karnataka',
        pincode: form.address.pincode?.trim() || '576220',
        country: 'India',
      };

      const payload: Record<string, any> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        status: form.status,
        licenseNumber: form.licenseNumber.trim(),
        upiId: form.upiId.trim() || undefined,
        upiBeneficiaryName: form.upiBeneficiaryName.trim() || undefined,
        assignedVehicleId: form.assignedVehicleId || '',
        address: safeAddress,
      };

      if (form.licenseExpiry) {
        payload.licenseExpiry = new Date(form.licenseExpiry).toISOString();
      }
      if (form.joiningDate) {
        payload.joiningDate = new Date(form.joiningDate).toISOString();
      }

      if (editTarget) {
        await apiClient.put(`/admin/drivers/${editTarget._id}`, payload);
        toast('Driver updated successfully');
      } else {
        if (!payload.licenseExpiry) {
          payload.licenseExpiry = new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000).toISOString();
        }
        if (!payload.joiningDate) {
          payload.joiningDate = new Date().toISOString();
        }
        await apiClient.post('/admin/drivers', payload);
        toast('Driver created successfully');
      }
      setShowForm(false);
      refresh();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string; error?: { details?: Record<string, string> } } } };
      const details = err.response?.data?.error?.details;
      setFormError(details ? Object.values(details).join(', ') : (err.response?.data?.message ?? 'Failed to save. Please try again.'));
    } finally {
      setSaving(false);
    }
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
    } finally {
      setDeleting(false);
    }
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
    } finally {
      setReactivatingId(null);
    }
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
    } finally {
      setPurging(false);
    }
  };

  const handleToggleStatus = async (d: Driver) => {
    const newStatus = d.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    try {
      await apiClient.patch(`/admin/drivers/${d._id}/status`, { status: newStatus });
      toast(`Driver status changed to ${newStatus}`);
      refresh();
    } catch {
      toast('Status update failed', 'error');
    }
  };

  // Avatar dynamic colour generator
  const avatarColor = (name: string) => {
    const colors = ['#4F46E5', '#0284C7', '#7C3AED', '#059669', '#D97706', '#E11D48', '#2563EB', '#475569'];
    return colors[(name || 'D').charCodeAt(0) % colors.length];
  };

  // Format phone for direct WhatsApp & Tel
  const formatPhoneClean = (phone: string) => phone.replace(/\D/g, '');

  const columns: ColumnsType<Driver> = [
    {
      title: 'Driver',
      key: 'driver',
      width: 250,
      render: (_: unknown, d: Driver) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Avatar
            style={{
              background: avatarColor(d.name),
              fontWeight: 700,
              fontSize: 12,
              flexShrink: 0,
              boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
            }}
            size={38}
          >
            {(d.name || 'D')
              .split(' ')
              .map(n => n[0])
              .slice(0, 2)
              .join('')
              .toUpperCase()}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 600, color: '#111827', fontSize: 14, lineHeight: 1.2 }}>
                {d.name}
              </span>
              <Tag color="geekblue" style={{ margin: 0, fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                {d.driverCode}
              </Tag>
            </div>
            <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              {d.email ? (
                <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
                  {d.email}
                </Text>
              ) : d.licenseNumber ? (
                <Text type="secondary" style={{ fontSize: 11, fontFamily: 'monospace' }}>
                  DL: {d.licenseNumber}
                </Text>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>—</Text>
              )}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Contact',
      key: 'phone',
      width: 170,
      render: (_: unknown, d: Driver) => {
        const cleanPhone = formatPhoneClean(d.phone);
        const waNumber = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        return (
          <div>
            <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 600, color: '#1E293B' }}>
              {d.phone}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Tooltip title="Call Driver">
                <a
                  href={`tel:${d.phone}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 11,
                    color: '#4F46E5',
                    background: '#EEF2FF',
                    padding: '1px 6px',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  <PhoneOutlined style={{ fontSize: 10 }} /> Call
                </a>
              </Tooltip>
              <Tooltip title="Chat on WhatsApp">
                <a
                  href={`https://wa.me/${waNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    fontSize: 11,
                    color: '#059669',
                    background: '#ECFDF5',
                    padding: '1px 6px',
                    borderRadius: 4,
                    textDecoration: 'none',
                    fontWeight: 500,
                  }}
                >
                  <MessageOutlined style={{ fontSize: 10 }} /> WhatsApp
                </a>
              </Tooltip>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Assigned Vehicle',
      key: 'vehicle',
      width: 200,
      render: (_: unknown, d: Driver) => {
        if (!d.assignedVehicle) {
          return (
            <Tag color="warning" style={{ borderRadius: 6, fontSize: 11, padding: '2px 8px' }}>
              ⚠️ Unassigned
            </Tag>
          );
        }
        return (
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#F8FAFC',
                border: '1.5px solid #CBD5E1',
                borderRadius: 5,
                padding: '2px 7px',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.04em',
                color: '#0F172A',
                fontFamily: 'monospace',
              }}
            >
              <CarOutlined style={{ color: '#4F46E5' }} />
              {d.assignedVehicle.registrationNumber}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
              {d.assignedVehicle.brand} {d.assignedVehicle.vehicleModel}
              {d.assignedVehicle.category && (
                <Tag color="default" style={{ fontSize: 10, padding: '0 4px', margin: '0 0 0 4px' }}>
                  {d.assignedVehicle.category}
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: 'Stand / Queue',
      key: 'queue',
      width: 180,
      render: (_: unknown, d: Driver) => {
        if (d.activeQueueEntryId) {
          const standName = d.activeQueueEntryId.taxiStand?.name || 'Taxi Stand';
          const pos = d.activeQueueEntryId.position;
          return (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: 13, color: '#1E293B' }}>
                <EnvironmentOutlined style={{ color: '#0284C7' }} />
                <span>{standName}</span>
              </div>
              <div style={{ marginTop: 3 }}>
                <Tag color="processing" style={{ fontSize: 11, fontWeight: 600, borderRadius: 4 }}>
                  Position #{pos ?? 1} in Queue
                </Tag>
              </div>
            </div>
          );
        }

        if (d.activeTripId) {
          return (
            <div>
              <Tag color="purple" style={{ fontSize: 11, fontWeight: 600 }}>
                🚕 On Trip {d.activeTripId.bookingNumber ? `(#${d.activeTripId.bookingNumber})` : ''}
              </Tag>
              {d.activeTripId.pickupLocation && (
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  To: {d.activeTripId.dropLocation || 'En Route'}
                </div>
              )}
            </div>
          );
        }

        return <Text type="secondary" style={{ fontSize: 12 }}>Off Stand</Text>;
      },
    },
    {
      title: 'Performance',
      key: 'performance',
      width: 170,
      render: (_: unknown, d: Driver) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Space size={3}>
              <StarFilled style={{ color: '#F59E0B', fontSize: 12 }} />
              <Text strong style={{ fontSize: 13 }}>
                {d.rating ? d.rating.toFixed(1) : '5.0'}
              </Text>
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({d.ratingCount ?? 0})
              </Text>
            </Space>
            <span style={{ color: '#D1D5DB' }}>•</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
              {d.totalTrips ?? 0} trips
            </span>
          </div>
          <div style={{ marginTop: 2, fontSize: 12, color: '#059669', fontWeight: 600 }}>
            ₹{(d.totalEarnings ?? 0).toLocaleString('en-IN')} earned
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (val: string) => (
        <Tag
          color={STATUS_TAG[val] ?? 'default'}
          style={{
            fontWeight: 600,
            fontSize: 12,
            padding: '2px 8px',
            borderRadius: 6,
          }}
        >
          ● {STATUS_LABELS[val] ?? val}
        </Tag>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'joiningDate',
      key: 'joiningDate',
      width: 120,
      render: (val: string) => val ? (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {new Date(val).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
        </Text>
      ) : (
        <Text type="secondary">—</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'right',
      width: 130,
      render: (_: unknown, d: Driver) => (
        <Space size={4}>
          <Tooltip title="Edit Driver Details">
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(d)} />
          </Tooltip>

          {d.status === 'INACTIVE' || d.status === 'SUSPENDED' ? (
            <>
              <Tooltip title="Reactivate Driver">
                <Button
                  icon={<UndoOutlined />}
                  size="small"
                  style={{ color: '#059669', borderColor: '#A7F3D0', background: '#ECFDF5' }}
                  loading={reactivatingId === d._id}
                  onClick={() => handleReactivate(d)}
                />
              </Tooltip>
              <Tooltip title="Permanently Delete Driver">
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
              <Tooltip title={d.status === 'AVAILABLE' ? 'Toggle to Offline' : 'Toggle to Available'}>
                <Button
                  icon={<PoweroffOutlined />}
                  size="small"
                  style={{
                    color: d.status === 'AVAILABLE' ? '#059669' : '#6B7280',
                    borderColor: d.status === 'AVAILABLE' ? '#A7F3D0' : '#E5E7EB',
                    background: d.status === 'AVAILABLE' ? '#ECFDF5' : '#F9FAFB',
                  }}
                  onClick={() => handleToggleStatus(d)}
                />
              </Tooltip>
              <Tooltip title="Deactivate Driver">
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

  // Quick stat card definitions
  const statCards = [
    {
      key: '',
      label: 'All Drivers',
      count: stats.TOTAL ?? meta.total ?? 0,
      accent: '#4F46E5',
      bg: '#EEF2FF',
      icon: UserOutlined,
    },
    {
      key: 'AVAILABLE',
      label: 'Available',
      count: stats.AVAILABLE ?? 0,
      accent: '#10B981',
      bg: '#ECFDF5',
      icon: PoweroffOutlined,
    },
    {
      key: 'IN_QUEUE',
      label: 'In Stand Queue',
      count: stats.IN_QUEUE ?? 0,
      accent: '#0284C7',
      bg: '#F0F9FF',
      icon: EnvironmentOutlined,
    },
    {
      key: 'ON_TRIP',
      label: 'On Active Trip',
      count: stats.ON_TRIP ?? 0,
      accent: '#8B5CF6',
      bg: '#F5F3FF',
      icon: CarOutlined,
    },
    {
      key: 'OFFLINE',
      label: 'Offline',
      count: stats.OFFLINE ?? 0,
      accent: '#6B7280',
      bg: '#F3F4F6',
      icon: PoweroffOutlined,
    },
    {
      key: 'SUSPENDED',
      label: 'Suspended / Inactive',
      count: stats.SUSPENDED ?? 0,
      accent: '#EF4444',
      bg: '#FEF2F2',
      icon: CloseCircleOutlined,
    },
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Header Section */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#111827', fontWeight: 700 }}>
            Drivers Directory
          </Title>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Manage association drivers, assign vehicles, monitor queue status & live availability · {meta.total ?? 0} drivers total
          </Text>
        </div>
        <Space size={8}>
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={refresh}
            title="Refresh driver list"
          >
            Refresh
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Driver
          </Button>
        </Space>
      </div>

      {/* Top Stat Cards Bar (Interactive Quick Status Filters) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '0.75rem',
        }}
      >
        {statCards.map(sc => {
          const isSelected = statusFilter === sc.key;
          return (
            <div
              key={sc.key || 'ALL'}
              onClick={() => {
                setStatusFilter(sc.key);
                setPage(1);
              }}
              style={{
                background: '#FFFFFF',
                borderRadius: 12,
                padding: '0.875rem 1rem',
                border: isSelected ? `2px solid ${sc.accent}` : '1.5px solid #E8ECF0',
                boxShadow: isSelected
                  ? `0 4px 14px ${sc.accent}25`
                  : '0 1px 3px rgba(15,23,42,0.05)',
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: isSelected ? sc.accent : '#64748B' }}>
                  {sc.label}
                </span>
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    background: sc.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <sc.icon style={{ fontSize: 13, color: sc.accent }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 800,
                    color: isSelected ? sc.accent : '#0F172A',
                    lineHeight: 1,
                  }}
                >
                  {sc.count}
                </span>
                {isSelected && (
                  <Tag color={sc.accent} style={{ fontSize: 10, margin: 0, padding: '0 4px', lineHeight: '16px' }}>
                    Active View
                  </Tag>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Advanced Filter Suite */}
      <div
        style={{
          background: '#FFFFFF',
          padding: '1rem',
          borderRadius: 12,
          border: '1.5px solid #E8ECF0',
          boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          {/* Search Input */}
          <Input
            prefix={<SearchOutlined style={{ color: '#9CA3AF' }} />}
            placeholder="Search name, phone, code, license..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            allowClear
            style={{ flex: '1 1 220px', minWidth: 200 }}
          />

          {/* Status Dropdown */}
          <Select
            value={statusFilter || undefined}
            onChange={v => { setStatusFilter(v ?? ''); setPage(1); }}
            placeholder="Status: All Statuses"
            allowClear
            style={{ width: 175 }}
            suffixIcon={<FilterOutlined />}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'AVAILABLE', label: '🟢 Available' },
              { value: 'IN_QUEUE', label: '🔵 In Queue' },
              { value: 'ON_TRIP', label: '🟣 On Trip' },
              { value: 'OFFLINE', label: '⚪ Offline' },
              { value: 'SUSPENDED', label: '🔴 Suspended' },
            ]}
          />

          {/* Vehicle Assignment Dropdown */}
          <Select
            value={vehicleFilter || undefined}
            onChange={v => { setVehicleFilter(v ?? ''); setPage(1); }}
            placeholder="Vehicle: All"
            allowClear
            style={{ width: 190 }}
            suffixIcon={<CarOutlined />}
            options={[
              { value: '', label: 'Vehicle: All Drivers' },
              { value: 'ASSIGNED', label: '🚗 Assigned Cab' },
              { value: 'UNASSIGNED', label: '⚠️ Unassigned (No Cab)' },
            ]}
          />

          {/* Stand / Queue Location Dropdown */}
          <Select
            value={standFilter || undefined}
            onChange={v => { setStandFilter(v ?? ''); setPage(1); }}
            placeholder="Location: All Stands"
            allowClear
            style={{ width: 210 }}
            suffixIcon={<EnvironmentOutlined />}
            options={[
              { value: '', label: 'Location: All Stands' },
              { value: 'IN_QUEUE', label: '🎯 In Any Queue' },
              { value: 'NOT_IN_QUEUE', label: '🚫 Not in Queue' },
              ...stands.map(s => ({
                value: s._id,
                label: `📍 ${s.name}`,
              })),
            ]}
          />

          {/* Sort By Dropdown */}
          <Select
            value={sortKey}
            onChange={v => { setSortKey(v); setPage(1); }}
            style={{ width: 195 }}
            options={[
              { value: 'createdAt:desc', label: '🕒 Newest Joined' },
              { value: 'createdAt:asc', label: '🕒 Oldest Joined' },
              { value: 'totalTrips:desc', label: '🚖 Most Trips' },
              { value: 'rating:desc', label: '⭐ Highest Rating' },
              { value: 'totalEarnings:desc', label: '💰 Highest Earnings' },
              { value: 'name:asc', label: '🔤 Name (A → Z)' },
            ]}
          />

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button
              icon={<CloseCircleOutlined />}
              onClick={resetAllFilters}
              style={{ color: '#64748B' }}
            >
              Reset Filters
            </Button>
          )}

          {/* Purge Inactive Button */}
          {(statusFilter === 'INACTIVE' || statusFilter === 'SUSPENDED') && drivers.length > 0 && (
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={() => setPurgeOpen(true)}
              style={{ marginLeft: 'auto' }}
            >
              Purge Inactive ({drivers.length})
            </Button>
          )}
        </div>

        {/* Active Filter Pills Bar */}
        {hasActiveFilters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingTop: 4, borderTop: '1px solid #F1F5F9' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748B' }}>Active Filters:</span>
            {search && (
              <Tag closable onClose={() => setSearch('')} color="blue">
                Search: "{search}"
              </Tag>
            )}
            {statusFilter && (
              <Tag closable onClose={() => setStatusFilter('')} color="green">
                Status: {STATUS_LABELS[statusFilter] || statusFilter}
              </Tag>
            )}
            {vehicleFilter && (
              <Tag closable onClose={() => setVehicleFilter('')} color="purple">
                Vehicle: {vehicleFilter === 'ASSIGNED' ? 'Assigned Cab' : 'Unassigned'}
              </Tag>
            )}
            {standFilter && (
              <Tag closable onClose={() => setStandFilter('')} color="cyan">
                Stand: {standFilter === 'IN_QUEUE' ? 'In Queue' : standFilter === 'NOT_IN_QUEUE' ? 'Off Stand' : stands.find(s => s._id === standFilter)?.name || standFilter}
              </Tag>
            )}
            {sortKey !== 'createdAt:desc' && (
              <Tag closable onClose={() => setSortKey('createdAt:desc')} color="default">
                Sort: {sortKey}
              </Tag>
            )}
            <Button type="link" size="small" onClick={resetAllFilters} style={{ padding: 0, fontSize: 12 }}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Drivers Data Table */}
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1.5px solid #E8ECF0',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
        }}
      >
        <Table
          columns={columns}
          dataSource={drivers}
          rowKey="_id"
          loading={isLoading}
          scroll={{ x: 1080 }}
          onChange={(p: TablePaginationConfig) => {
            setPage(p.current ?? 1);
            if (p.pageSize && p.pageSize !== pageSize) {
              setPageSize(p.pageSize);
              setPage(1);
            }
          }}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: meta.total ?? 0,
            showTotal: (total, range) => `${range[0]}–${range[1]} of ${total} drivers`,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            style: { padding: '12px 16px', margin: 0 },
          }}
          size="middle"
          locale={{
            emptyText: (
              <div style={{ padding: '3.5rem 1rem', textAlign: 'center' }}>
                <UserOutlined style={{ fontSize: 36, color: '#C7D2FE', marginBottom: 12 }} />
                <div style={{ fontWeight: 600, color: '#1F2937', fontSize: 15, marginBottom: 6 }}>
                  No drivers found
                </div>
                <div style={{ color: '#6B7280', fontSize: 13, marginBottom: 16 }}>
                  {hasActiveFilters
                    ? 'No drivers matched your active filters. Try adjusting or resetting them.'
                    : 'Get started by creating your first driver profile in the system.'}
                </div>
                {hasActiveFilters ? (
                  <Button onClick={resetAllFilters} icon={<CloseCircleOutlined />}>
                    Clear Filters
                  </Button>
                ) : (
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                    Add First Driver
                  </Button>
                )}
              </div>
            ),
          }}
        />
      </div>

      {/* Add / Edit Driver Drawer */}
      <Drawer
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editTarget ? 'Edit Driver Profile' : 'Add New Driver'}
        subtitle={editTarget ? `Editing ${editTarget.name} (${editTarget.driverCode})` : 'Fill in the driver registration details'}
        width={560}
        footer={
          <>
            <Button onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>
              {editTarget ? 'Update Driver' : 'Create Driver'}
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

          <FormSection title="Personal Information">
            <FormGrid cols={2}>
              <Field label="Full Name" required>
                <input
                  className="input-field"
                  placeholder="e.g. Ramesh Hegde"
                  value={form.name}
                  onChange={e => setF({ name: e.target.value })}
                />
              </Field>
              <Field label="Mobile Number" required>
                <input
                  className="input-field"
                  placeholder="9876543210"
                  value={form.phone}
                  onChange={e => setF({ phone: e.target.value })}
                />
              </Field>
              <Field label="Email Address">
                <input
                  type="email"
                  className="input-field"
                  placeholder="driver@example.com"
                  value={form.email}
                  onChange={e => setF({ email: e.target.value })}
                />
              </Field>
              <Field label="Driver Status">
                <Select
                  value={form.status}
                  onChange={v => setF({ status: v })}
                  style={{ width: '100%' }}
                  options={[
                    { value: 'AVAILABLE', label: '🟢 Available' },
                    { value: 'IN_QUEUE', label: '🔵 In Queue' },
                    { value: 'ON_TRIP', label: '🟣 On Trip' },
                    { value: 'OFFLINE', label: '⚪ Offline' },
                    { value: 'SUSPENDED', label: '🔴 Suspended' },
                    { value: 'INACTIVE', label: '⚫ Inactive' },
                  ]}
                />
              </Field>
              <Field label="Joining Date">
                <input
                  type="date"
                  className="input-field"
                  value={form.joiningDate}
                  onChange={e => setF({ joiningDate: e.target.value })}
                />
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="Driver License Details">
            <FormGrid cols={2}>
              <Field label="License Number" required>
                <input
                  className="input-field"
                  placeholder="KA20 20230001234"
                  value={form.licenseNumber}
                  onChange={e => setF({ licenseNumber: e.target.value.toUpperCase() })}
                  style={{ fontFamily: 'monospace' }}
                />
              </Field>
              <Field label="License Expiry" required>
                <input
                  type="date"
                  className="input-field"
                  value={form.licenseExpiry}
                  onChange={e => setF({ licenseExpiry: e.target.value })}
                />
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="Vehicle Assignment">
            <FormGrid cols={1}>
              <Field label="Assigned Vehicle">
                <Select
                  showSearch
                  allowClear
                  placeholder="Search and select vehicle by plate number, brand, model..."
                  value={form.assignedVehicleId || undefined}
                  onChange={v => setF({ assignedVehicleId: v || '' })}
                  filterOption={(input, option) =>
                    (String(option?.label ?? '')).toLowerCase().includes(input.toLowerCase())
                  }
                  style={{ width: '100%' }}
                  options={[
                    { value: '', label: '🚫 None (Unassigned)' },
                    ...allVehicles.map(v => {
                      const isAssignedToOther =
                        v.assignedDriverId &&
                        (typeof v.assignedDriverId === 'object'
                          ? v.assignedDriverId._id !== editTarget?._id
                          : v.assignedDriverId !== editTarget?._id);
                      const driverName =
                        typeof v.assignedDriverId === 'object' && v.assignedDriverId?.name
                          ? ` (Currently with ${v.assignedDriverId.name})`
                          : isAssignedToOther
                          ? ' [Assigned]'
                          : '';
                      return {
                        value: v._id,
                        label: `${v.registrationNumber} — ${v.brand || ''} ${v.vehicleModel || ''} (${v.categoryId?.name || 'Cab'})${driverName}`,
                      };
                    }),
                  ]}
                />
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="UPI & Banking Details (For Driver Payouts)">
            <FormGrid cols={2}>
              <Field label="UPI ID (VPA)">
                <input
                  className="input-field"
                  placeholder="e.g. driver@oksbi or 9876543210@paytm"
                  value={form.upiId}
                  onChange={e => setF({ upiId: e.target.value })}
                />
              </Field>
              <Field label="UPI Beneficiary Name">
                <input
                  className="input-field"
                  placeholder="Account holder name"
                  value={form.upiBeneficiaryName}
                  onChange={e => setF({ upiBeneficiaryName: e.target.value })}
                />
              </Field>
            </FormGrid>
          </FormSection>

          <FormSection title="Address Details">
            <FormGrid cols={2}>
              <Field label="Street / Door No.">
                <input
                  className="input-field"
                  placeholder="House No., Street"
                  value={form.address.line1}
                  onChange={e => setAddr({ line1: e.target.value })}
                />
              </Field>
              <Field label="Landmark / Area">
                <input
                  className="input-field"
                  placeholder="Near Temple / Bus Stand"
                  value={form.address.line2}
                  onChange={e => setAddr({ line2: e.target.value })}
                />
              </Field>
            </FormGrid>
            <FormGrid cols={2}>
              <Field label="City">
                <input
                  className="input-field"
                  placeholder="Kollur"
                  value={form.address.city}
                  onChange={e => setAddr({ city: e.target.value })}
                />
              </Field>
              <Field label="State">
                <input
                  className="input-field"
                  value={form.address.state}
                  onChange={e => setAddr({ state: e.target.value })}
                />
              </Field>
            </FormGrid>
            <FormGrid cols={2}>
              <Field label="PIN Code">
                <input
                  className="input-field"
                  placeholder="576220"
                  value={form.address.pincode}
                  onChange={e => setAddr({ pincode: e.target.value })}
                />
              </Field>
            </FormGrid>
          </FormSection>
        </div>
      </Drawer>

      {/* Deactivate / Permanent Delete Confirmation Dialog */}
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

      {/* Purge All Inactive Drivers Confirmation Dialog */}
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
