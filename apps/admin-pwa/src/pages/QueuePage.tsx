import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Tag,
  Space,
  Input,
  Select,
  Typography,
  Tooltip,
  Modal,
  Switch,
  Card,
  Row,
  Col,
  Badge,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  QrcodeOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  CarOutlined,
  UserOutlined,
  PhoneOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  PrinterOutlined,
  DownloadOutlined,
  RadarChartOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import apiClient from '@/lib/apiClient';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { toast } from '@/components/Toast';

const { Title, Text } = Typography;

interface QueueEntry {
  _id: string;
  position: number;
  status: string;
  driverId: {
    _id?: string;
    name: string;
    phone: string;
    driverCode: string;
    rating?: number;
  };
  vehicleId: {
    _id?: string;
    registrationNumber: string;
    vehicleModel: string;
    brand: string;
    color?: string;
  };
  vehicleCategoryId: {
    _id: string;
    name: string;
    code: string;
    icon?: string;
  };
  joinedAt: string;
  lastHeartbeat: string;
}

interface TaxiStand {
  _id: string;
  name: string;
  status: string;
  locationId?: {
    _id?: string;
    name: string;
  };
  queueRadius?: number;
  maxQueueSize?: number;
  allowedVehicleCategories?: Array<{ _id: string; name: string; code: string }>;
}

interface QueueApiResponse {
  stand: TaxiStand;
  entries: QueueEntry[];
  byCategory: Record<string, QueueEntry[]>;
}

function minutesAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

function getHeartbeatStatus(dateStr: string): { color: string; label: string; textClass: string } {
  if (!dateStr) return { color: '#ef4444', label: 'Offline', textClass: 'text-red-500' };
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 2) return { color: '#10b981', label: 'Online (< 2m)', textClass: 'text-emerald-600' };
  if (mins < 5) return { color: '#f59e0b', label: 'Idle (< 5m)', textClass: 'text-amber-500' };
  return { color: '#ef4444', label: `Inactive (${mins}m ago)`, textClass: 'text-red-500' };
}

export function QueuePage() {
  const qc = useQueryClient();

  // Selected taxi stand state
  const [selectedStandId, setSelectedStandId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('position_asc');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Pagination state
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50'],
    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} queued vehicles`,
  });

  // Action states
  const [removingEntry, setRemovingEntry] = useState<QueueEntry | null>(null);
  const [qrModalData, setQrModalData] = useState<{ standName: string; qrUrl: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // 1. Fetch all taxi stands for the dropdown selector
  const { data: standsData, isLoading: standsLoading } = useQuery<TaxiStand[]>({
    queryKey: ['admin-taxi-stands-list'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/taxi-stands?status=ACTIVE&limit=200');
      const list = res.data?.data ?? [];
      // If none selected yet, default to first active stand
      if (list.length > 0 && !selectedStandId) {
        setSelectedStandId(list[0]._id);
      }
      return list;
    },
  });

  const stands = standsData ?? [];

  // Active stand object
  const currentStand = useMemo(() => {
    return stands.find(s => s._id === selectedStandId);
  }, [stands, selectedStandId]);

  // 2. Fetch live queue for selected taxi stand
  const {
    data: queueData,
    isLoading: queueLoading,
    isFetching: queueFetching,
    refetch: refetchQueue,
  } = useQuery<QueueApiResponse>({
    queryKey: ['stand-queue', selectedStandId],
    queryFn: async () => {
      if (!selectedStandId) return { stand: {} as TaxiStand, entries: [], byCategory: {} };
      const res = await apiClient.get(`/admin/taxi-stands/${selectedStandId}/queue`);
      return res.data?.data ?? res.data;
    },
    enabled: Boolean(selectedStandId),
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  const rawEntries = queueData?.entries ?? [];
  const byCategory = queueData?.byCategory ?? {};

  // Extract all categories available in the queue or stand
  const availableCategories = useMemo(() => {
    const catsMap = new Map<string, { id: string; name: string; count: number }>();
    if (currentStand?.allowedVehicleCategories) {
      for (const cat of currentStand.allowedVehicleCategories) {
        catsMap.set(cat._id, { id: cat._id, name: cat.name, count: 0 });
      }
    }
    for (const e of rawEntries) {
      const catId = e.vehicleCategoryId?._id || 'unknown';
      const catName = e.vehicleCategoryId?.name || 'Standard';
      if (!catsMap.has(catId)) {
        catsMap.set(catId, { id: catId, name: catName, count: 0 });
      }
      catsMap.get(catId)!.count += 1;
    }
    return Array.from(catsMap.values());
  }, [currentStand, rawEntries]);

  // Filtered & Sorted Entries
  const filteredEntries = useMemo(() => {
    let list = [...rawEntries];

    // Search query: matches driver name, phone, code, vehicle registration or model
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e => {
        const dName = e.driverId?.name?.toLowerCase() ?? '';
        const dPhone = e.driverId?.phone?.toLowerCase() ?? '';
        const dCode = e.driverId?.driverCode?.toLowerCase() ?? '';
        const vPlate = e.vehicleId?.registrationNumber?.toLowerCase() ?? '';
        const vModel = e.vehicleId?.vehicleModel?.toLowerCase() ?? '';
        const vBrand = e.vehicleId?.brand?.toLowerCase() ?? '';
        return (
          dName.includes(q) ||
          dPhone.includes(q) ||
          dCode.includes(q) ||
          vPlate.includes(q) ||
          vModel.includes(q) ||
          vBrand.includes(q)
        );
      });
    }

    // Category filter
    if (categoryFilter !== 'ALL') {
      list = list.filter(e => e.vehicleCategoryId?._id === categoryFilter);
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      list = list.filter(e => e.status === statusFilter);
    }

    // Sorting
    list.sort((a, b) => {
      switch (sortBy) {
        case 'position_asc':
          return a.position - b.position;
        case 'position_desc':
          return b.position - a.position;
        case 'joined_asc':
          return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        case 'joined_desc':
          return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
        case 'rating_desc':
          return (b.driverId?.rating ?? 0) - (a.driverId?.rating ?? 0);
        case 'driver_name':
          return (a.driverId?.name ?? '').localeCompare(b.driverId?.name ?? '');
        default:
          return a.position - b.position;
      }
    });

    return list;
  }, [rawEntries, search, categoryFilter, statusFilter, sortBy]);

  // Handle Remove Driver from Queue
  const handleRemoveDriver = async () => {
    if (!removingEntry || !selectedStandId) return;
    try {
      await apiClient.delete(`/admin/taxi-stands/${selectedStandId}/queue/${removingEntry._id}`);
      toast.success(
        `Driver ${removingEntry.driverId?.name || 'Unknown'} removed from queue successfully`
      );
      qc.invalidateQueries({ queryKey: ['stand-queue', selectedStandId] });
      setRemovingEntry(null);
    } catch {
      toast.error('Failed to remove driver from queue');
    }
  };

  // Handle Stand QR Code display
  const handleViewStandQR = async () => {
    if (!currentStand) return;
    setQrLoading(true);
    try {
      const res = await apiClient.post(`/admin/taxi-stands/${currentStand._id}/regenerate-qr`, {});
      const url = res.data?.data?.qrDataUrl ?? res.data?.qrDataUrl;
      if (url) {
        setQrModalData({ standName: currentStand.name, qrUrl: url });
      } else {
        toast.error('QR code not available for this stand');
      }
    } catch {
      toast.error('Failed to retrieve stand QR code');
    } finally {
      setQrLoading(false);
    }
  };

  // Stand Metrics
  const totalVehicles = rawEntries.length;
  const waitingCount = rawEntries.filter(e => e.status === 'WAITING').length;
  const offeredCount = rawEntries.filter(e => e.status === 'OFFERED').length;
  const maxCapacity = currentStand?.maxQueueSize || 50;
  const capacityPercent = Math.min(100, Math.round((totalVehicles / maxCapacity) * 100));

  // Table Columns
  const columns: ColumnsType<QueueEntry> = [
    {
      title: 'Queue Position',
      key: 'position',
      width: 150,
      render: (_, record) => {
        const pos = record.position;
        if (pos === 1) {
          return (
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-800 font-black text-sm border-2 border-amber-400 shadow-sm">
                1
              </span>
              <span className="bg-amber-500/10 text-amber-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                Next Up
              </span>
            </div>
          );
        }
        if (pos === 2) {
          return (
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-extrabold text-sm border border-slate-300">
                2
              </span>
              <span className="text-slate-500 text-xs font-semibold">2nd in Line</span>
            </div>
          );
        }
        if (pos === 3) {
          return (
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-50 text-amber-900 font-extrabold text-sm border border-amber-200">
                3
              </span>
              <span className="text-slate-500 text-xs font-semibold">3rd in Line</span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
              {pos}
            </span>
            <span className="text-slate-400 text-xs font-mono">#{pos}</span>
          </div>
        );
      },
    },
    {
      title: 'Driver Details',
      key: 'driver',
      render: (_, record) => (
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center shrink-0 border border-indigo-200 text-sm">
            {record.driverId?.name ? record.driverId.name.charAt(0).toUpperCase() : 'D'}
          </div>
          <div>
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <span>{record.driverId?.name ?? 'Unknown Driver'}</span>
              {record.driverId?.rating ? (
                <span className="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.2 rounded border border-amber-200 font-bold">
                  ★ {record.driverId.rating.toFixed(1)}
                </span>
              ) : null}
            </div>
            <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
              <span className="font-mono bg-slate-100 px-1 rounded text-slate-700">
                {record.driverId?.driverCode || 'NO-CODE'}
              </span>
              <span>•</span>
              <a
                href={`tel:${record.driverId?.phone}`}
                className="text-slate-600 hover:text-indigo-600 flex items-center gap-1"
                onClick={e => e.stopPropagation()}
              >
                <PhoneOutlined className="text-[10px]" /> {record.driverId?.phone || '—'}
              </a>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Vehicle & Category',
      key: 'vehicle',
      render: (_, record) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block bg-amber-100 text-slate-900 font-mono font-bold text-xs px-2 py-0.5 rounded border border-amber-300 tracking-wider">
              {record.vehicleId?.registrationNumber || 'NOT-ASSIGNED'}
            </span>
            <Tag color="blue" className="text-xs font-medium">
              {record.vehicleCategoryId?.name || 'Standard'}
            </Tag>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {record.vehicleId?.brand} {record.vehicleId?.vehicleModel}
            {record.vehicleId?.color ? ` • ${record.vehicleId.color}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 140,
      render: (_, record) => {
        if (record.status === 'OFFERED') {
          return (
            <Tag color="warning" className="font-semibold px-2 py-0.5 animate-pulse">
              Offer Sent
            </Tag>
          );
        }
        return (
          <Tag color="success" className="font-semibold px-2 py-0.5">
            Waiting
          </Tag>
        );
      },
    },
    {
      title: 'Wait Time & Heartbeat',
      key: 'activity',
      width: 190,
      render: (_, record) => {
        const hb = getHeartbeatStatus(record.lastHeartbeat);
        return (
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <ClockCircleOutlined className="text-slate-400" />
              <span>In queue: {minutesAgo(record.joinedAt)}</span>
            </div>
            <Tooltip title={`Last location ping: ${minutesAgo(record.lastHeartbeat)}`}>
              <div className="flex items-center gap-1.5 text-xs cursor-pointer">
                <span
                  className="w-2 h-2 rounded-full inline-block animate-pulse"
                  style={{ backgroundColor: hb.color }}
                />
                <span className={hb.textClass}>{hb.label}</span>
              </div>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <Tooltip title="Remove driver from queue">
          <Button
            danger
            size="small"
            type="text"
            icon={<DeleteOutlined />}
            onClick={() => setRemovingEntry(record)}
            className="hover:bg-red-50"
          >
            Remove
          </Button>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
            Queue Management
          </Title>
          <Text type="secondary" className="text-sm">
            Live stand queues, vehicle positioning, and dispatch turn management
          </Text>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto Refresh Toggle */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="font-medium">Auto-refresh (10s)</span>
            <Switch
              size="small"
              checked={autoRefresh}
              onChange={setAutoRefresh}
            />
          </div>

          {/* Manual Refresh Button */}
          <Button
            icon={<ReloadOutlined spin={queueFetching} />}
            onClick={() => refetchQueue()}
            disabled={!selectedStandId}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stand Selector Bar */}
      <Card
        className="shadow-sm border border-slate-200"
        styles={{ body: { padding: '16px 20px' } }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 text-slate-700 font-bold text-sm shrink-0">
              <EnvironmentOutlined className="text-indigo-600 text-base" />
              <span>Select Taxi Stand:</span>
            </div>

            <Select
              showSearch
              placeholder="Select a taxi stand to view live queue..."
              value={selectedStandId || undefined}
              onChange={val => {
                setSelectedStandId(val);
                setSearch('');
                setCategoryFilter('ALL');
              }}
              loading={standsLoading}
              filterOption={(input, option) => {
                const label = String(option?.label ?? '').toLowerCase();
                return label.includes(input.toLowerCase());
              }}
              style={{ width: '100%', maxWidth: 420 }}
              options={stands.map(stand => ({
                value: stand._id,
                label: `${stand.name}${stand.locationId?.name ? ` — ${stand.locationId.name}` : ''}`,
              }))}
            />
          </div>

          {currentStand && (
            <div className="flex items-center gap-2">
              <Button
                icon={<QrcodeOutlined />}
                onClick={handleViewStandQR}
                loading={qrLoading}
              >
                Stand QR Code
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Stand KPI Metrics */}
      {currentStand && (
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="shadow-sm border border-slate-200" styles={{ body: { padding: 16 } }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-bold text-slate-400">Total in Queue</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {totalVehicles} <span className="text-xs font-normal text-slate-400">/ {maxCapacity} capacity</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                  <CarOutlined />
                </div>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-3 overflow-hidden">
                <div
                  className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card className="shadow-sm border border-slate-200" styles={{ body: { padding: 16 } }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-bold text-slate-400">Ready & Waiting</div>
                  <div className="text-2xl font-black text-emerald-600 mt-1">{waitingCount}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                  <CheckCircleOutlined />
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3">
                Eligible for instant automated dispatch
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card className="shadow-sm border border-slate-200" styles={{ body: { padding: 16 } }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-bold text-slate-400">Dispatched / Offered</div>
                  <div className="text-2xl font-black text-amber-500 mt-1">{offeredCount}</div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg">
                  <ClockCircleOutlined />
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3">
                Awaiting driver trip acceptance
              </div>
            </Card>
          </Col>

          <Col xs={24} sm={12} lg={6}>
            <Card className="shadow-sm border border-slate-200" styles={{ body: { padding: 16 } }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase font-bold text-slate-400">Geofence Radius</div>
                  <div className="text-2xl font-black text-slate-900 mt-1">
                    {currentStand.queueRadius ?? 150} <span className="text-sm font-semibold">meters</span>
                  </div>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg">
                  <RadarChartOutlined />
                </div>
              </div>
              <div className="text-xs text-slate-500 mt-3 truncate">
                {currentStand.locationId?.name || 'Local Stand Coordinates'}
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Main Table & Filters */}
      {selectedStandId ? (
        <Card
          className="shadow-sm border border-slate-200 overflow-hidden"
          styles={{ body: { padding: 0 } }}
        >
          {/* Filter Toolbar */}
          <div className="p-4 border-b border-slate-100 bg-white flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              {/* Search Box */}
              <Input
                prefix={<SearchOutlined className="text-slate-400" />}
                placeholder="Search driver, phone, code, vehicle plate..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                allowClear
                style={{ width: 280 }}
              />

              {/* Category Filter */}
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 180 }}
                options={[
                  { value: 'ALL', label: `All Categories (${totalVehicles})` },
                  ...availableCategories.map(cat => ({
                    value: cat.id,
                    label: `${cat.name} (${cat.count})`,
                  })),
                ]}
              />

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 140 }}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'WAITING', label: 'Waiting Only' },
                  { value: 'OFFERED', label: 'Offered Only' },
                ]}
              />

              {/* Sort By Filter */}
              <Select
                value={sortBy}
                onChange={setSortBy}
                style={{ width: 190 }}
                options={[
                  { value: 'position_asc', label: 'Position (1st First)' },
                  { value: 'position_desc', label: 'Position (Last First)' },
                  { value: 'joined_asc', label: 'Wait Time (Longest)' },
                  { value: 'joined_desc', label: 'Wait Time (Shortest)' },
                  { value: 'rating_desc', label: 'Rating (Highest)' },
                  { value: 'driver_name', label: 'Driver Name (A-Z)' },
                ]}
              />
            </div>

            <div className="text-xs text-slate-400 shrink-0">
              Showing <span className="font-bold text-slate-700">{filteredEntries.length}</span> of{' '}
              <span className="font-bold text-slate-700">{totalVehicles}</span> drivers
            </div>
          </div>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filteredEntries}
            rowKey="_id"
            loading={queueLoading}
            pagination={pagination}
            onChange={p => setPagination(p)}
            locale={{
              emptyText: (
                <div className="py-12 text-center text-slate-400">
                  <CarOutlined className="text-4xl text-slate-300 mb-2" />
                  <p className="text-base font-semibold text-slate-700">No vehicles in queue</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Drivers within {currentStand?.queueRadius ?? 150}m of this taxi stand will appear here automatically when they check in.
                  </p>
                </div>
              ),
            }}
          />
        </Card>
      ) : (
        <Card className="text-center py-12 border border-slate-200 shadow-sm">
          <EnvironmentOutlined className="text-5xl text-indigo-400 mb-3" />
          <Title level={4} style={{ margin: 0 }}>Select a Taxi Stand</Title>
          <Text type="secondary" className="block mt-1">
            Choose a taxi stand from the dropdown above to monitor its live vehicle queue.
          </Text>
        </Card>
      )}

      {/* Confirm Remove Dialog */}
      <ConfirmDialog
        open={Boolean(removingEntry)}
        title="Remove Driver from Queue?"
        message={
          removingEntry
            ? `Are you sure you want to remove ${removingEntry.driverId?.name || 'this driver'} (${removingEntry.vehicleId?.registrationNumber || ''}) from queue position #${removingEntry.position}? All following drivers will automatically move up in queue rank.`
            : ''
        }
        confirmLabel="Remove Driver"
        danger
        onConfirm={handleRemoveDriver}
        onCancel={() => setRemovingEntry(null)}
      />

      {/* Stand QR Code Modal */}
      <Modal
        open={Boolean(qrModalData)}
        onCancel={() => setQrModalData(null)}
        footer={null}
        centered
        width={420}
        styles={{ body: { borderRadius: 16, padding: 24 } }}
      >
        {qrModalData && (
          <div className="text-center">
            <Title level={4} style={{ marginBottom: 4 }}>
              {qrModalData.standName}
            </Title>
            <Text type="secondary" className="text-xs">
              Drivers scan this QR code at the stand to check in to the queue
            </Text>

            <div className="my-5 p-4 bg-white border-2 border-slate-200 rounded-2xl shadow-inner inline-block">
              <img
                src={qrModalData.qrUrl}
                alt={qrModalData.standName}
                className="w-64 h-64 mx-auto rounded-lg"
              />
            </div>

            <div className="flex gap-2 justify-center">
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = qrModalData.qrUrl;
                  a.download = `QR_${qrModalData.standName.replace(/\s+/g, '_')}.png`;
                  a.click();
                }}
              >
                Download QR
              </Button>
              <Button
                icon={<PrinterOutlined />}
                onClick={() => {
                  const w = window.open('', '_blank');
                  if (w) {
                    w.document.write(`
                      <html>
                        <head><title>QR - ${qrModalData.standName}</title></head>
                        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:95vh;font-family:sans-serif;">
                          <h2>${qrModalData.standName} Taxi Stand</h2>
                          <p>Scan to join queue</p>
                          <img src="${qrModalData.qrUrl}" style="width:360px;" />
                        </body>
                      </html>
                    `);
                    w.document.close();
                    w.print();
                  }
                }}
              >
                Print Poster
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
