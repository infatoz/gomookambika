import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  Button,
  Input,
  Select,
  Tag,
  Switch,
  Modal,
  Form,
  InputNumber,
  Popconfirm,
  Card,
  Row,
  Col,
  Space,
  Tooltip,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Route,
  ArrowLeftRight,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Edit3,
  CheckCircle2,
  Car,
  MapPin,
  RefreshCw,
  Info,
  Layers,
} from 'lucide-react';
import apiClient from '@/lib/apiClient';
import { toast } from '@/components/Toast';

export interface LocationItem {
  _id: string;
  name: string;
  code: string;
  type: string;
  address?: { city?: string; line1?: string };
}

export interface CategoryItem {
  _id: string;
  name: string;
  code: string;
  baseFare?: number;
  ratePerKm?: number;
}

export interface PricingRuleItem {
  _id: string;
  name: string;
  ruleType: 'FIXED' | 'LOCATION_TO_LOCATION' | 'PER_KM' | 'SLAB';
  priority: number;
  vehicleCategoryId?: CategoryItem | string;
  originLocationId?: LocationItem | string;
  destinationLocationId?: LocationItem | string;
  isBidirectional?: boolean;
  tripType?: string;
  fixedPrice?: number;
  baseFare?: number;
  minimumKm?: number;
  ratePerKm?: number;
  includedKm?: number;
  extraKmRate?: number;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

export function PricingRulesPage() {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  // Filters state
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRuleItem | null>(null);

  // 1. Fetch Pricing Rules
  const {
    data: rules = [],
    isLoading,
    refetch,
  } = useQuery<PricingRuleItem[]>({
    queryKey: ['admin-pricing-rules'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/pricing-rules?limit=100');
      return res.data?.data ?? [];
    },
  });

  // 2. Fetch Locations (for origin & destination select)
  const { data: locations = [] } = useQuery<LocationItem[]>({
    queryKey: ['admin-locations-pricing'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/locations?status=ACTIVE&limit=100');
      return res.data?.data ?? [];
    },
  });

  // 3. Fetch Vehicle Categories
  const { data: categories = [] } = useQuery<CategoryItem[]>({
    queryKey: ['admin-categories-pricing'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/vehicle-categories');
      return res.data?.data ?? [];
    },
  });

  // Mutations
  const createOrUpdateMutation = useMutation({
    mutationFn: async (values: any) => {
      if (editingRule) {
        return apiClient.put(`/admin/pricing-rules/${editingRule._id}`, values);
      }
      return apiClient.post('/admin/pricing-rules', values);
    },
    onSuccess: () => {
      toast.success(editingRule ? 'Pricing rule updated successfully' : 'Fixed route fare created successfully');
      setModalOpen(false);
      form.resetFields();
      setEditingRule(null);
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || err.message || 'Operation failed');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) => {
      return apiClient.patch(`/admin/pricing-rules/${id}/status`, { status });
    },
    onSuccess: () => {
      toast.success('Pricing rule status updated');
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/admin/pricing-rules/${id}`);
    },
    onSuccess: () => {
      toast.success('Pricing rule deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] });
    },
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post('/admin/pricing-rules/seed-defaults', {});
    },
    onSuccess: (res: any) => {
      toast.success(res.data?.message || 'Default fixed routes generated successfully');
      queryClient.invalidateQueries({ queryKey: ['admin-pricing-rules'] });
    },
  });

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      ruleType: 'FIXED',
      isBidirectional: true,
      priority: 15,
      status: 'ACTIVE',
      tripType: 'ONE_WAY',
    });
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (rule: PricingRuleItem) => {
    setEditingRule(rule);
    form.resetFields();
    form.setFieldsValue({
      name: rule.name,
      ruleType: rule.ruleType,
      priority: rule.priority,
      vehicleCategoryId: typeof rule.vehicleCategoryId === 'object' ? rule.vehicleCategoryId?._id : rule.vehicleCategoryId,
      originLocationId: typeof rule.originLocationId === 'object' ? rule.originLocationId?._id : rule.originLocationId,
      destinationLocationId: typeof rule.destinationLocationId === 'object' ? rule.destinationLocationId?._id : rule.destinationLocationId,
      isBidirectional: rule.isBidirectional !== false,
      tripType: rule.tripType || 'ONE_WAY',
      fixedPrice: rule.fixedPrice,
      baseFare: rule.baseFare,
      minimumKm: rule.minimumKm,
      ratePerKm: rule.ratePerKm,
      includedKm: rule.includedKm,
      extraKmRate: rule.extraKmRate,
      description: rule.description,
      status: rule.status,
    });
    setModalOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();
      createOrUpdateMutation.mutate(values);
    } catch {
      // Form validation error
    }
  };

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const matchSearch =
        !searchText ||
        r.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchText.toLowerCase()));

      const matchType =
        typeFilter === 'ALL' ||
        (typeFilter === 'FIXED' && (r.ruleType === 'FIXED' || r.ruleType === 'LOCATION_TO_LOCATION')) ||
        (typeFilter === 'PER_KM' && r.ruleType === 'PER_KM');

      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;

      const catId = typeof r.vehicleCategoryId === 'object' ? r.vehicleCategoryId?._id : r.vehicleCategoryId;
      const matchCategory = categoryFilter === 'ALL' || catId === categoryFilter;

      return matchSearch && matchType && matchStatus && matchCategory;
    });
  }, [rules, searchText, typeFilter, statusFilter, categoryFilter]);

  // Metrics
  const stats = useMemo(() => {
    const total = rules.length;
    const active = rules.filter(r => r.status === 'ACTIVE').length;
    const fixedRoutes = rules.filter(
      r => (r.ruleType === 'FIXED' || r.ruleType === 'LOCATION_TO_LOCATION') && r.status === 'ACTIVE'
    ).length;
    const perKmRules = rules.filter(r => r.ruleType === 'PER_KM' && r.status === 'ACTIVE').length;
    return { total, active, fixedRoutes, perKmRules };
  }, [rules]);

  // Watched form field for conditional inputs
  const watchedRuleType = Form.useWatch('ruleType', form) || 'FIXED';

  const columns: ColumnsType<PricingRuleItem> = [
    {
      title: 'Route / Rule Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{text}</span>
            {record.isBidirectional && (
              <Tooltip title="Applies both ways (A ⇄ B)">
                <Tag color="cyan" className="m-0 text-xs px-1.5 py-0 flex items-center gap-1">
                  <ArrowLeftRight size={10} /> 2-Way
                </Tag>
              </Tooltip>
            )}
          </div>
          {record.description && (
            <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{record.description}</span>
          )}
        </div>
      ),
    },
    {
      title: 'Location Pair',
      key: 'locations',
      render: (_, record) => {
        const origin = typeof record.originLocationId === 'object' ? record.originLocationId?.name : null;
        const dest = typeof record.destinationLocationId === 'object' ? record.destinationLocationId?.name : null;

        if (origin && dest) {
          return (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="font-medium text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded">
                {origin}
              </span>
              <span className="text-slate-400 font-bold">{record.isBidirectional ? '⇄' : '→'}</span>
              <span className="font-medium text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded">
                {dest}
              </span>
            </div>
          );
        }

        if (origin) {
          return (
            <div className="text-xs text-amber-300 bg-amber-950/40 border border-amber-800/40 px-2 py-0.5 rounded inline-block">
              Origin: {origin}
            </div>
          );
        }

        if (dest) {
          return (
            <div className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 px-2 py-0.5 rounded inline-block">
              Destination: {dest}
            </div>
          );
        }

        return <span className="text-xs text-slate-500 italic">Any Location (Distance based)</span>;
      },
    },
    {
      title: 'Vehicle Type',
      key: 'vehicleCategory',
      render: (_, record) => {
        const cat = typeof record.vehicleCategoryId === 'object' ? record.vehicleCategoryId : null;
        if (cat) {
          return (
            <Tag color="blue" className="font-medium">
              {cat.name}
            </Tag>
          );
        }
        return <Tag color="default">All Vehicles</Tag>;
      },
    },
    {
      title: 'Fare Structure',
      key: 'fare',
      render: (_, record) => {
        if (record.ruleType === 'FIXED' || record.ruleType === 'LOCATION_TO_LOCATION') {
          return (
            <div>
              <div className="font-bold text-emerald-400 text-sm">₹{record.fixedPrice?.toLocaleString('en-IN')}</div>
              {record.includedKm ? (
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Incl. {record.includedKm} km {record.extraKmRate ? `(+₹${record.extraKmRate}/km)` : ''}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 mt-0.5">Flat package rate</div>
              )}
            </div>
          );
        }

        if (record.ruleType === 'PER_KM') {
          return (
            <div>
              <div className="font-bold text-cyan-400 text-sm">₹{record.ratePerKm}/km</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Base: ₹{record.baseFare || 0} (Min {record.minimumKm || 0} km)
              </div>
            </div>
          );
        }

        return <span className="text-slate-400 text-xs">Slab Pricing</span>;
      },
    },
    {
      title: 'Rule Type',
      dataIndex: 'ruleType',
      key: 'ruleType',
      render: (type: string) => {
        if (type === 'FIXED' || type === 'LOCATION_TO_LOCATION') {
          return <Tag color="green">FIXED FARE</Tag>;
        }
        if (type === 'PER_KM') {
          return <Tag color="purple">PER KILOMETER</Tag>;
        }
        return <Tag color="orange">{type}</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record) => (
        <Switch
          checked={status === 'ACTIVE'}
          onChange={checked =>
            toggleStatusMutation.mutate({
              id: record._id,
              status: checked ? 'ACTIVE' : 'INACTIVE',
            })
          }
          checkedChildren="ACTIVE"
          unCheckedChildren="INACTIVE"
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 110,
      render: (_, record) => (
        <Space size="middle">
          <button
            onClick={() => handleOpenEdit(record)}
            className="text-slate-400 hover:text-emerald-400 transition-colors p-1"
            title="Edit Route"
          >
            <Edit3 size={15} />
          </button>
          <Popconfirm
            title="Delete this pricing rule?"
            description="Are you sure you want to permanently delete this route fare?"
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
            onConfirm={() => deleteMutation.mutate(record._id)}
          >
            <button className="text-slate-400 hover:text-rose-400 transition-colors p-1" title="Delete Route">
              <Trash2 size={15} />
            </button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <Route size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 m-0">Fixed Route Fares & Distance Pricing</h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5 m-0">
                Manage fixed fares for selected routes and locations, with automatic kilometer-based fallback.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            icon={<Sparkles size={16} className="text-amber-500" />}
            onClick={() => seedDefaultsMutation.mutate()}
            loading={seedDefaultsMutation.isPending}
            className="border-amber-500/30 text-amber-600 dark:text-amber-300 hover:border-amber-400 bg-amber-500/10 font-medium"
          >
            Seed Popular Temple Routes
          </Button>

          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleOpenCreate}
            className="bg-emerald-600 hover:bg-emerald-500 border-none font-medium"
          >
            Add Fixed Route Fare
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Rules</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{stats.total}</div>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                <Layers size={20} />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fixed Route Fares</div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.fixedRoutes}</div>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                <Route size={20} />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Per-KM Rates</div>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">{stats.perKmRules}</div>
              </div>
              <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                <Car size={20} />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Rules</div>
                <div className="text-2xl font-bold text-teal-600 dark:text-teal-400 mt-1">{stats.active}</div>
              </div>
              <div className="p-3 bg-teal-500/10 text-teal-500 rounded-xl">
                <CheckCircle2 size={20} />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Filter and Search Bar */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="w-full md:w-80">
            <Input
              placeholder="Search routes or locations..."
              prefix={<Search size={16} className="text-slate-400" />}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              allowClear
              className="bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            <Select
              value={typeFilter}
              onChange={setTypeFilter}
              className="w-40"
              options={[
                { value: 'ALL', label: 'All Rule Types' },
                { value: 'FIXED', label: 'Fixed Routes' },
                { value: 'PER_KM', label: 'Per-KM Rates' },
              ]}
            />

            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              className="w-40"
              options={[
                { value: 'ALL', label: 'All Vehicles' },
                ...categories.map(c => ({ value: c._id, label: c.name })),
              ]}
            />

            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-32"
              options={[
                { value: 'ALL', label: 'All Status' },
                { value: 'ACTIVE', label: 'Active Only' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />

            <Button icon={<RefreshCw size={14} />} onClick={() => refetch()} title="Refresh table" />
          </div>
        </div>
      </Card>

      {/* Rules Table */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm p-0 overflow-hidden">
        <Table
          columns={columns}
          dataSource={filteredRules}
          rowKey="_id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `Total ${t} routes` }}
          className="admin-pricing-table"
        />
      </Card>

      {/* Info Callout */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
        <Info size={18} className="text-emerald-500 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">How Fare Matching Works: </span>
          When a passenger or dispatcher books a ride, the system first looks for an active{' '}
          <strong className="text-emerald-600 dark:text-emerald-300">Fixed Fare Route</strong> matching the Origin and Destination (either direction if 2-Way is enabled).
          If no fixed route matches, the fare is automatically{' '}
          <strong className="text-cyan-600 dark:text-cyan-300">calculated based on distance (kilometers)</strong> using the vehicle type's base fare and per-km rate.
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        title={
          <div className="flex items-center gap-2 text-slate-100">
            <Route size={18} className="text-emerald-400" />
            <span>{editingRule ? 'Edit Route Fare' : 'Create Fixed Route Fare'}</span>
          </div>
        }
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setEditingRule(null);
        }}
        onOk={handleFormSubmit}
        confirmLoading={createOrUpdateMutation.isPending}
        okText={editingRule ? 'Save Changes' : 'Create Route Fare'}
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Route / Rule Name"
            rules={[{ required: true, message: 'Please enter route name' }]}
            tooltip="Descriptive name shown on dispatch tickets and booking screens"
          >
            <Input placeholder="e.g. Kollur Temple ⇄ Byndoor Railway Station" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="ruleType" label="Pricing Mode" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'FIXED', label: 'Fixed Route / Flat Fare' },
                    { value: 'PER_KM', label: 'Per-Kilometer Distance Rate' },
                  ]}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="vehicleCategoryId" label="Applicable Vehicle Type">
                <Select
                  placeholder="All Vehicles (Universal)"
                  allowClear
                  options={[
                    { value: '', label: 'All Vehicles' },
                    ...categories.map(c => ({ value: c._id, label: `${c.name} (${c.code})` })),
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="originLocationId"
                label="Origin Location / Stand"
                tooltip="Starting pickup point for this route"
              >
                <Select
                  placeholder="Select Origin (or Any)"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={locations.map(l => ({
                    value: l._id,
                    label: `${l.name} (${l.address?.city || 'Local'})`,
                  }))}
                />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                name="destinationLocationId"
                label="Destination Location / Stand"
                tooltip="Drop-off point for this route"
              >
                <Select
                  placeholder="Select Destination (or Any)"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={locations.map(l => ({
                    value: l._id,
                    label: `${l.name} (${l.address?.city || 'Local'})`,
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="isBidirectional"
                label="Two-Way Route (Bidirectional)"
                valuePropName="checked"
                tooltip="When enabled, the fixed fare applies equally for Origin → Destination and Destination → Origin"
              >
                <Switch checkedChildren="2-Way (Both directions)" unCheckedChildren="1-Way Only" />
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item name="priority" label="Priority (1-100)" tooltip="Lower number takes precedence if multiple rules match">
                <InputNumber min={1} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Divider className="my-3 border-slate-800" />

          {watchedRuleType === 'FIXED' ? (
            <>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="fixedPrice"
                    label="Fixed Fare Amount (₹)"
                    rules={[{ required: true, message: 'Enter fixed fare amount' }]}
                    tooltip="Total fixed fare charged for this selected route"
                  >
                    <InputNumber
                      prefix="₹"
                      min={0}
                      step={50}
                      placeholder="e.g. 800"
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="includedKm"
                    label="Included Distance (Optional KM)"
                    tooltip="If trip distance exceeds this limit, extra km rate will be added. Leave empty or 0 for unlimited fixed fare."
                  >
                    <InputNumber min={0} placeholder="e.g. 35" addonAfter="KM" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="extraKmRate"
                    label="Extra KM Rate (₹/km)"
                    tooltip="Charged for kilometers beyond the included distance package"
                  >
                    <InputNumber prefix="₹" min={0} placeholder="e.g. 18" addonAfter="/km" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="status" label="Active Status">
                    <Select
                      options={[
                        { value: 'ACTIVE', label: 'Active (Enabled)' },
                        { value: 'INACTIVE', label: 'Inactive (Disabled)' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </>
          ) : (
            <>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="ratePerKm" label="Rate Per KM (₹)" rules={[{ required: true }]}>
                    <InputNumber prefix="₹" min={0} step={1} placeholder="e.g. 18" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="baseFare" label="Base / Flag Fare (₹)">
                    <InputNumber prefix="₹" min={0} step={10} placeholder="e.g. 100" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="minimumKm" label="Minimum KM">
                    <InputNumber min={0} placeholder="e.g. 5" addonAfter="KM" style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          <Form.Item name="description" label="Notes / Description">
            <Input.TextArea rows={2} placeholder="Optional operational notes or route landmark instructions" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
