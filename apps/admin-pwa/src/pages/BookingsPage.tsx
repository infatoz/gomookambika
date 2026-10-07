import { useState, useCallback, useMemo } from 'react';
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
  Card,
  Row,
  Col,
  Switch,
  Badge,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined,
  EyeOutlined,
  PrinterOutlined,
  EnvironmentOutlined,
  UserOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  WalletOutlined,
  SwapOutlined,
  CompassOutlined,
  FileTextOutlined,
  DollarCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import apiClient from '@/lib/apiClient';
import { Drawer } from '@/components/Drawer';
import { ETicketModal, BookingTicketData } from '@/components/ETicketModal';

const { Title, Text } = Typography;

interface VehicleCategory {
  _id: string;
  name: string;
  code: string;
}

interface BookingStats {
  total: number;
  live: number;
  completed: number;
  cancelled: number;
  totalRevenue: number;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; isLive?: boolean }> = {
  PENDING: { color: 'gold', label: 'Pending Dispatch' },
  CONFIRMED: { color: 'blue', label: 'Confirmed', isLive: true },
  DRIVER_ASSIGNED: { color: 'purple', label: 'Driver Assigned', isLive: true },
  EN_ROUTE: { color: 'cyan', label: 'Driver En Route', isLive: true },
  ARRIVED: { color: 'geekblue', label: 'Driver Arrived', isLive: true },
  TRIP_STARTED: { color: 'processing', label: 'Trip In Progress', isLive: true },
  COMPLETED: { color: 'success', label: 'Completed' },
  CANCELLED: { color: 'error', label: 'Cancelled' },
  EXPIRED: { color: 'default', label: 'Expired' },
};

const PAYMENT_COLOR: Record<string, string> = {
  PAID: 'success',
  PENDING: 'warning',
  FAILED: 'error',
  REFUNDED: 'purple',
};

export function BookingsPage() {
  const qc = useQueryClient();

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tripTypeFilter, setTripTypeFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Selected for Details Drawer & E-Ticket Modal
  const [drawerBooking, setDrawerBooking] = useState<BookingTicketData | null>(null);
  const [eTicketBooking, setETicketBooking] = useState<BookingTicketData | null>(null);

  // 1. Fetch Categories for filter
  const { data: categories = [] } = useQuery<VehicleCategory[]>({
    queryKey: ['vehicle-categories-booking-filter'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/vehicle-categories');
      return res.data?.data ?? [];
    },
  });

  // 2. Fetch Booking Stats
  const { data: stats } = useQuery<BookingStats>({
    queryKey: ['admin-bookings-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/bookings/stats');
      return res.data?.data ?? { total: 0, live: 0, completed: 0, cancelled: 0, totalRevenue: 0 };
    },
    refetchInterval: autoRefresh ? 15_000 : false,
  });

  // 3. Fetch Bookings List
  const {
    data: bookingsResponse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      'admin-bookings-list',
      page,
      pageSize,
      search,
      statusFilter,
      tripTypeFilter,
      paymentStatusFilter,
      categoryFilter,
    ],
    queryFn: async () => {
      const p = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (search) p.set('search', search);
      if (statusFilter) p.set('status', statusFilter);
      if (tripTypeFilter) p.set('tripType', tripTypeFilter);
      if (paymentStatusFilter) p.set('paymentStatus', paymentStatusFilter);
      if (categoryFilter) p.set('vehicleCategoryId', categoryFilter);

      const res = await apiClient.get(`/admin/bookings?${p}`);
      return res.data;
    },
    refetchInterval: autoRefresh ? 12_000 : false,
  });

  const bookings: BookingTicketData[] = bookingsResponse?.data ?? [];
  const meta = bookingsResponse?.meta ?? { total: 0, totalPages: 1 };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTripTypeFilter('');
    setPaymentStatusFilter('');
    setCategoryFilter('');
    setPage(1);
  };

  const formatDate = (d?: string) => {
    if (!d) return '—';
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) + ' ' + date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatCurrency = (amt?: number) => {
    return amt != null ? `₹${amt.toFixed(2)}` : '—';
  };

  // Table Columns
  const columns: ColumnsType<BookingTicketData> = [
    {
      title: 'Booking #',
      key: 'bookingNumber',
      width: 170,
      render: (_, record) => (
        <div>
          <div className="font-mono font-bold text-indigo-600 text-sm">
            {record.bookingNumber}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            {formatDate(record.createdAt)}
          </div>
          <div className="mt-1">
            <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
              {record.tripType?.replace(/_/g, ' ') || 'ONE WAY'}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 180,
      render: (_, record) => (
        <div>
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <UserOutlined className="text-slate-400 text-xs" />
            <span>{record.customerId?.name || 'Guest Passenger'}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 font-medium">
            <a
              href={`tel:${record.customerId?.phone}`}
              className="text-slate-600 hover:text-indigo-600"
              onClick={e => e.stopPropagation()}
            >
              {record.customerId?.phone || '—'}
            </a>
          </div>
          {record.customerId?.email && (
            <div className="text-[11px] text-slate-400 truncate max-w-40">
              {record.customerId.email}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Route',
      key: 'route',
      render: (_, record) => (
        <div className="space-y-1.5 max-w-xs">
          <div className="flex items-start gap-1.5 text-xs">
            <span className="text-emerald-500 font-bold shrink-0 mt-0.5">🟢</span>
            <div className="truncate text-slate-800 font-medium" title={record.pickupLocation.address}>
              {record.originTaxiStandId?.name ? `${record.originTaxiStandId.name} Stand` : record.pickupLocation.address}
            </div>
          </div>
          <div className="flex items-start gap-1.5 text-xs">
            <span className="text-red-500 font-bold shrink-0 mt-0.5">🔴</span>
            <div className="truncate text-slate-600" title={record.dropLocation?.address || 'As Directed'}>
              {record.destinationTaxiStandId?.name
                ? `${record.destinationTaxiStandId.name} Stand`
                : (record.dropLocation?.address || 'As Directed')}
            </div>
          </div>
          {record.fareSnapshot?.distanceKm ? (
            <div className="text-[11px] text-slate-400 font-medium pl-4">
              Est. {record.fareSnapshot.distanceKm} KM
            </div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Vehicle & Driver',
      key: 'vehicleDriver',
      render: (_, record) => {
        const hasDriver = Boolean(record.assignedDriverId?.name);
        return (
          <div>
            <div className="flex items-center gap-2">
              <Tag color="blue" className="text-xs font-medium">
                {record.vehicleCategoryId?.name || 'Taxi'}
              </Tag>
              {record.assignedVehicleId?.registrationNumber && (
                <span className="bg-amber-100 text-slate-900 border border-amber-300 font-mono font-bold text-[11px] px-1.5 py-0.2 rounded">
                  {record.assignedVehicleId.registrationNumber}
                </span>
              )}
            </div>
            {hasDriver ? (
              <div className="text-xs text-slate-700 mt-1 font-semibold flex items-center gap-1.5">
                <CarOutlined className="text-indigo-500" />
                <span>{record.assignedDriverId?.name}</span>
                {record.assignedDriverId?.driverCode && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    ({record.assignedDriverId.driverCode})
                  </span>
                )}
              </div>
            ) : (
              <div className="text-xs text-amber-600 mt-1 font-medium italic">
                Awaiting driver allocation
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Fare & Payment',
      key: 'fare',
      width: 150,
      render: (_, record) => (
        <div>
          <div className="font-extrabold text-slate-900 text-sm">
            {formatCurrency(record.fareSnapshot?.total)}
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Tag
              color={PAYMENT_COLOR[record.paymentStatus] || 'default'}
              className="text-[10px] font-bold px-1.5 py-0 rounded"
            >
              {record.paymentStatus}
            </Tag>
            <span className="text-[10px] text-slate-400 uppercase font-semibold">
              {record.paymentOption || 'CASH'}
            </span>
          </div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 150,
      render: (_, record) => {
        const conf = STATUS_CONFIG[record.status] || {
          color: 'default',
          label: record.status,
        };
        return (
          <div className="flex items-center gap-1.5">
            {conf.isLive && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse inline-block" />
            )}
            <Tag color={conf.color} className="font-semibold text-xs px-2 py-0.5">
              {conf.label}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 170,
      align: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View Detailed Booking & Route Timeline">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDrawerBooking(record)}
            >
              Details
            </Button>
          </Tooltip>

          <Tooltip title="Print / Download Digital E-Ticket">
            <Button
              size="small"
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => setETicketBooking(record)}
              style={{ background: '#4f46e5', borderColor: '#4338ca' }}
            >
              E-Ticket
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Live Refresh Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
            Live Booking & Dispatch
          </Title>
          <Text type="secondary" className="text-sm">
            Active passenger reservations, live dispatch monitoring, and e-ticket generation
          </Text>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 shadow-sm">
            <span
              className={`w-2 h-2 rounded-full ${
                autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
              }`}
            />
            <span className="font-medium">Live Polling (12s)</span>
            <Switch
              size="small"
              checked={autoRefresh}
              onChange={setAutoRefresh}
            />
          </div>

          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => {
              refetch();
              qc.invalidateQueries({ queryKey: ['admin-bookings-stats'] });
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Stat Cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border border-slate-200" styles={{ body: { padding: 16 } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">Total Bookings</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  {stats?.total ?? meta.total}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                <FileTextOutlined />
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-3">All time passenger reservations</div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border border-slate-200" styles={{ body: { padding: 16 } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">Live / In Progress</div>
                <div className="text-2xl font-black text-indigo-600 mt-1">
                  {stats?.live ?? 0}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-lg">
                <CompassOutlined />
              </div>
            </div>
            <div className="text-xs text-indigo-600 font-semibold mt-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
              Active rides currently on road
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border border-slate-200" styles={{ body: { padding: 16 } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">Completed Trips</div>
                <div className="text-2xl font-black text-emerald-600 mt-1">
                  {stats?.completed ?? 0}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                <CheckCircleOutlined />
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-3">Successfully delivered passenger journeys</div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card className="shadow-sm border border-slate-200" styles={{ body: { padding: 16 } }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase font-bold text-slate-400">Paid Revenue</div>
                <div className="text-2xl font-black text-slate-900 mt-1">
                  ₹{(stats?.totalRevenue ?? 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
                <DollarCircleOutlined />
              </div>
            </div>
            <div className="text-xs text-slate-500 mt-3">Total collected trip invoices</div>
          </Card>
        </Col>
      </Row>

      {/* Filters Toolbar Card */}
      <Card
        className="shadow-sm border border-slate-200"
        styles={{ body: { padding: '16px 20px' } }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Search Box */}
          <Input
            prefix={<SearchOutlined className="text-slate-400" />}
            placeholder="Search booking#, customer, phone, address..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setPage(1);
            }}
            allowClear
            style={{ width: 280 }}
          />

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onChange={val => {
              setStatusFilter(val);
              setPage(1);
            }}
            style={{ width: 170 }}
            placeholder="Status"
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'CONFIRMED', label: 'Confirmed' },
              { value: 'DRIVER_ASSIGNED', label: 'Driver Assigned' },
              { value: 'EN_ROUTE', label: 'Driver En Route' },
              { value: 'ARRIVED', label: 'Driver Arrived' },
              { value: 'TRIP_STARTED', label: 'Trip Started' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'PENDING', label: 'Pending Dispatch' },
              { value: 'CANCELLED', label: 'Cancelled' },
              { value: 'EXPIRED', label: 'Expired' },
            ]}
          />

          {/* Trip Type Filter */}
          <Select
            value={tripTypeFilter}
            onChange={val => {
              setTripTypeFilter(val);
              setPage(1);
            }}
            style={{ width: 150 }}
            placeholder="Trip Type"
            options={[
              { value: '', label: 'All Trip Types' },
              { value: 'ONE_WAY', label: 'One Way' },
              { value: 'ROUND_TRIP', label: 'Round Trip' },
              { value: 'LOCAL_RENTAL', label: 'Local Rental' },
              { value: 'OUTSTATION', label: 'Outstation' },
            ]}
          />

          {/* Payment Status Filter */}
          <Select
            value={paymentStatusFilter}
            onChange={val => {
              setPaymentStatusFilter(val);
              setPage(1);
            }}
            style={{ width: 150 }}
            placeholder="Payment Status"
            options={[
              { value: '', label: 'All Payments' },
              { value: 'PAID', label: 'Paid' },
              { value: 'PENDING', label: 'Pending Payment' },
              { value: 'FAILED', label: 'Failed' },
              { value: 'REFUNDED', label: 'Refunded' },
            ]}
          />

          {/* Vehicle Category Filter */}
          <Select
            value={categoryFilter}
            onChange={val => {
              setCategoryFilter(val);
              setPage(1);
            }}
            style={{ width: 160 }}
            placeholder="Category"
            options={[
              { value: '', label: 'All Categories' },
              ...categories.map(c => ({
                value: c._id,
                label: c.name,
              })),
            ]}
          />

          {(search || statusFilter || tripTypeFilter || paymentStatusFilter || categoryFilter) && (
            <Button onClick={handleResetFilters} type="link" className="text-slate-500">
              Reset Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Main Bookings Table Card */}
      <Card
        className="shadow-sm border border-slate-200 overflow-hidden"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={bookings}
          rowKey="_id"
          loading={isLoading}
          pagination={{
            current: page,
            pageSize: pageSize,
            total: meta.total,
            showSizeChanger: true,
            pageSizeOptions: ['10', '15', '25', '50'],
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} bookings`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          locale={{
            emptyText: (
              <div className="py-14 text-center text-slate-400">
                <FileTextOutlined className="text-4xl text-slate-300 mb-2" />
                <p className="text-base font-semibold text-slate-700">No bookings found</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Adjust your search or filter parameters to view bookings.
                </p>
              </div>
            ),
          }}
        />
      </Card>

      {/* Complete Booking Details Drawer */}
      <Drawer
        open={Boolean(drawerBooking)}
        onClose={() => setDrawerBooking(null)}
        title="Booking Details"
        subtitle={drawerBooking ? `Booking #${drawerBooking.bookingNumber}` : undefined}
        footer={
          drawerBooking ? (
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => setETicketBooking(drawerBooking)}
              style={{ background: '#4f46e5', borderColor: '#4338ca' }}
            >
              Print / Download E-Ticket
            </Button>
          ) : null
        }
      >
        {drawerBooking && (
          <div className="space-y-6 text-sm text-slate-700">
            {/* Status & Trip Type */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-bold uppercase text-slate-400">Status</div>
                <div className="mt-1">
                  <Tag
                    color={STATUS_CONFIG[drawerBooking.status]?.color || 'default'}
                    className="font-bold"
                  >
                    {STATUS_CONFIG[drawerBooking.status]?.label || drawerBooking.status}
                  </Tag>
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-slate-400">Trip Type</div>
                <div className="mt-1 font-bold text-slate-900">
                  {drawerBooking.tripType?.replace(/_/g, ' ')}
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Passenger Information
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Name:</span>
                  <span className="font-bold text-slate-900">
                    {drawerBooking.customerId?.name || 'Guest'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Phone:</span>
                  <a
                    href={`tel:${drawerBooking.customerId?.phone}`}
                    className="font-bold text-indigo-600"
                  >
                    {drawerBooking.customerId?.phone || '—'}
                  </a>
                </div>
                {drawerBooking.customerId?.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="text-slate-700">{drawerBooking.customerId.email}</span>
                  </div>
                )}
                {drawerBooking.passengers && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Passengers:</span>
                    <span className="font-bold text-slate-900">{drawerBooking.passengers}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Route Details */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Route & Schedule
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold mt-0.5">🟢</span>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">Pickup Location</div>
                    <div className="font-semibold text-slate-900">
                      {drawerBooking.pickupLocation.address}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <span className="text-red-500 font-bold mt-0.5">🔴</span>
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase">Drop Location</div>
                    <div className="font-semibold text-slate-900">
                      {drawerBooking.dropLocation?.address || 'As Directed By Passenger'}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Scheduled Time:</span>
                  <span className="font-bold text-slate-800">
                    {formatDate(drawerBooking.scheduledAt || drawerBooking.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Vehicle & Chauffeur */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Assigned Vehicle & Chauffeur
              </div>
              <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Category:</span>
                  <Tag color="blue">{drawerBooking.vehicleCategoryId?.name || 'Standard'}</Tag>
                </div>
                {drawerBooking.assignedVehicleId ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Vehicle:</span>
                      <span className="font-bold text-slate-900">
                        {drawerBooking.assignedVehicleId.brand} {drawerBooking.assignedVehicleId.vehicleModel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Registration Plate:</span>
                      <span className="bg-amber-100 border border-amber-300 px-2 py-0.5 rounded font-mono font-bold text-xs text-slate-900">
                        {drawerBooking.assignedVehicleId.registrationNumber}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-amber-600 font-medium">No vehicle assigned yet</div>
                )}

                {drawerBooking.assignedDriverId ? (
                  <>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-slate-500">Chauffeur:</span>
                      <span className="font-bold text-slate-900">
                        {drawerBooking.assignedDriverId.name} ({drawerBooking.assignedDriverId.driverCode})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Contact:</span>
                      <a href={`tel:${drawerBooking.assignedDriverId.phone}`} className="font-bold text-indigo-600">
                        {drawerBooking.assignedDriverId.phone}
                      </a>
                    </div>
                  </>
                ) : null}
              </div>
            </div>

            {/* Fare Breakdown */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Fare Breakdown & Invoice
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                {drawerBooking.fareSnapshot?.baseFare ? (
                  <div className="flex justify-between">
                    <span>Base Fare:</span>
                    <span className="font-semibold">₹{drawerBooking.fareSnapshot.baseFare.toFixed(2)}</span>
                  </div>
                ) : null}
                {drawerBooking.fareSnapshot?.distanceFare ? (
                  <div className="flex justify-between">
                    <span>Distance Fare ({drawerBooking.fareSnapshot.distanceKm} KM):</span>
                    <span className="font-semibold">₹{drawerBooking.fareSnapshot.distanceFare.toFixed(2)}</span>
                  </div>
                ) : null}
                {drawerBooking.fareSnapshot?.waitingFare ? (
                  <div className="flex justify-between">
                    <span>Waiting Charges:</span>
                    <span className="font-semibold">₹{drawerBooking.fareSnapshot.waitingFare.toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between pt-2 border-t border-slate-200 font-bold text-sm text-slate-900">
                  <span>Total Fare:</span>
                  <span className="text-indigo-600">₹{(drawerBooking.fareSnapshot?.total || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-1 text-slate-500">
                  <span>Payment Status:</span>
                  <span className="font-bold text-emerald-600">
                    {drawerBooking.paymentStatus} ({drawerBooking.paymentOption})
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Realistic Official E-Ticket Modal */}
      <ETicketModal
        open={Boolean(eTicketBooking)}
        onClose={() => setETicketBooking(null)}
        booking={eTicketBooking}
      />
    </div>
  );
}
