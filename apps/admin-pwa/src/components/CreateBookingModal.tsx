import { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Radio,
  InputNumber,
  Button,
  Card,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  Divider,
  Alert,
  Spin,
} from 'antd';
import {
  CarOutlined,
  UserOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  DollarCircleOutlined,
  ClockCircleOutlined,
  SendOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  SwapOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/apiClient';
import { toast } from '@/components/Toast';
import type { BookingTicketData } from '@/components/ETicketModal';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface CreateBookingModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (booking: BookingTicketData) => void;
}

interface TaxiStandItem {
  _id: string;
  name: string;
  status: string;
  locationId?: { _id: string; name: string };
  allowedVehicleCategories?: Array<{ _id: string; name: string }>;
}

interface LocationItem {
  _id: string;
  name: string;
  code: string;
  geoPoint?: { coordinates: [number, number] };
  address?: { line1?: string; city?: string };
}

interface CategoryItem {
  _id: string;
  name: string;
  code: string;
  baseFare?: number;
  ratePerKm?: number;
  seatCapacity?: number;
}

export function CreateBookingModal({ open, onClose, onSuccess }: CreateBookingModalProps) {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [fareEstimate, setFareEstimate] = useState<{
    distanceKm: number;
    baseFare: number;
    distanceFare: number;
    total: number;
    ruleName?: string;
    isFixedFare?: boolean;
    appliedRuleType?: string;
    ratePerKm?: number;
    includedKm?: number;
  } | null>(null);

  // Watch form fields for live fare calculation
  const pickupType = Form.useWatch('pickupType', form) || 'PRESET';
  const dropType = Form.useWatch('dropType', form) || 'PRESET';
  const pickupLocId = Form.useWatch('pickupLocId', form);
  const dropLocId = Form.useWatch('dropLocId', form);
  const customPickupAddr = Form.useWatch('customPickupAddr', form);
  const customDropAddr = Form.useWatch('customDropAddr', form);
  const vehicleCategoryId = Form.useWatch('vehicleCategoryId', form);
  const tripType = Form.useWatch('tripType', form) || 'ONE_WAY';
  const originTaxiStandId = Form.useWatch('originTaxiStandId', form);

  // 1. Fetch Taxi Stands
  const { data: taxiStands = [] } = useQuery<TaxiStandItem[]>({
    queryKey: ['admin-booking-stands'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/taxi-stands?status=ACTIVE&limit=50');
      return res.data?.data ?? [];
    },
    enabled: open,
  });

  // 2. Fetch Locations
  const { data: locations = [] } = useQuery<LocationItem[]>({
    queryKey: ['admin-booking-locations'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/locations?status=ACTIVE&limit=100');
      return res.data?.data ?? [];
    },
    enabled: open,
  });

  // 3. Fetch Vehicle Categories
  const { data: categories = [] } = useQuery<CategoryItem[]>({
    queryKey: ['admin-booking-categories'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/vehicle-categories');
      return res.data?.data ?? [];
    },
    enabled: open,
  });

  // 4. Fetch Active Fixed Route Fares
  const { data: fixedRoutes = [] } = useQuery<any[]>({
    queryKey: ['admin-booking-fixed-routes'],
    queryFn: async () => {
      const res = await apiClient.get('/fare/fixed-routes');
      return res.data?.data ?? [];
    },
    enabled: open,
  });

  // Auto-set default stand & category on load
  useEffect(() => {
    if (open) {
      if (taxiStands.length > 0 && !form.getFieldValue('originTaxiStandId')) {
        form.setFieldsValue({ originTaxiStandId: taxiStands[0]._id });
      }
      if (categories.length > 0 && !form.getFieldValue('vehicleCategoryId')) {
        form.setFieldsValue({ vehicleCategoryId: categories[0]._id });
      }
    }
  }, [open, taxiStands, categories, form]);

  // Resolve coordinates for pickup and drop
  const getCoordinates = useCallback(
    (type: 'PRESET' | 'CUSTOM', locId?: string) => {
      if (type === 'PRESET' && locId) {
        const found = locations.find(l => l._id === locId);
        if (found?.geoPoint?.coordinates && found.geoPoint.coordinates.length === 2) {
          return {
            latitude: found.geoPoint.coordinates[1],
            longitude: found.geoPoint.coordinates[0],
            address: `${found.name}, ${found.address?.city || 'Karnataka'}`,
            name: found.name,
            locationId: found._id,
          };
        }
      }
      // Defaults to Kollur area if custom without map pin
      return null;
    },
    [locations]
  );

  // Calculate Fare Estimate live
  const updateFareEstimate = useCallback(async () => {
    if (!vehicleCategoryId) return;

    let pLat = 13.8647;
    let pLng = 74.8135;
    let pName = 'Pickup';

    let dLat = 13.8741;
    let dLng = 74.6369;
    let dName = 'Drop';

    if (pickupType === 'PRESET' && pickupLocId) {
      const p = getCoordinates('PRESET', pickupLocId);
      if (p) {
        pLat = p.latitude;
        pLng = p.longitude;
        pName = p.name || 'Pickup';
      }
    }

    if (dropType === 'PRESET' && dropLocId) {
      const d = getCoordinates('PRESET', dropLocId);
      if (d) {
        dLat = d.latitude;
        dLng = d.longitude;
        dName = d.name || 'Drop';
      }
    }

    setEstimating(true);
    try {
      const res = await apiClient.post('/fare/estimate', {
        pickupLatitude: pLat,
        pickupLongitude: pLng,
        dropLatitude: dLat,
        dropLongitude: dLng,
        vehicleCategoryId,
        tripType,
        pickupLocationId: pickupType === 'PRESET' ? pickupLocId : undefined,
        dropLocationId: dropType === 'PRESET' ? dropLocId : undefined,
      });

      if (res.data?.data) {
        const bd = res.data.data.fareBreakdown;
        setFareEstimate({
          distanceKm: res.data.data.routeDistanceKm || bd.distanceKm,
          baseFare: bd.baseFare,
          distanceFare: bd.distanceFare,
          total: bd.total,
          ruleName: res.data.data.appliedRule,
          isFixedFare: res.data.data.isFixedFare ?? bd.isFixedFare ?? false,
          appliedRuleType: res.data.data.appliedRuleType ?? bd.appliedRuleType,
          ratePerKm: res.data.data.ratePerKm ?? bd.ratePerKm,
          includedKm: bd.includedKm,
        });
      }
    } catch {
      // Fallback rough estimate
      const selCat = categories.find(c => c._id === vehicleCategoryId);
      const base = selCat?.baseFare || 100;
      const rate = selCat?.ratePerKm || 18;
      const dist = 30; // Approx Kollur to Byndoor
      const tot = base + dist * rate;
      setFareEstimate({
        distanceKm: dist,
        baseFare: base,
        distanceFare: dist * rate,
        total: tot,
        isFixedFare: false,
        ratePerKm: rate,
        ruleName: 'Per Kilometer Calculation',
      });
    } finally {
      setEstimating(false);
    }
  }, [vehicleCategoryId, pickupType, pickupLocId, dropType, dropLocId, tripType, getCoordinates, categories]);

  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        updateFareEstimate();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [open, updateFareEstimate]);

  const handleSubmit = async (values: any) => {
    setSubmitting(true);
    try {
      // Resolve pickup
      let pickupData = {
        latitude: 13.8647,
        longitude: 74.8135,
        address: values.customPickupAddr?.trim() || 'Kollur Temple Area',
        locationId: undefined as string | undefined,
        name: values.customPickupAddr?.trim() || 'Kollur',
      };

      if (values.pickupType === 'PRESET' && values.pickupLocId) {
        const found = locations.find(l => l._id === values.pickupLocId);
        if (found) {
          pickupData = {
            latitude: found.geoPoint?.coordinates?.[1] || 13.8647,
            longitude: found.geoPoint?.coordinates?.[0] || 74.8135,
            address: `${found.name}, ${found.address?.city || 'Karnataka'}`,
            locationId: found._id,
            name: found.name,
          };
        }
      }

      // Resolve drop
      let dropData = {
        latitude: 13.8741,
        longitude: 74.6369,
        address: values.customDropAddr?.trim() || 'Byndoor Railway Station',
        locationId: undefined as string | undefined,
        name: values.customDropAddr?.trim() || 'Byndoor',
      };

      if (values.dropType === 'PRESET' && values.dropLocId) {
        const found = locations.find(l => l._id === values.dropLocId);
        if (found) {
          dropData = {
            latitude: found.geoPoint?.coordinates?.[1] || 13.8741,
            longitude: found.geoPoint?.coordinates?.[0] || 74.6369,
            address: `${found.name}, ${found.address?.city || 'Karnataka'}`,
            locationId: found._id,
            name: found.name,
          };
        }
      }

      const payload = {
        customerName: values.customerName?.trim(),
        customerPhone: values.customerPhone?.trim(),
        customerEmail: values.customerEmail?.trim(),
        tripType: values.tripType || 'ONE_WAY',
        originTaxiStandId: values.originTaxiStandId || undefined,
        pickupLocation: pickupData,
        dropLocation: dropData,
        vehicleCategoryId: values.vehicleCategoryId,
        passengers: values.passengers || 1,
        paymentOption: values.paymentOption || 'CASH',
        notes: values.notes?.trim(),
      };

      const res = await apiClient.post('/admin/bookings', payload);

      if (res.data?.success) {
        toast.success(
          `Booking Created & Dispatched! Booking #: ${res.data.data?.bookingNumber}`
        );
        form.resetFields();
        onSuccess(res.data.data);
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStand = taxiStands.find(s => s._id === originTaxiStandId);
  const selectedCategory = categories.find(c => c._id === vehicleCategoryId);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={780}
      centered
      destroyOnClose
      title={
        <div className="flex items-center gap-2.5 py-1">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
            <CarOutlined className="text-lg" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100">
              Admin Trip Dispatcher & Booking
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Create booking and dispatch trip directly to driver in taxi stand queue
            </div>
          </div>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          tripType: 'ONE_WAY',
          pickupType: 'PRESET',
          dropType: 'PRESET',
          passengers: 1,
          paymentOption: 'CASH',
        }}
        className="mt-3 space-y-4"
      >
        {/* Taxi Stand Dispatch Target */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80">
          <Row gutter={16} align="middle">
            <Col xs={24} sm={14}>
              <Form.Item
                name="originTaxiStandId"
                label={
                  <span className="font-semibold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Dispatch Taxi Stand (Queue Target)
                  </span>
                }
                rules={[{ required: true, message: 'Please select a taxi stand' }]}
                className="mb-0"
              >
                <Select placeholder="Select Taxi Stand" size="large">
                  {taxiStands.map(s => (
                    <Option key={s._id} value={s._id}>
                      <span className="font-medium">{s.name}</span>
                      {s.locationId?.name ? ` — ${s.locationId.name}` : ''}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} sm={10} className="mt-2 sm:mt-0">
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-400">
                <div className="font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Auto-Queue Dispatch
                </div>
                <div className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                  Transmits offer directly to the #1 waiting driver at {selectedStand?.name || 'selected stand'}.
                </div>
              </div>
            </Col>
          </Row>
        </div>

        {/* Customer Information */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <UserOutlined /> Customer Details
          </div>
          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="customerPhone"
                label="Mobile Number"
                rules={[
                  { required: true, message: 'Customer phone is required' },
                  { pattern: /^[6-9]\d{9}$/, message: 'Valid 10-digit mobile number starting with 6-9' },
                ]}
              >
                <Input
                  prefix={<span className="text-slate-400 font-medium">+91</span>}
                  placeholder="9876543210"
                  maxLength={10}
                  size="large"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="customerName"
                label="Customer Full Name"
                rules={[{ required: true, message: 'Customer name is required' }]}
              >
                <Input prefix={<UserOutlined className="text-slate-400" />} placeholder="e.g. Ramesh Bhat" size="large" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="customerEmail" label="Email Address (Optional)" className="mb-0">
                <Input placeholder="customer@example.com" />
              </Form.Item>
            </Col>
          </Row>
        </div>

        {/* Trip Type & Route */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <EnvironmentOutlined /> Route & Trip Type
            </div>
            <Form.Item name="tripType" className="mb-0">
              <Radio.Group size="small" buttonStyle="solid">
                <Radio.Button value="ONE_WAY">One Way</Radio.Button>
                <Radio.Button value="ROUND_TRIP">Round Trip</Radio.Button>
                <Radio.Button value="OUTSTATION">Outstation</Radio.Button>
                <Radio.Button value="LOCAL_RENTAL">Rental</Radio.Button>
              </Radio.Group>
            </Form.Item>
          </div>

          {/* Quick Select Fixed Route Package */}
          {fixedRoutes.length > 0 && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <ThunderboltOutlined className="text-amber-400" /> Quick Select Fixed Fare Route:
                </span>
                <span className="text-[11px] text-slate-400">Pre-approved fixed temple & station tariffs</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {fixedRoutes.map((fr: any) => {
                  const origId = typeof fr.originLocationId === 'object' ? fr.originLocationId?._id : fr.originLocationId;
                  const destId = typeof fr.destinationLocationId === 'object' ? fr.destinationLocationId?._id : fr.destinationLocationId;
                  const isSelected = pickupLocId === origId && dropLocId === destId;
                  return (
                    <button
                      key={fr._id}
                      type="button"
                      onClick={() => {
                        form.setFieldsValue({
                          pickupType: 'PRESET',
                          pickupLocId: origId,
                          dropType: 'PRESET',
                          dropLocId: destId,
                          tripType: fr.tripType || 'ONE_WAY',
                        });
                        if (fr.vehicleCategoryId) {
                          const catId = typeof fr.vehicleCategoryId === 'object' ? fr.vehicleCategoryId?._id : fr.vehicleCategoryId;
                          form.setFieldsValue({ vehicleCategoryId: catId });
                        }
                      }}
                      className={`px-2.5 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center gap-2 border cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-400 shadow-sm'
                          : 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border-slate-700 hover:border-emerald-500/50'
                      }`}
                    >
                      <span>{fr.name}</span>
                      <span className="font-mono font-bold text-emerald-300 bg-slate-900/80 px-1.5 py-0.5 rounded text-[10px]">
                        ₹{fr.fixedPrice || fr.baseFare}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Row gutter={16}>
            {/* Pickup */}
            <Col xs={24} sm={12}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Pickup Location
                  </span>
                  <Form.Item name="pickupType" className="mb-0">
                    <Radio.Group size="small">
                      <Radio.Button value="PRESET">Known Spot</Radio.Button>
                      <Radio.Button value="CUSTOM">Custom</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </div>

                {pickupType === 'PRESET' ? (
                  <Form.Item
                    name="pickupLocId"
                    rules={[{ required: pickupType === 'PRESET', message: 'Select pickup point' }]}
                    className="mb-0"
                  >
                    <Select
                      showSearch
                      placeholder="Select pickup landmark / temple / stand"
                      optionFilterProp="children"
                      size="large"
                    >
                      {locations.map(l => (
                        <Option key={l._id} value={l._id}>
                          {l.name} {l.address?.city ? `(${l.address.city})` : ''}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                ) : (
                  <Form.Item
                    name="customPickupAddr"
                    rules={[{ required: pickupType === 'CUSTOM', message: 'Enter pickup address' }]}
                    className="mb-0"
                  >
                    <Input placeholder="Enter pickup address / landmark" size="large" />
                  </Form.Item>
                )}
              </div>
            </Col>

            {/* Drop */}
            <Col xs={24} sm={12}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Destination Drop
                  </span>
                  <Form.Item name="dropType" className="mb-0">
                    <Radio.Group size="small">
                      <Radio.Button value="PRESET">Known Spot</Radio.Button>
                      <Radio.Button value="CUSTOM">Custom</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </div>

                {dropType === 'PRESET' ? (
                  <Form.Item
                    name="dropLocId"
                    rules={[{ required: dropType === 'PRESET', message: 'Select drop destination' }]}
                    className="mb-0"
                  >
                    <Select
                      showSearch
                      placeholder="Select destination landmark / station / airport"
                      optionFilterProp="children"
                      size="large"
                    >
                      {locations.map(l => (
                        <Option key={l._id} value={l._id}>
                          {l.name} {l.address?.city ? `(${l.address.city})` : ''}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                ) : (
                  <Form.Item
                    name="customDropAddr"
                    rules={[{ required: dropType === 'CUSTOM', message: 'Enter destination address' }]}
                    className="mb-0"
                  >
                    <Input placeholder="Enter destination address" size="large" />
                  </Form.Item>
                )}
              </div>
            </Col>
          </Row>
        </div>

        {/* Vehicle Category & Passengers */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40">
          <Row gutter={16}>
            <Col xs={24} sm={14}>
              <Form.Item
                name="vehicleCategoryId"
                label={
                  <span className="font-semibold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Vehicle Type
                  </span>
                }
                rules={[{ required: true, message: 'Please select vehicle category' }]}
                className="mb-0"
              >
                <Select size="large" placeholder="Select Vehicle Category">
                  {categories.map(c => (
                    <Option key={c._id} value={c._id}>
                      <span className="font-semibold">{c.name}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        (Base ₹{c.baseFare || 100} • ₹{c.ratePerKm || 18}/km • {c.seatCapacity || 4} seats)
                      </span>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={12} sm={5}>
              <Form.Item name="passengers" label="Passengers" className="mb-0">
                <InputNumber min={1} max={7} size="large" className="w-full" />
              </Form.Item>
            </Col>
            <Col xs={12} sm={5}>
              <Form.Item name="paymentOption" label="Payment" className="mb-0">
                <Select size="large">
                  <Option value="CASH">Cash</Option>
                  <Option value="PAY_AT_END">Pay at End</Option>
                  <Option value="UPI">UPI QR</Option>
                  <Option value="ONLINE">Prepaid</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="notes" label="Special Driver Notes" className="mb-0 mt-3">
            <Input placeholder="e.g. 2 large luggage bags, passenger waiting near North Gate" />
          </Form.Item>
        </div>

        {/* Live Fare Estimation Card */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            fareEstimate?.isFixedFare
              ? 'bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-emerald-600/10 border-emerald-500/40 shadow-sm'
              : 'bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-slate-900/40 border-blue-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-lg mt-0.5 ${
                  fareEstimate?.isFixedFare
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-blue-500/20 text-blue-400'
                }`}
              >
                {fareEstimate?.isFixedFare ? (
                  <CheckCircleOutlined className="text-xl" />
                ) : (
                  <DollarCircleOutlined className="text-xl" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    {fareEstimate?.isFixedFare ? 'Fixed Route Tariff' : 'Distance Rate Calculation'}
                  </span>
                  {fareEstimate?.isFixedFare ? (
                    <Tag color="green" className="m-0 text-[10px] font-bold px-1.5 py-0 flex items-center gap-1">
                      <ThunderboltOutlined /> FIXED FARE
                    </Tag>
                  ) : (
                    <Tag color="blue" className="m-0 text-[10px] font-bold px-1.5 py-0">
                      📏 BY KILOMETERS
                    </Tag>
                  )}
                </div>
                <div className="text-xs text-slate-300 mt-1">
                  {estimating ? (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Spin size="small" /> Calculating route distance & rates...
                    </span>
                  ) : fareEstimate?.isFixedFare ? (
                    <span>
                      Package: <strong className="text-emerald-400">{fareEstimate.ruleName}</strong>
                      {fareEstimate.includedKm ? ` (Includes ${fareEstimate.includedKm} km)` : ''} •{' '}
                      {selectedCategory?.name || 'Selected Vehicle'}
                    </span>
                  ) : (
                    <span>
                      Distance:{' '}
                      <strong className="text-blue-300">
                        {fareEstimate?.distanceKm.toFixed(1) || '0.0'} km
                      </strong>{' '}
                      @ ₹{fareEstimate?.ratePerKm || selectedCategory?.ratePerKm || 18}/km + ₹
                      {fareEstimate?.baseFare || 100} Base • {selectedCategory?.name || 'Cab'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div
                className={`text-2xl font-black font-mono ${
                  fareEstimate?.isFixedFare
                    ? 'text-emerald-400'
                    : 'text-blue-400'
                }`}
              >
                ₹{fareEstimate?.total ? Math.round(fareEstimate.total) : '---'}
              </div>
              <div className="text-[10px] text-slate-400">
                {fareEstimate?.isFixedFare
                  ? 'Guaranteed Flat Price (Incl. Taxes)'
                  : `Base ₹${fareEstimate?.baseFare || 0} + Dist ₹${Math.round(
                      fareEstimate?.distanceFare || 0
                    )}`}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-end gap-3">
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            icon={<SendOutlined />}
            size="large"
            className="bg-emerald-600 hover:bg-emerald-500 font-semibold px-6"
          >
            Confirm & Dispatch to Queue Driver
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
