// ============================================================
// GO MOOKAMBIKA — SHARED TYPE DEFINITIONS
// ============================================================

// ─── ENUMS ───────────────────────────────────────────────────

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ASSOCIATION_ADMIN = 'ASSOCIATION_ADMIN',
  OPERATIONS_MANAGER = 'OPERATIONS_MANAGER',
  BOOKING_MANAGER = 'BOOKING_MANAGER',
  QUEUE_MANAGER = 'QUEUE_MANAGER',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  SUPPORT_AGENT = 'SUPPORT_AGENT',
  REPORT_VIEWER = 'REPORT_VIEWER',
  DRIVER = 'DRIVER',
  CUSTOMER = 'CUSTOMER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum DriverStatus {
  OFFLINE = 'OFFLINE',
  AVAILABLE = 'AVAILABLE',
  IN_QUEUE = 'IN_QUEUE',
  TRIP_OFFERED = 'TRIP_OFFERED',
  TRIP_ACCEPTED = 'TRIP_ACCEPTED',
  ON_TRIP = 'ON_TRIP',
  PAUSED = 'PAUSED',
  SUSPENDED = 'SUSPENDED',
}

export enum VehicleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
  SUSPENDED = 'SUSPENDED',
  DOCUMENT_EXPIRED = 'DOCUMENT_EXPIRED',
}

export enum FuelType {
  PETROL = 'PETROL',
  DIESEL = 'DIESEL',
  CNG = 'CNG',
  ELECTRIC = 'ELECTRIC',
  HYBRID = 'HYBRID',
}

export enum AssignmentType {
  PERMANENT = 'PERMANENT',
  TEMPORARY = 'TEMPORARY',
}

export enum LocationType {
  TAXI_STAND = 'TAXI_STAND',
  TEMPLE = 'TEMPLE',
  BUS_STAND = 'BUS_STAND',
  RAILWAY_STATION = 'RAILWAY_STATION',
  AIRPORT = 'AIRPORT',
  HOTEL = 'HOTEL',
  TOURIST_LOCATION = 'TOURIST_LOCATION',
  CITY_LOCATION = 'CITY_LOCATION',
  CUSTOM = 'CUSTOM',
}

export enum QRStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  DISABLED = 'DISABLED',
}

export enum QueueEntryStatus {
  WAITING = 'WAITING',
  OFFERED = 'OFFERED',
  ASSIGNED = 'ASSIGNED',
  LEFT = 'LEFT',
  REMOVED = 'REMOVED',
  EXPIRED = 'EXPIRED',
}

export enum QueuePolicy {
  FIFO = 'FIFO',
  VEHICLE_CATEGORY_FIFO = 'VEHICLE_CATEGORY_FIFO',
  NEAREST_ELIGIBLE = 'NEAREST_ELIGIBLE',
  MANUAL_ASSIGNMENT = 'MANUAL_ASSIGNMENT',
}

export enum DeclinePolicy {
  KEEP_POSITION = 'KEEP_POSITION',
  MOVE_TO_END = 'MOVE_TO_END',
  TEMPORARY_PAUSE = 'TEMPORARY_PAUSE',
  SUSPEND_AFTER_REPEATED_DECLINE = 'SUSPEND_AFTER_REPEATED_DECLINE',
}

export enum TripType {
  ONE_WAY = 'ONE_WAY',
  ROUND_TRIP = 'ROUND_TRIP',
  LOCAL = 'LOCAL',
  AIRPORT_TRANSFER = 'AIRPORT_TRANSFER',
  OUTSTATION = 'OUTSTATION',
  HOURLY_RENTAL = 'HOURLY_RENTAL',
  ADVANCE_BOOKING = 'ADVANCE_BOOKING',
}

export enum BookingStatus {
  CONFIRMED = 'CONFIRMED',
  SEARCHING_DRIVER = 'SEARCHING_DRIVER',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_ACCEPTED = 'DRIVER_ACCEPTED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  DRIVER_ARRIVED = 'DRIVER_ARRIVED',
  TRIP_STARTED = 'TRIP_STARTED',
  TRIP_IN_PROGRESS = 'TRIP_IN_PROGRESS',
  TRIP_COMPLETED = 'TRIP_COMPLETED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  CLOSED = 'CLOSED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
  EXPIRED = 'EXPIRED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
}

export enum TripStatus {
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_ACCEPTED = 'DRIVER_ACCEPTED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  DRIVER_ARRIVED = 'DRIVER_ARRIVED',
  TRIP_STARTED = 'TRIP_STARTED',
  TRIP_IN_PROGRESS = 'TRIP_IN_PROGRESS',
  TRIP_COMPLETED = 'TRIP_COMPLETED',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum PaymentMethod {
  CASH = 'CASH',
  ONLINE = 'ONLINE',
  WALLET = 'WALLET',
}

export enum PaymentOption {
  FULL_PAYMENT = 'FULL_PAYMENT',
  PARTIAL_PAYMENT = 'PARTIAL_PAYMENT',
  PAY_LATER = 'PAY_LATER',
  CASH = 'CASH',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUND_PENDING = 'REFUND_PENDING',
  REFUNDED = 'REFUNDED',
}

export enum PriceRuleType {
  FIXED = 'FIXED',
  PER_KM = 'PER_KM',
  SLAB = 'SLAB',
  LOCATION_TO_LOCATION = 'LOCATION_TO_LOCATION',
}

export enum ChargeType {
  TOLL = 'TOLL',
  PARKING = 'PARKING',
  WAITING = 'WAITING',
  NIGHT_CHARGE = 'NIGHT_CHARGE',
  DRIVER_ALLOWANCE = 'DRIVER_ALLOWANCE',
  EXTRA_KM = 'EXTRA_KM',
  EXTRA_HOUR = 'EXTRA_HOUR',
  SERVICE_FEE = 'SERVICE_FEE',
  CONVENIENCE_FEE = 'CONVENIENCE_FEE',
  GST = 'GST',
}

export enum CalcMethod {
  FIXED = 'FIXED',
  PERCENTAGE = 'PERCENTAGE',
  PER_MINUTE = 'PER_MINUTE',
  PER_KM = 'PER_KM',
  PER_HOUR = 'PER_HOUR',
}

export enum DocumentType {
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  AADHAAR = 'AADHAAR',
  PAN = 'PAN',
  POLICE_VERIFICATION = 'POLICE_VERIFICATION',
  TAXI_BADGE = 'TAXI_BADGE',
  VEHICLE_RC = 'VEHICLE_RC',
  VEHICLE_INSURANCE = 'VEHICLE_INSURANCE',
  VEHICLE_FITNESS = 'VEHICLE_FITNESS',
  VEHICLE_PERMIT = 'VEHICLE_PERMIT',
  OTHER = 'OTHER',
}

export enum NotificationType {
  BOOKING_CONFIRMED = 'BOOKING_CONFIRMED',
  DRIVER_ASSIGNED = 'DRIVER_ASSIGNED',
  DRIVER_ARRIVING = 'DRIVER_ARRIVING',
  DRIVER_ARRIVED = 'DRIVER_ARRIVED',
  TRIP_STARTED = 'TRIP_STARTED',
  TRIP_COMPLETED = 'TRIP_COMPLETED',
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',
  QUEUE_JOINED = 'QUEUE_JOINED',
  QUEUE_POSITION_CHANGED = 'QUEUE_POSITION_CHANGED',
  TRIP_REQUEST = 'TRIP_REQUEST',
  TRIP_ASSIGNED = 'TRIP_ASSIGNED',
  DOCUMENT_EXPIRY = 'DOCUMENT_EXPIRY',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
}

export enum NotifChannel {
  PUSH = 'PUSH',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
}

export enum OTPPurpose {
  LOGIN = 'LOGIN',
  TRIP_START = 'TRIP_START',
  VERIFY_PHONE = 'VERIFY_PHONE',
}

export enum Status {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

// ─── INTERFACES ──────────────────────────────────────────────

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface CustomerLocation {
  latitude: number;
  longitude: number;
  address: string;
  locationId?: string;
  name?: string;
}

export interface FareBreakdown {
  distanceKm: number;
  baseFare: number;
  distanceFare: number;
  waitingCharge: number;
  toll: number;
  parking: number;
  nightCharge: number;
  driverAllowance: number;
  serviceFee: number;
  discount: number;
  tax: number;
  total: number;
  currency: string;
  ruleId?: string;
  ruleName?: string;
  ruleType?: PriceRuleType;
  calculatedAt: Date | string;
}

export interface PriceSlab {
  fromKm: number;
  toKm: number;
  price: number;
}

export interface OperatingHours {
  dayOfWeek: number; // 0=Sunday ... 6=Saturday
  openTime: string; // "HH:MM"
  closeTime: string;
  closed: boolean;
}

export interface DocumentRecord {
  type: DocumentType;
  fileUrl: string;
  expiresAt?: Date | string;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date | string;
}

export interface SavedLocation {
  label: 'HOME' | 'WORK' | 'OTHER';
  name: string;
  address: string;
  latitude: number;
  longitude: number;
}

// ─── API RESPONSE TYPES ──────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: ApiError;
  meta?: PaginationMeta;
}

export interface ApiError {
  code: string;
  details?: Record<string, unknown>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

// ─── SOCKET EVENT TYPES ──────────────────────────────────────

export enum SocketEvent {
  // Driver events
  DRIVER_LOCATION_UPDATE = 'driver:location:update',
  DRIVER_STATUS_CHANGE = 'driver:status:change',
  DRIVER_HEARTBEAT = 'driver:heartbeat',

  // Trip offer events
  TRIP_OFFER_SENT = 'trip:offer:sent',
  TRIP_OFFER_ACCEPTED = 'trip:offer:accepted',
  TRIP_OFFER_DECLINED = 'trip:offer:declined',
  TRIP_OFFER_TIMEOUT = 'trip:offer:timeout',

  // Trip status events
  TRIP_STATUS_CHANGED = 'trip:status:changed',
  TRIP_DRIVER_LOCATION = 'trip:driver:location',

  // Queue events
  QUEUE_JOINED = 'queue:joined',
  QUEUE_POSITION_CHANGED = 'queue:position:changed',
  QUEUE_WARNING = 'queue:warning',
  QUEUE_REMOVED = 'queue:removed',

  // Booking events
  BOOKING_STATUS_CHANGED = 'booking:status:changed',
  BOOKING_DRIVER_ASSIGNED = 'booking:driver:assigned',

  // Notification
  NOTIFICATION = 'notification',
}

export interface TripOfferPayload {
  bookingId: string;
  tripId: string;
  pickupLocation: CustomerLocation;
  dropLocation?: CustomerLocation;
  passengers: number;
  distanceKm: number;
  estimatedFare: number;
  vehicleCategory: string;
  scheduledAt?: string;
  timeoutSeconds: number;
}

export interface DriverLocationPayload {
  driverId: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp: number;
}
