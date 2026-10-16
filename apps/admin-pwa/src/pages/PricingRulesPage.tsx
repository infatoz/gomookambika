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
  Drawer,
  Segmented,
  Badge,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Route,
  ArrowLeftRight,
  Plus,
  Search,
  Trash2,
  Edit3,
  CheckCircle2,
  Car,
  RefreshCw,
  Info,
  Layers,
  Calculator,
  Copy,
  Sparkles,
  Clock,
  ShieldCheck,
  Moon,
  Coins,
  Percent,
  Check,
  Zap,
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
  roundTripPrice?: number;
  tollIncluded?: boolean;
  parkingIncluded?: boolean;
  freeWaitingMinutes?: number;
  nightChargeMultiplier?: number;
  estimatedDurationMinutes?: number;
  tags?: string[];
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
  const [calcForm] = Form.useForm();

  // Filters state
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal & Drawer state
  const [modalOpen, setModalOpen] = useState(false);
  const [calcDrawerOpen, setCalcDrawerOpen] = useState(false);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRuleItem | null>(null);

  // Multi-Vehicle Category & Priority Rules State
  const [vehicleMode, setVehicleMode] = useState<'SINGLE' | 'MULTI'>('SINGLE');
  const [multiCategoryRules, setMultiCategoryRules] = useState<Array<{
    key: string;
    vehicleCategoryId: string;
    priority: number;
    fixedPrice: number | null;
    roundTripPrice: number | null;
    includedKm?: number;
    extraKmRate?: number;
  }>>([]);

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

  // Multi-Category Helper Methods
  const autoFillAllCategories = (baseFixedPrice = 800) => {
    if (!categories || categories.length === 0) {
      toast.error('No vehicle categories found to populate');
      return;
    }
    const generated = categories.map((cat, idx) => ({
      key: cat._id,
      vehicleCategoryId: cat._id,
      priority: 10 + idx * 5,
      fixedPrice: Math.round((baseFixedPrice * (1 + idx * 0.35)) / 50) * 50,
      roundTripPrice: Math.round((baseFixedPrice * (1 + idx * 0.35) * 1.8) / 50) * 50,
      includedKm: 40,
      extraKmRate: 16 + idx * 4,
    }));
    setMultiCategoryRules(generated);
    toast.success(`Populated ${generated.length} vehicle categories with priority rules`);
  };

  const addCategoryRuleRow = () => {
    const existingCatIds = new Set(multiCategoryRules.map(r => r.vehicleCategoryId));
    const availableCat = categories.find(c => !existingCatIds.has(c._id)) || categories[0];
    if (!availableCat) {
      toast.error('All available vehicle categories are already added');
      return;
    }
    const nextPriority = multiCategoryRules.length > 0
      ? Math.max(...multiCategoryRules.map(r => r.priority || 15)) + 5
      : 15;

    setMultiCategoryRules(prev => [
      ...prev,
      {
        key: `cat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        vehicleCategoryId: availableCat._id,
        priority: nextPriority,
        fixedPrice: null,
        roundTripPrice: null,
        includedKm: 40,
        extraKmRate: 18,
      },
    ]);
  };

  const updateCategoryRuleRow = (key: string, field: string, val: any) => {
    setMultiCategoryRules(prev =>
      prev.map(r => (r.key === key ? { ...r, [field]: val } : r))
    );
  };

  const removeCategoryRuleRow = (key: string) => {
    setMultiCategoryRules(prev => prev.filter(r => r.key !== key));
  };

  const handleSwitchVehicleMode = (mode: 'SINGLE' | 'MULTI') => {
    setVehicleMode(mode);
    if (mode === 'MULTI' && multiCategoryRules.length === 0 && categories.length > 0) {
      const baseP = form.getFieldValue('fixedPrice') || 800;
      autoFillAllCategories(baseP);
    }
  };

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingRule(null);
    setVehicleMode('SINGLE');
    setMultiCategoryRules([]);
    form.resetFields();
    form.setFieldsValue({
      ruleType: 'FIXED',
      isBidirectional: true,
      priority: 15,
      status: 'ACTIVE',
      tripType: 'ONE_WAY',
      tollIncluded: false,
      parkingIncluded: false,
      freeWaitingMinutes: 0,
      nightChargeMultiplier: 1.0,
      includedKm: 40,
      extraKmRate: 18,
    });
    setModalOpen(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (rule: PricingRuleItem) => {
    setEditingRule(rule);
    setVehicleMode('SINGLE');
    setMultiCategoryRules([]);
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
      roundTripPrice: rule.roundTripPrice,
      tollIncluded: Boolean(rule.tollIncluded),
      parkingIncluded: Boolean(rule.parkingIncluded),
      freeWaitingMinutes: rule.freeWaitingMinutes ?? 0,
      nightChargeMultiplier: rule.nightChargeMultiplier ?? 1.0,
      estimatedDurationMinutes: rule.estimatedDurationMinutes,
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

  // Duplicate / Clone a Rule
  const handleDuplicate = (rule: PricingRuleItem) => {
    setEditingRule(null);
    setVehicleMode('SINGLE');
    setMultiCategoryRules([]);
    form.resetFields();
    form.setFieldsValue({
      name: `${rule.name} (Copy)`,
      ruleType: rule.ruleType,
      priority: Math.min(100, (rule.priority || 50) + 1),
      vehicleCategoryId: typeof rule.vehicleCategoryId === 'object' ? rule.vehicleCategoryId?._id : rule.vehicleCategoryId,
      originLocationId: typeof rule.originLocationId === 'object' ? rule.originLocationId?._id : rule.originLocationId,
      destinationLocationId: typeof rule.destinationLocationId === 'object' ? rule.destinationLocationId?._id : rule.destinationLocationId,
      isBidirectional: rule.isBidirectional !== false,
      tripType: rule.tripType || 'ONE_WAY',
      fixedPrice: rule.fixedPrice,
      roundTripPrice: rule.roundTripPrice,
      tollIncluded: Boolean(rule.tollIncluded),
      parkingIncluded: Boolean(rule.parkingIncluded),
      freeWaitingMinutes: rule.freeWaitingMinutes ?? 0,
      nightChargeMultiplier: rule.nightChargeMultiplier ?? 1.0,
      estimatedDurationMinutes: rule.estimatedDurationMinutes,
      baseFare: rule.baseFare,
      minimumKm: rule.minimumKm,
      ratePerKm: rule.ratePerKm,
      includedKm: rule.includedKm,
      extraKmRate: rule.extraKmRate,
      description: rule.description,
      status: 'ACTIVE',
    });
    setModalOpen(true);
    toast.success('Cloned route configuration. Make adjustments and save.');
  };

  const handleFormSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Handle multi-category creation
      if (!editingRule && watchedRuleType === 'FIXED' && vehicleMode === 'MULTI') {
        if (multiCategoryRules.length === 0) {
          toast.error('Please configure at least one vehicle category or switch back to single category mode');
          return;
        }

        for (const r of multiCategoryRules) {
          if (!r.vehicleCategoryId) {
            toast.error('Please select a valid vehicle category for each row in the matrix');
            return;
          }
          if (r.fixedPrice === null || r.fixedPrice === undefined || r.fixedPrice < 0) {
            const catName = categories.find(c => c._id === r.vehicleCategoryId)?.name || 'Category';
            toast.error(`Please enter a valid one-way fixed fare for ${catName}`);
            return;
          }
        }

        createOrUpdateMutation.mutate({
          ...values,
          vehicleCategoryRules: multiCategoryRules.map(r => ({
            vehicleCategoryId: r.vehicleCategoryId,
            priority: r.priority,
            fixedPrice: r.fixedPrice,
            roundTripPrice: r.roundTripPrice,
            includedKm: r.includedKm,
            extraKmRate: r.extraKmRate,
          })),
        });
        return;
      }

      createOrUpdateMutation.mutate(values);
    } catch {
      // Form validation error
    }
  };

  // Auto-generate route title from selected locations
  const handleAutoGenerateTitle = () => {
    const origId = form.getFieldValue('originLocationId');
    const destId = form.getFieldValue('destinationLocationId');
    const is2Way = form.getFieldValue('isBidirectional') !== false;

    const origLoc = locations.find(l => l._id === origId);
    const destLoc = locations.find(l => l._id === destId);

    if (origLoc && destLoc) {
      const arrow = is2Way ? '⇄' : '→';
      const autoName = `${origLoc.name} ${arrow} ${destLoc.name}`;
      form.setFieldsValue({ name: autoName });
      toast.success('Route title auto-generated!');
    } else {
      toast.error('Please select both Origin and Destination first');
    }
  };

  // Run Test Fare Calculation
  const handleRunTestCalc = async (values?: any) => {
    const vals = values || calcForm.getFieldsValue();
    try {
      setCalcLoading(true);
      const res = await apiClient.post('/admin/pricing-rules/test-calculator', vals);
      setCalcResult(res.data?.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Calculation failed');
    } finally {
      setCalcLoading(false);
    }
  };

  // Open Diagnostic Calculator with prefilled route
  const handleOpenCalculatorWithRule = (rule: PricingRuleItem) => {
    const origId = typeof rule.originLocationId === 'object' ? rule.originLocationId?._id : rule.originLocationId;
    const destId = typeof rule.destinationLocationId === 'object' ? rule.destinationLocationId?._id : rule.destinationLocationId;
    const catId = typeof rule.vehicleCategoryId === 'object' ? rule.vehicleCategoryId?._id : rule.vehicleCategoryId;

    calcForm.setFieldsValue({
      originLocationId: origId || undefined,
      destinationLocationId: destId || undefined,
      vehicleCategoryId: catId || categories[0]?._id,
      tripType: rule.tripType || 'ONE_WAY',
      customDistanceKm: rule.includedKm || 25,
      waitingMinutes: 0,
      hasToll: false,
      hasParking: false,
      isNightTime: false,
    });
    setCalcDrawerOpen(true);
    handleRunTestCalc({
      originLocationId: origId || undefined,
      destinationLocationId: destId || undefined,
      vehicleCategoryId: catId || categories[0]?._id,
      tripType: rule.tripType || 'ONE_WAY',
      customDistanceKm: rule.includedKm || 25,
    });
  };

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const matchSearch =
        !searchText ||
        r.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(searchText.toLowerCase()));

      let matchTab = true;
      if (activeTab === 'FIXED') {
        matchTab = r.ruleType === 'FIXED' || r.ruleType === 'LOCATION_TO_LOCATION';
      } else if (activeTab === 'PER_KM') {
        matchTab = r.ruleType === 'PER_KM';
      } else if (activeTab === 'ACTIVE') {
        matchTab = r.status === 'ACTIVE';
      }

      const matchStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const catId = typeof r.vehicleCategoryId === 'object' ? r.vehicleCategoryId?._id : r.vehicleCategoryId;
      const matchCategory = categoryFilter === 'ALL' || catId === categoryFilter;

      return matchSearch && matchTab && matchStatus && matchCategory;
    });
  }, [rules, searchText, activeTab, statusFilter, categoryFilter]);

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
  const watchedFixedPrice = Form.useWatch('fixedPrice', form);
  const watchedRoundTripPrice = Form.useWatch('roundTripPrice', form);
  const watchedTollIncluded = Form.useWatch('tollIncluded', form);
  const watchedFreeWaiting = Form.useWatch('freeWaitingMinutes', form);

  const columns: ColumnsType<PricingRuleItem> = [
    {
      title: 'Route / Package Details',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record) => (
        <div className="flex flex-col gap-1 min-w-[220px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{text}</span>
            {record.isBidirectional && (
              <Tooltip title="Applies both ways: Origin ⇄ Destination">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-1.5 py-0.5 rounded-full">
                  <ArrowLeftRight size={10} /> 2-Way
                </span>
              </Tooltip>
            )}
            <span className="text-[10px] font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              P-{record.priority}
            </span>
          </div>

          {record.description && (
            <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">{record.description}</span>
          )}

          {/* Extended Business Logic Inclusions Tags */}
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {record.tollIncluded && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.2 rounded">
                <ShieldCheck size={10} /> Tolls Included
              </span>
            )}
            {record.parkingIncluded && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.2 rounded">
                🅿️ Parking Included
              </span>
            )}
            {record.freeWaitingMinutes && record.freeWaitingMinutes > 0 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-1.5 py-0.2 rounded">
                <Clock size={10} /> {record.freeWaitingMinutes}m Free Wait
              </span>
            ) : null}
            {record.nightChargeMultiplier === 1.0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-1.5 py-0.2 rounded">
                <Moon size={10} /> No Night Surcharge
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Location Route Flow',
      key: 'locations',
      render: (_, record) => {
        const origin = typeof record.originLocationId === 'object' ? record.originLocationId?.name : null;
        const dest = typeof record.destinationLocationId === 'object' ? record.destinationLocationId?.name : null;

        if (origin && dest) {
          return (
            <div className="flex items-center gap-1.5 text-xs flex-wrap">
              <span className="font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-lg shadow-xs">
                {origin}
              </span>
              <span className="text-slate-500 font-bold px-0.5">{record.isBidirectional ? '⇄' : '→'}</span>
              <span className="font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-lg shadow-xs">
                {dest}
              </span>
            </div>
          );
        }

        if (origin) {
          return (
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2 py-0.5 rounded-lg inline-block">
              Origin: {origin}
            </div>
          );
        }

        if (dest) {
          return (
            <div className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-lg inline-block">
              Destination: {dest}
            </div>
          );
        }

        return <span className="text-xs text-slate-500 italic">Dynamic Geodesic Distance Meter</span>;
      },
    },
    {
      title: 'Vehicle',
      key: 'vehicleCategory',
      render: (_, record) => {
        const cat = typeof record.vehicleCategoryId === 'object' ? record.vehicleCategoryId : null;
        if (cat) {
          return (
            <Tag color="blue" className="font-semibold px-2 py-0.5 rounded-md">
              <Car size={11} className="inline mr-1" /> {cat.name}
            </Tag>
          );
        }
        return <Tag color="default">All Vehicles</Tag>;
      },
    },
    {
      title: 'Fare Structure & Rates',
      key: 'fare',
      render: (_, record) => {
        if (record.ruleType === 'FIXED' || record.ruleType === 'LOCATION_TO_LOCATION') {
          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-base">
                  ₹{record.fixedPrice?.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase">One-Way</span>
              </div>

              {record.roundTripPrice ? (
                <div className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                  <span>Round Trip: ₹{record.roundTripPrice.toLocaleString('en-IN')}</span>
                  {record.fixedPrice && record.roundTripPrice < record.fixedPrice * 2 && (
                    <span className="text-[10px] font-normal text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1 rounded">
                      Save ₹{record.fixedPrice * 2 - record.roundTripPrice}
                    </span>
                  )}
                </div>
              ) : null}

              {record.includedKm ? (
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Incl. {record.includedKm} km {record.extraKmRate ? `(+₹${record.extraKmRate}/km)` : ''}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">Guaranteed Flat Rate</div>
              )}
            </div>
          );
        }

        if (record.ruleType === 'PER_KM') {
          return (
            <div>
              <div className="font-bold text-cyan-600 dark:text-cyan-400 text-base">₹{record.ratePerKm}/km</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Base Flag: ₹{record.baseFare || 0} (Min {record.minimumKm || 0} km)
              </div>
            </div>
          );
        }

        return <span className="text-slate-500 text-xs font-medium">Slab Range Tariff</span>;
      },
    },
    {
      title: 'Pricing Type',
      dataIndex: 'ruleType',
      key: 'ruleType',
      render: (type: string) => {
        if (type === 'FIXED' || type === 'LOCATION_TO_LOCATION') {
          return <Tag color="green" className="font-bold">FIXED ROUTE</Tag>;
        }
        if (type === 'PER_KM') {
          return <Tag color="purple" className="font-bold">DISTANCE METER</Tag>;
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
      width: 140,
      render: (_, record) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleOpenCalculatorWithRule(record)}
            className="text-slate-400 hover:text-emerald-500 transition-colors p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg"
            title="Test Fare Calculation"
          >
            <Calculator size={15} />
          </button>
          <button
            onClick={() => handleDuplicate(record)}
            className="text-slate-400 hover:text-indigo-500 transition-colors p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg"
            title="Duplicate / Clone Route"
          >
            <Copy size={15} />
          </button>
          <button
            onClick={() => handleOpenEdit(record)}
            className="text-slate-400 hover:text-blue-500 transition-colors p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg"
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
            <button className="text-slate-400 hover:text-rose-500 transition-colors p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg" title="Delete Route">
              <Trash2 size={15} />
            </button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <Route size={26} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 m-0">Fixed Route Fares & Distance Pricing</h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 m-0">
                Configure guaranteed flat tariffs for temple, station & airport corridors, with fallback distance meter calculation.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            icon={<Calculator size={16} />}
            onClick={() => {
              setCalcDrawerOpen(true);
              if (!calcResult && categories.length > 0) {
                calcForm.setFieldsValue({
                  vehicleCategoryId: categories[0]._id,
                  tripType: 'ONE_WAY',
                  customDistanceKm: 25,
                });
                handleRunTestCalc({
                  vehicleCategoryId: categories[0]._id,
                  tripType: 'ONE_WAY',
                  customDistanceKm: 25,
                });
              }
            }}
            className="font-medium flex items-center gap-1.5"
          >
            Test Fare Calculator
          </Button>

          <Button
            type="primary"
            icon={<Plus size={16} />}
            onClick={handleOpenCreate}
            className="bg-emerald-600 hover:bg-emerald-500 border-none font-bold flex items-center gap-1.5 shadow-sm"
          >
            Add Fixed Route Fare
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-xs rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Rules</div>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{stats.total}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">Across all locations</div>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl">
                <Layers size={22} />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-xs rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fixed Route Packages</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{stats.fixedRoutes}</div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">Guaranteed flat tariffs</div>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl">
                <Route size={22} />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-xs rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Per-KM Meter Rates</div>
                <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{stats.perKmRules}</div>
                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium mt-0.5">Distance meter rules</div>
              </div>
              <div className="p-3 bg-purple-500/10 text-purple-500 rounded-2xl">
                <Car size={22} />
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-xs rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Rules</div>
                <div className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">{stats.active}</div>
                <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">Live on customer app</div>
              </div>
              <div className="p-3 bg-teal-500/10 text-teal-500 rounded-2xl">
                <CheckCircle2 size={22} />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Filter and Search Bar */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl p-2">
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
            <Segmented
              value={activeTab}
              onChange={val => setActiveTab(val as string)}
              options={[
                { label: 'All Rules', value: 'ALL' },
                { label: `Fixed Routes (${stats.fixedRoutes})`, value: 'FIXED' },
                { label: `Per-KM Rates (${stats.perKmRules})`, value: 'PER_KM' },
                { label: 'Active Only', value: 'ACTIVE' },
              ]}
              className="bg-slate-100 dark:bg-slate-800 p-1 font-semibold text-xs"
            />
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap justify-end">
            <div className="w-full sm:w-64">
              <Input
                placeholder="Search route names..."
                prefix={<Search size={15} className="text-slate-400" />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                allowClear
                className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 rounded-xl text-xs"
              />
            </div>

            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              className="w-36"
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
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
              ]}
            />

            <Button icon={<RefreshCw size={14} />} onClick={() => refetch()} title="Refresh table" />
          </div>
        </div>
      </Card>

      {/* Rules Table */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs rounded-2xl overflow-hidden p-0">
        <Table
          columns={columns}
          dataSource={filteredRules}
          rowKey="_id"
          loading={isLoading}
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: t => `Total ${t} routes configured` }}
          className="admin-pricing-table"
        />
      </Card>

      {/* How Fare Matching Works Callout */}
      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-4 flex items-start gap-3.5 text-xs text-slate-700 dark:text-slate-300">
        <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-xl shrink-0 mt-0.5">
          <Info size={18} />
        </div>
        <div className="space-y-1">
          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
            Intelligent Fare Execution Hierarchy
          </div>
          <p className="m-0 leading-relaxed text-slate-600 dark:text-slate-400">
            1. <strong>Direct Fixed Route:</strong> Matches exact Origin & Destination location pair (bidirectionally if 2-Way is checked). Bundled perks like free waiting time, included tolls, and round-trip package rates automatically apply.
            <br />
            2. <strong>Hub / Stand Flat Fare:</strong> Matches a specific origin or destination stand (e.g. Mangalore Airport transfer).
            <br />
            3. <strong>Automatic Distance Calculation Fallback:</strong> If no fixed route matches, fare is calculated based strictly on kilometers driven using the vehicle category's base rate and per-km pricing.
          </p>
        </div>
      </div>

      {/* ─── CREATE / EDIT MODAL ─── */}
      <Modal
        title={
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Route size={18} />
            </div>
            <div>
              <div className="text-base font-black text-slate-900 dark:text-slate-100">
                {editingRule ? 'Edit Fixed Route / Pricing Rule' : 'Create Fixed Route Fare'}
              </div>
              <div className="text-xs font-normal text-slate-500">
                Configure route corridors, flat tariffs, concessions, and included perks
              </div>
            </div>
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
        okText={editingRule ? 'Save Changes' : 'Create Route Package'}
        width={880}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4 space-y-4">
          {/* Section 1: Route & Name */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Route size={13} className="text-emerald-500" /> 1. Route Endpoints & Direction
              </span>
              <button
                type="button"
                onClick={handleAutoGenerateTitle}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Sparkles size={12} /> Auto-Generate Name
              </button>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="originLocationId"
                  label="Origin Location / Stand"
                  tooltip="Starting pickup point for this fixed route"
                >
                  <Select
                    placeholder="Select Origin (or Any for distance rule)"
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
                  tooltip="Drop-off point for this fixed route"
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

            <Form.Item
              name="name"
              label="Route / Rule Display Name"
              rules={[{ required: true, message: 'Please enter route name' }]}
              tooltip="Descriptive name shown to customers and dispatchers"
            >
              <Input placeholder="e.g. Kollur Temple ⇄ Byndoor Railway Station" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="isBidirectional"
                  label="Two-Way Route (Bidirectional)"
                  valuePropName="checked"
                  tooltip="When enabled, fixed fare applies equally for Origin → Destination and Destination → Origin"
                >
                  <Switch checkedChildren="2-Way (Both directions)" unCheckedChildren="1-Way Only" />
                </Form.Item>
              </Col>

              <Col span={12}>
                <Form.Item name="estimatedDurationMinutes" label="Est. Travel Duration (Minutes)">
                  <InputNumber min={5} max={600} placeholder="e.g. 45" addonAfter="mins" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          </div>

          {/* Section 2: Applicable Vehicle & Mode */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Car size={13} className="text-blue-500" /> 2. Vehicle & Priority Rule
              </span>
              {!editingRule && watchedRuleType === 'FIXED' && (
                <Segmented
                  size="small"
                  value={vehicleMode}
                  onChange={val => handleSwitchVehicleMode(val as 'SINGLE' | 'MULTI')}
                  options={[
                    { label: 'Single Vehicle Category', value: 'SINGLE' },
                    { label: '✨ Multiple Vehicle & Priority Rules', value: 'MULTI' },
                  ]}
                  className="bg-slate-200/80 dark:bg-slate-800"
                />
              )}
            </div>

            <Row gutter={16}>
              <Col span={vehicleMode === 'MULTI' ? 24 : 8}>
                <Form.Item name="ruleType" label="Pricing Mode" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { value: 'FIXED', label: 'Fixed Route Flat Rate' },
                      { value: 'PER_KM', label: 'Per-KM Distance Meter' },
                    ]}
                  />
                </Form.Item>
              </Col>

              {vehicleMode === 'SINGLE' && (
                <>
                  <Col span={8}>
                    <Form.Item name="vehicleCategoryId" label="Vehicle Category">
                      <Select
                        placeholder="All Vehicles (Universal)"
                        allowClear
                        options={[
                          { value: '', label: 'All Vehicles (Universal)' },
                          ...categories.map(c => ({ value: c._id, label: `${c.name} (${c.code})` })),
                        ]}
                      />
                    </Form.Item>
                  </Col>

                  <Col span={8}>
                    <Form.Item name="priority" label="Priority (1-100)" tooltip="Lower number takes precedence if multiple rules match">
                      <InputNumber min={1} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </>
              )}
            </Row>

            {/* Multiple Vehicle Categories & Priority Rules Matrix */}
            {!editingRule && watchedRuleType === 'FIXED' && vehicleMode === 'MULTI' && (
              <div className="mt-2 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">
                    Set custom flat fares and priority rules per vehicle category for this route:
                  </span>
                  <Space size={8}>
                    <Button
                      size="small"
                      icon={<Sparkles size={12} className="text-amber-500" />}
                      onClick={() => autoFillAllCategories(form.getFieldValue('fixedPrice') || 800)}
                    >
                      Auto-Fill All Categories
                    </Button>
                    <Button
                      size="small"
                      type="dashed"
                      icon={<Plus size={12} />}
                      onClick={addCategoryRuleRow}
                    >
                      Add Category Row
                    </Button>
                  </Space>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="p-2.5 min-w-[170px]">Vehicle Category</th>
                          <th className="p-2.5 w-24">Priority *</th>
                          <th className="p-2.5 w-36">One-Way Fare (₹) *</th>
                          <th className="p-2.5 w-36">Round-Trip Fare (₹)</th>
                          <th className="p-2.5 w-28">Included KM</th>
                          <th className="p-2.5 w-28">Extra ₹/KM</th>
                          <th className="p-2.5 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {multiCategoryRules.map((row) => (
                          <tr key={row.key} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                            <td className="p-2">
                              <Select
                                value={row.vehicleCategoryId}
                                onChange={v => updateCategoryRuleRow(row.key, 'vehicleCategoryId', v)}
                                style={{ width: '100%' }}
                                options={categories.map(c => ({
                                  value: c._id,
                                  label: `${c.name} (${c.code || 'Cab'})`,
                                }))}
                              />
                            </td>
                            <td className="p-2">
                              <Tooltip title="Evaluation priority (1-100). Lower number = higher precedence.">
                                <InputNumber
                                  min={1}
                                  max={100}
                                  value={row.priority}
                                  onChange={v => updateCategoryRuleRow(row.key, 'priority', v || 15)}
                                  style={{ width: '100%' }}
                                />
                              </Tooltip>
                            </td>
                            <td className="p-2">
                              <InputNumber
                                prefix="₹"
                                min={0}
                                step={50}
                                placeholder="e.g. 800"
                                value={row.fixedPrice}
                                onChange={v => updateCategoryRuleRow(row.key, 'fixedPrice', v)}
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td className="p-2">
                              <InputNumber
                                prefix="₹"
                                min={0}
                                step={50}
                                placeholder="e.g. 1400"
                                value={row.roundTripPrice}
                                onChange={v => updateCategoryRuleRow(row.key, 'roundTripPrice', v)}
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td className="p-2">
                              <InputNumber
                                min={0}
                                placeholder="40"
                                addonAfter="KM"
                                value={row.includedKm}
                                onChange={v => updateCategoryRuleRow(row.key, 'includedKm', v)}
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td className="p-2">
                              <InputNumber
                                prefix="₹"
                                min={0}
                                placeholder="18"
                                addonAfter="/km"
                                value={row.extraKmRate}
                                onChange={v => updateCategoryRuleRow(row.key, 'extraKmRate', v)}
                                style={{ width: '100%' }}
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Button
                                type="text"
                                danger
                                size="small"
                                icon={<Trash2 size={13} />}
                                onClick={() => removeCategoryRuleRow(row.key)}
                                disabled={multiCategoryRules.length <= 1}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Pricing Structure & Extended Business Logic */}
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Coins size={13} className="text-amber-500" /> 3. Fare Structure & Inclusions
            </span>

            {watchedRuleType === 'FIXED' ? (
              <>
                {vehicleMode === 'SINGLE' ? (
                  <>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="fixedPrice"
                          label="One-Way Flat Fare (₹)"
                          rules={[{ required: true, message: 'Enter fixed fare amount' }]}
                          tooltip="Total flat rate charged for single trip"
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
                          name="roundTripPrice"
                          label="Round-Trip Package Fare (Optional ₹)"
                          tooltip="Special flat rate for return trips. If left empty, a standard discounted 1.8x package will apply."
                        >
                          <InputNumber
                            prefix="₹"
                            min={0}
                            step={50}
                            placeholder="e.g. 1400"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item
                          name="includedKm"
                          label="Included Distance Package (KM)"
                          tooltip="Kilometers included in this fixed tariff. Beyond this, extra km rate applies."
                        >
                          <InputNumber min={0} placeholder="e.g. 35" addonAfter="KM" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>

                      <Col span={12}>
                        <Form.Item
                          name="extraKmRate"
                          label="Extra KM Rate (₹/km)"
                          tooltip="Charged per km beyond the included package distance"
                        >
                          <InputNumber prefix="₹" min={0} placeholder="e.g. 18" addonAfter="/km" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                ) : (
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300">
                    ℹ️ Specific flat fares and priority rules have been defined in the vehicle matrix above for each category. Common route concessions and inclusions below will apply across all configured vehicles.
                  </div>
                )}

                {/* Extended Business Logic Perks & Policies */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Extended Route Inclusions & Concessions:
                  </div>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="tollIncluded"
                        label="Toll Taxes Included in Fare"
                        valuePropName="checked"
                        tooltip="If checked, passenger will not be charged extra toll fees"
                      >
                        <Switch checkedChildren="Included" unCheckedChildren="Extra" />
                      </Form.Item>
                    </Col>

                    <Col span={12}>
                      <Form.Item
                        name="parkingIncluded"
                        label="Parking Fee Included"
                        valuePropName="checked"
                        tooltip="If checked, airport/railway parking is bundled into the fare"
                      >
                        <Switch checkedChildren="Included" unCheckedChildren="Extra" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="freeWaitingMinutes"
                        label="Complimentary Waiting Time"
                        tooltip="Free waiting minutes granted before driver waiting charges apply"
                      >
                        <InputNumber min={0} max={180} step={15} placeholder="0" addonAfter="mins free" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>

                    <Col span={12}>
                      <Form.Item
                        name="nightChargeMultiplier"
                        label="Night Surcharge Multiplier"
                        tooltip="Set 1.0 to waive night surcharge completely for this route"
                      >
                        <Select
                          options={[
                            { value: 1.0, label: '1.0x (No Night Surcharge — Waived)' },
                            { value: 1.15, label: '1.15x (+15% Night Surcharge)' },
                            { value: 1.25, label: '1.25x (+25% Standard Night Surcharge)' },
                          ]}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </div>
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
                    <Form.Item name="minimumKm" label="Minimum Distance">
                      <InputNumber min={0} placeholder="e.g. 5" addonAfter="KM" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            )}

            <Form.Item name="description" label="Operational Notes / Passenger Guidelines">
              <Input.TextArea rows={2} placeholder="e.g. Includes temple toll pass and direct pickup from station porch." />
            </Form.Item>
          </div>

          {/* Live Preview Card */}
          {watchedRuleType === 'FIXED' && (
            <>
              {vehicleMode === 'SINGLE' && watchedFixedPrice && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={11} /> Live Customer Tariff Preview
                    </span>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      One-Way: ₹{watchedFixedPrice} {watchedRoundTripPrice ? `• Round Trip: ₹${watchedRoundTripPrice}` : ''}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                      {watchedTollIncluded && <span>✓ Tolls Included</span>}
                      {watchedFreeWaiting > 0 && <span>✓ {watchedFreeWaiting}m Free Waiting</span>}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl shadow-xs border border-emerald-200 dark:border-emerald-800">
                    Guaranteed Fixed Fare
                  </span>
                </div>
              )}

              {vehicleMode === 'MULTI' && multiCategoryRules.some(r => r.fixedPrice) && (
                <div className="p-3.5 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={11} /> Multi-Vehicle Route Configuration Preview
                    </span>
                    <span className="text-xs font-bold text-emerald-600 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      {multiCategoryRules.filter(r => r.fixedPrice).length} Categories Configured
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {multiCategoryRules.filter(r => r.fixedPrice).map(r => {
                      const cat = categories.find(c => c._id === r.vehicleCategoryId);
                      return (
                        <div
                          key={r.key}
                          className="bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs shadow-xs"
                        >
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{cat?.name || 'Cab'}:</span>{' '}
                          <span className="font-bold text-emerald-600">₹{r.fixedPrice}</span>
                          {r.roundTripPrice ? <span className="text-slate-400"> (RT: ₹{r.roundTripPrice})</span> : ''}{' '}
                          <span className="font-mono text-[10px] text-blue-600 bg-blue-50 dark:bg-blue-950 px-1 py-0.5 rounded ml-1">
                            P-{r.priority}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </Form>
      </Modal>

      {/* ─── TEST FARE CALCULATOR DRAWER ─── */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <Calculator size={18} className="text-emerald-500" />
            <span className="font-bold">Live Fare Diagnostic Calculator</span>
          </div>
        }
        placement="right"
        size={480}
        onClose={() => setCalcDrawerOpen(false)}
        open={calcDrawerOpen}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 m-0">
            Simulate booking requests to test how your Fixed Route Fares and Distance Rules interact in real-time.
          </p>

          <Form form={calcForm} layout="vertical" onValuesChange={(_, all) => handleRunTestCalc(all)}>
            <Form.Item name="originLocationId" label="Origin Point / Stand">
              <Select
                placeholder="Select Origin (Optional)"
                allowClear
                options={locations.map(l => ({ value: l._id, label: l.name }))}
              />
            </Form.Item>

            <Form.Item name="destinationLocationId" label="Destination Point / Stand">
              <Select
                placeholder="Select Destination (Optional)"
                allowClear
                options={locations.map(l => ({ value: l._id, label: l.name }))}
              />
            </Form.Item>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="vehicleCategoryId" label="Vehicle Category" rules={[{ required: true }]}>
                  <Select
                    options={categories.map(c => ({ value: c._id, label: `${c.name} (${c.code})` }))}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="tripType" label="Trip Mode">
                  <Select
                    options={[
                      { value: 'ONE_WAY', label: 'One-Way Drop' },
                      { value: 'ROUND_TRIP', label: 'Round-Trip Return' },
                      { value: 'OUTSTATION', label: 'Outstation' },
                      { value: 'LOCAL_RENTAL', label: 'Hourly Rental' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={12}>
                <Form.Item name="customDistanceKm" label="Estimated Distance (KM)">
                  <InputNumber min={1} max={2000} addonAfter="KM" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="waitingMinutes" label="Waiting Duration">
                  <InputNumber min={0} max={300} addonAfter="mins" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Test Conditions:</div>
              <div className="flex items-center gap-4">
                <Form.Item name="hasToll" valuePropName="checked" className="m-0">
                  <Switch checkedChildren="Toll Road" unCheckedChildren="No Toll" />
                </Form.Item>
                <Form.Item name="isNightTime" valuePropName="checked" className="m-0">
                  <Switch checkedChildren="Night Time" unCheckedChildren="Day Time" />
                </Form.Item>
              </div>
            </div>
          </Form>

          {/* Result Card */}
          {calcResult ? (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Calculation Verdict</span>
                <Tag color={calcResult.isFixedFare ? 'green' : 'purple'} className="font-bold">
                  {calcResult.isFixedFare ? 'MATCHED FIXED ROUTE' : 'DISTANCE METER'}
                </Tag>
              </div>

              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Applied Rule: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{calcResult.appliedRuleName}</span>
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Base / Package Fare:</span>
                  <span className="font-bold">₹{calcResult.fareBreakdown.baseFare}</span>
                </div>
                {calcResult.fareBreakdown.distanceFare > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Distance Fare ({calcResult.fareBreakdown.distanceKm} km):</span>
                    <span className="font-bold">₹{calcResult.fareBreakdown.distanceFare}</span>
                  </div>
                )}
                {calcResult.fareBreakdown.waitingCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Waiting Charges:</span>
                    <span className="font-bold text-amber-500">₹{calcResult.fareBreakdown.waitingCharge}</span>
                  </div>
                )}
                {calcResult.fareBreakdown.nightCharge > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Night Surcharge:</span>
                    <span className="font-bold text-indigo-500">₹{calcResult.fareBreakdown.nightCharge}</span>
                  </div>
                )}
                {calcResult.fareBreakdown.toll > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tolls:</span>
                    <span className="font-bold">₹{calcResult.fareBreakdown.toll}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500">GST (5%):</span>
                  <span className="font-bold">₹{calcResult.fareBreakdown.tax}</span>
                </div>
                <Divider className="my-1 border-slate-200 dark:border-slate-800" />
                <div className="flex justify-between text-base font-black text-slate-900 dark:text-slate-100">
                  <span>Total Calculated:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">₹{calcResult.fareBreakdown.total}</span>
                </div>
              </div>
            </div>
          ) : calcLoading ? (
            <div className="p-8 text-center text-xs text-slate-400">Calculating fare breakdown...</div>
          ) : null}
        </div>
      </Drawer>
    </div>
  );
}
