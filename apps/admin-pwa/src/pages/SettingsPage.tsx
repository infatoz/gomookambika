import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Tabs,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Typography,
  Space,
  Row,
  Col,
  Tag,
  Divider,
  Alert,
} from 'antd';
import {
  ShopOutlined,
  ControlOutlined,
  SendOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  LockOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  MailOutlined,
} from '@ant-design/icons';
import apiClient from '@/lib/apiClient';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface SystemSettingsData {
  // Association
  platformName: string;
  registrationNumber: string;
  supportPhone: string;
  supportEmail: string;
  officeAddress: string;
  operatingRegion: string;

  // Queue
  defaultQueueRadius: number;
  heartbeatInterval: number;
  heartbeatGracePeriod: number;
  maxMissedHeartbeats: number;
  queuePolicy: string;
  allowAutoQueueExitOnDrift: boolean;

  // Dispatch
  driverAcceptTimeout: number;
  maxDeclineCount: number;
  declinePenaltyPolicy: string;
  driverPauseDurationMinutes: number;
  autoCancelUnassignedMinutes: number;
  advanceBookingMaxDays: number;

  // Safety
  requireRideStartOTP: boolean;
  emergencySosContact: string;
  lostAndFoundHelpline: string;
  nightTravelAdvisory: string;
}

const DEFAULT_SETTINGS: SystemSettingsData = {
  platformName: 'Go Mookambika Tourist Taxi Association',
  registrationNumber: 'KA-UD-TA-2024-089',
  supportPhone: '+91 94812 00000',
  supportEmail: 'support@gomookambika.com',
  officeAddress: 'Car Street, Near Mookambika Temple, Kollur, Udupi Dist, Karnataka - 576220',
  operatingRegion: 'Kollur, Byndoor & Coastal Karnataka',

  defaultQueueRadius: 150,
  heartbeatInterval: 30,
  heartbeatGracePeriod: 120,
  maxMissedHeartbeats: 3,
  queuePolicy: 'FIFO',
  allowAutoQueueExitOnDrift: true,

  driverAcceptTimeout: 30,
  maxDeclineCount: 3,
  declinePenaltyPolicy: 'MOVE_TO_END',
  driverPauseDurationMinutes: 15,
  autoCancelUnassignedMinutes: 15,
  advanceBookingMaxDays: 30,

  requireRideStartOTP: true,
  emergencySosContact: '+91 94812 00000',
  lostAndFoundHelpline: '+91 94812 00001',
  nightTravelAdvisory: 'Certified hill-route drivers with 24x7 control room tracking on all ghat and night journeys.',
};

export function SettingsPage() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('association');
  const [hasChanges, setHasChanges] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Password change state
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);

  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'ASSOCIATION_ADMIN';

  // 1. Fetch persistent system settings
  const {
    data: settings,
    isLoading,
    isFetching,
    refetch,
  } = useQuery<SystemSettingsData>({
    queryKey: ['admin-system-settings'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/settings');
      return res.data?.data ?? DEFAULT_SETTINGS;
    },
  });

  // Populate form when data arrives
  useEffect(() => {
    if (settings) {
      form.setFieldsValue(settings);
      setHasChanges(false);
    }
  }, [settings, form]);

  // 2. Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (values: SystemSettingsData) => {
      const res = await apiClient.put('/admin/settings', values);
      return res.data;
    },
    onSuccess: () => {
      toast.success('System settings updated and published successfully');
      setHasChanges(false);
      qc.invalidateQueries({ queryKey: ['admin-system-settings'] });
    },
    onError: () => {
      toast.error('Failed to save settings. Please verify permissions.');
    },
  });

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      saveMutation.mutate(values);
    } catch {
      toast.error('Please resolve validation errors before saving');
    }
  };

  const handleResetDefaults = () => {
    form.setFieldsValue(DEFAULT_SETTINGS);
    setHasChanges(true);
    setResetConfirmOpen(false);
    toast.info('Form reset to official defaults. Click "Save Changes" to apply.');
  };

  // Password change handler
  const handlePasswordChange = async (values: { oldPassword?: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      toast.error('New password and confirm password do not match');
      return;
    }
    setPasswordLoading(true);
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      toast.success('Password changed successfully');
      passwordForm.resetFields();
    } catch {
      toast.error('Failed to change password. Please verify current password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
            System Settings
          </Title>
          <Text type="secondary" className="text-sm">
            Association profile, dispatch automation, queue management parameters, and passenger safety controls
          </Text>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>

          {canEdit && (
            <>
              <Button
                danger
                onClick={() => setResetConfirmOpen(true)}
              >
                Reset Defaults
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saveMutation.isPending}
                onClick={handleSave}
                style={{
                  background: '#4f46e5',
                  borderColor: '#4338ca',
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
                }}
              >
                Save Changes
              </Button>
            </>
          )}
        </Space>
      </div>

      {!canEdit && (
        <Alert
          type="warning"
          showIcon
          message="Read-Only Mode"
          description="Only Super Administrators and Association Admins can modify operational settings."
          className="rounded-xl border-amber-200"
        />
      )}

      {hasChanges && canEdit && (
        <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 px-4 py-3 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <ThunderboltOutlined className="text-indigo-600 text-base" />
            <span>You have unsaved configuration changes</span>
          </div>
          <Space>
            <Button size="small" onClick={() => form.setFieldsValue(settings)}>
              Revert
            </Button>
            <Button
              size="small"
              type="primary"
              onClick={handleSave}
              loading={saveMutation.isPending}
              style={{ background: '#4f46e5' }}
            >
              Save Now
            </Button>
          </Space>
        </div>
      )}

      {/* Main Settings Tabs Container */}
      <Card
        className="shadow-sm border border-slate-200 overflow-hidden"
        styles={{ body: { padding: '8px 24px 24px' } }}
      >
        <Form
          form={form}
          layout="vertical"
          disabled={!canEdit || isLoading}
          onValuesChange={() => setHasChanges(true)}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="large"
            items={[
              /* ─── TAB 1: Association Profile ─── */
              {
                key: 'association',
                label: (
                  <span className="flex items-center gap-2 font-medium">
                    <ShopOutlined />
                    <span>Association Profile</span>
                  </span>
                ),
                children: (
                  <div className="py-4 space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Association Credentials & Contact
                      </h3>
                      <p className="text-xs text-slate-500">
                        Official registration details printed on digital passenger e-tickets, tax invoices, and legal trip manifests.
                      </p>
                    </div>

                    <Row gutter={24}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="platformName"
                          label="Association / Society Name"
                          rules={[{ required: true, message: 'Platform name is required' }]}
                        >
                          <Input
                            placeholder="Go Mookambika Tourist Taxi Association"
                            prefix={<ShopOutlined className="text-slate-400" />}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="registrationNumber"
                          label="Govt. Co-Operative Registration / Permit No."
                          rules={[{ required: true, message: 'Registration number is required' }]}
                        >
                          <Input
                            placeholder="KA-UD-TA-2024-089"
                            prefix={<SafetyCertificateOutlined className="text-slate-400" />}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="supportPhone"
                          label="24x7 Control Room & Helpline Phone"
                          rules={[{ required: true, message: 'Helpline phone is required' }]}
                        >
                          <Input
                            placeholder="+91 94812 00000"
                            prefix={<PhoneOutlined className="text-slate-400" />}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="supportEmail"
                          label="Official Support & Grievance Email"
                          rules={[{ required: true, type: 'email', message: 'Valid email is required' }]}
                        >
                          <Input
                            placeholder="support@gomookambika.com"
                            prefix={<MailOutlined className="text-slate-400" />}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          name="operatingRegion"
                          label="Permitted Operating Territory / District"
                        >
                          <Input
                            placeholder="Kollur, Byndoor, Kundapura, Udupi & Coastal Karnataka"
                            prefix={<EnvironmentOutlined className="text-slate-400" />}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          name="officeAddress"
                          label="Registered Office Address (Printed on Invoices & E-Tickets)"
                          rules={[{ required: true, message: 'Office address is required' }]}
                        >
                          <TextArea
                            rows={3}
                            placeholder="Car Street, Near Mookambika Temple, Kollur, Udupi Dist, Karnataka - 576220"
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },

              /* ─── TAB 2: Queue Operations ─── */
              {
                key: 'queue',
                label: (
                  <span className="flex items-center gap-2 font-medium">
                    <ControlOutlined />
                    <span>Queue & Stand Rules</span>
                  </span>
                ),
                children: (
                  <div className="py-4 space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Stand Queue & Driver Tracking
                      </h3>
                      <p className="text-xs text-slate-500">
                        Determine geofence check-in boundaries, GPS heartbeat liveness checks, and queue rotation logic.
                      </p>
                    </div>

                    <Row gutter={24}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="defaultQueueRadius"
                          label="Default Taxi Stand Geofence Radius (meters)"
                          help="Drivers must be within this radius from the stand coordinate to check in."
                        >
                          <InputNumber
                            min={50}
                            max={1000}
                            step={10}
                            suffix="meters"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="queuePolicy"
                          label="Queue Turn Ordering Policy"
                          help="Determines how drivers are ordered for passenger bookings."
                        >
                          <Select
                            options={[
                              {
                                value: 'FIFO',
                                label: 'FIFO (First-In, First-Out Queue)',
                              },
                              {
                                value: 'VEHICLE_CATEGORY_FIFO',
                                label: 'Category-Separated FIFO (Sedan/SUV/Auto Independent)',
                              },
                              {
                                value: 'NEAREST_ELIGIBLE',
                                label: 'Nearest Eligible Driver in Stand',
                              },
                            ]}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="heartbeatInterval"
                          label="Driver GPS Heartbeat Frequency (seconds)"
                          help="How often driver app sends background location ping."
                        >
                          <InputNumber
                            min={10}
                            max={120}
                            step={5}
                            suffix="seconds"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="heartbeatGracePeriod"
                          label="Heartbeat Grace Window Before Idle (seconds)"
                          help="Duration after last heartbeat before flagging driver as idle."
                        >
                          <InputNumber
                            min={30}
                            max={600}
                            step={15}
                            suffix="seconds"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="maxMissedHeartbeats"
                          label="Max Consecutive Missed Heartbeats"
                          help="Number of failed pings before marking driver as offline."
                        >
                          <InputNumber
                            min={1}
                            max={10}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mt-2 flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">
                              Auto-Exit Queue on Geofence Drift
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Automatically removes drivers who drive away from the taxi stand boundary without an active booking.
                            </div>
                          </div>
                          <Form.Item
                            name="allowAutoQueueExitOnDrift"
                            valuePropName="checked"
                            noStyle
                          >
                            <Switch />
                          </Form.Item>
                        </div>
                      </Col>
                    </Row>
                  </div>
                ),
              },

              /* ─── TAB 3: Dispatch & Allocation ─── */
              {
                key: 'dispatch',
                label: (
                  <span className="flex items-center gap-2 font-medium">
                    <SendOutlined />
                    <span>Dispatch & Allocation</span>
                  </span>
                ),
                children: (
                  <div className="py-4 space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Automated Ride Dispatch Rules
                      </h3>
                      <p className="text-xs text-slate-500">
                        Configure driver acceptance countdowns, decline penalties, and advance booking windows.
                      </p>
                    </div>

                    <Row gutter={24}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          name="driverAcceptTimeout"
                          label="Trip Offer Acceptance Countdown (seconds)"
                          help="Time given to the driver at the front of the queue to accept a ride."
                        >
                          <InputNumber
                            min={15}
                            max={90}
                            step={5}
                            suffix="seconds"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="maxDeclineCount"
                          label="Max Trip Declines Allowed"
                          help="Consecutive declines allowed before applying penalty policy."
                        >
                          <InputNumber
                            min={1}
                            max={10}
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="declinePenaltyPolicy"
                          label="Decline Action / Penalty"
                          help="What happens to a driver's queue position after exceeding allowed declines."
                        >
                          <Select
                            options={[
                              {
                                value: 'MOVE_TO_END',
                                label: 'Move to Back of Queue (Position Reset)',
                              },
                              {
                                value: 'TEMPORARY_PAUSE',
                                label: 'Temporary Dispatch Pause (15-30 Min Cooldown)',
                              },
                              {
                                value: 'KEEP_POSITION',
                                label: 'Keep Current Position (No Penalty)',
                              },
                            ]}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="driverPauseDurationMinutes"
                          label="Decline Cooldown Duration (minutes)"
                          help="Temporary suspension duration if decline policy is set to pause."
                        >
                          <InputNumber
                            min={5}
                            max={120}
                            step={5}
                            suffix="minutes"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="autoCancelUnassignedMinutes"
                          label="Auto-Cancel Unassigned Rides After (minutes)"
                          help="Cancels request if no driver accepts within this duration."
                        >
                          <InputNumber
                            min={5}
                            max={60}
                            step={5}
                            suffix="minutes"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="advanceBookingMaxDays"
                          label="Advance Reservation Horizon (days)"
                          help="Maximum days in advance a customer can schedule a future journey."
                        >
                          <InputNumber
                            min={1}
                            max={90}
                            suffix="days"
                            style={{ width: '100%' }}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },

              /* ─── TAB 4: Safety & E-Ticket Policies ─── */
              {
                key: 'safety',
                label: (
                  <span className="flex items-center gap-2 font-medium">
                    <SafetyCertificateOutlined />
                    <span>Safety & Passenger Policies</span>
                  </span>
                ),
                children: (
                  <div className="py-4 space-y-6">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Passenger Verification & Travel Safety
                      </h3>
                      <p className="text-xs text-slate-500">
                        Security verification and disclaimers displayed on passenger e-tickets and SMS confirmations.
                      </p>
                    </div>

                    <Row gutter={24}>
                      <Col xs={24}>
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between mb-4">
                          <div>
                            <div className="font-semibold text-slate-900 text-sm">
                              Require Passenger Ride Start OTP
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              Driver must input the passenger's 4-digit verification code or booking security code before meter/trip begins.
                            </div>
                          </div>
                          <Form.Item
                            name="requireRideStartOTP"
                            valuePropName="checked"
                            noStyle
                          >
                            <Switch />
                          </Form.Item>
                        </div>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="emergencySosContact"
                          label="Emergency SOS Police / Control Room Phone"
                          help="Instant distress contact displayed in passenger app & ticket."
                        >
                          <Input
                            placeholder="+91 94812 00000"
                            prefix={<PhoneOutlined className="text-slate-400" />}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24} md={12}>
                        <Form.Item
                          name="lostAndFoundHelpline"
                          label="Lost & Found Property Helpline"
                          help="Passenger contact for luggage and items left in vehicle."
                        >
                          <Input
                            placeholder="+91 94812 00001"
                            prefix={<PhoneOutlined className="text-slate-400" />}
                          />
                        </Form.Item>
                      </Col>

                      <Col xs={24}>
                        <Form.Item
                          name="nightTravelAdvisory"
                          label="Night Travel & Ghat Safety Advisory (Printed on E-Ticket)"
                          help="Official advisory printed on passenger boarding passes for night and Kodachadri/ghat journeys."
                        >
                          <TextArea
                            rows={3}
                            placeholder="Certified hill-route drivers with 24x7 control room tracking on all ghat and night journeys."
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },

              /* ─── TAB 5: Administrator Profile & Security ─── */
              {
                key: 'profile',
                label: (
                  <span className="flex items-center gap-2 font-medium">
                    <UserOutlined />
                    <span>Admin Profile & Security</span>
                  </span>
                ),
                children: (
                  <div className="py-4 space-y-6">
                    <Row gutter={[24, 24]}>
                      {/* Current User Card */}
                      <Col xs={24} lg={12}>
                        <Card
                          className="bg-slate-50 border border-slate-200"
                          styles={{ body: { padding: 20 } }}
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold">
                              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 text-base">
                                {user?.name || 'Administrator'}
                              </div>
                              <div className="text-xs text-slate-500">{user?.email}</div>
                            </div>
                          </div>

                          <Divider style={{ margin: '12px 0' }} />

                          <div className="space-y-3 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Assigned Role:</span>
                              <Tag color="indigo" className="font-bold">
                                {user?.role}
                              </Tag>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-500">Security Clearance:</span>
                              <span className="font-semibold text-emerald-600 flex items-center gap-1">
                                <CheckCircleOutlined /> Full Console Access
                              </span>
                            </div>

                            <div>
                              <div className="text-slate-500 mb-1.5">Granted Permissions:</div>
                              <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                                {user?.permissions?.map(p => (
                                  <span
                                    key={p}
                                    className="bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[11px] font-mono"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </Col>

                      {/* Password Update Card */}
                      <Col xs={24} lg={12}>
                        <Card
                          title={
                            <span className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                              <LockOutlined className="text-indigo-600" /> Change Security Password
                            </span>
                          }
                          className="border border-slate-200 shadow-sm"
                          styles={{ body: { padding: 20 } }}
                        >
                          <Form
                            form={passwordForm}
                            layout="vertical"
                            onFinish={handlePasswordChange}
                          >
                            <Form.Item
                              name="oldPassword"
                              label="Current Password"
                              rules={[{ required: true, message: 'Please enter current password' }]}
                            >
                              <Input.Password placeholder="••••••••" />
                            </Form.Item>

                            <Form.Item
                              name="newPassword"
                              label="New Secure Password"
                              rules={[
                                { required: true, message: 'Please enter new password' },
                                { min: 8, message: 'Password must be at least 8 characters' },
                              ]}
                            >
                              <Input.Password placeholder="••••••••" />
                            </Form.Item>

                            <Form.Item
                              name="confirmPassword"
                              label="Confirm New Password"
                              rules={[{ required: true, message: 'Please confirm new password' }]}
                            >
                              <Input.Password placeholder="••••••••" />
                            </Form.Item>

                            <Button
                              type="primary"
                              htmlType="submit"
                              loading={passwordLoading}
                              block
                              style={{ background: '#4f46e5', borderColor: '#4338ca', fontWeight: 600 }}
                            >
                              Update Password
                            </Button>
                          </Form>
                        </Card>
                      </Col>
                    </Row>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Card>

      {/* Confirm Reset Dialog */}
      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset All Settings to Defaults?"
        message="This will restore all queue geofence radii, dispatch countdowns, heartbeat intervals, and association profiles to standard factory defaults. You can still review the values before saving."
        confirmLabel="Reset to Defaults"
        danger
        onConfirm={handleResetDefaults}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
}
