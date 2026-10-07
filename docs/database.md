# Go Mookambika — Database Design

## Overview

MongoDB with Mongoose. All geospatial fields use GeoJSON Point format.
All timestamps stored as UTC. All monetary values in smallest currency unit (paise for INR) internally but displayed in rupees.

---

## Collections

### users

```typescript
{
  _id: ObjectId,
  phone: string,          // unique, indexed
  name: string,
  email?: string,
  role: UserRole,         // CUSTOMER | DRIVER | SUPER_ADMIN | ...
  permissions: string[],  // granular permission overrides
  profilePhoto?: string,
  status: UserStatus,     // ACTIVE | INACTIVE | SUSPENDED
  deviceTokens: string[], // FCM tokens
  lastLogin?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `phone (unique)`, `role`, `status`

---

### otpRecords

```typescript
{
  _id: ObjectId,
  phone: string,
  otp: string,            // hashed
  purpose: OTPPurpose,    // LOGIN | TRIP_START | VERIFY
  attempts: number,
  expiresAt: Date,        // TTL index
  usedAt?: Date,
  ipAddress: string,
  createdAt: Date
}
```

**Indexes**: `phone + purpose`, `expiresAt (TTL)`

---

### refreshTokens

```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  tokenHash: string,      // hashed
  deviceId?: string,
  userAgent?: string,
  ipAddress?: string,
  expiresAt: Date,        // TTL index
  revokedAt?: Date,
  createdAt: Date
}
```

---

### drivers

```typescript
{
  _id: ObjectId,
  userId: ObjectId,       // ref: users
  driverCode: string,     // unique, human-readable DRV-00001
  name: string,
  phone: string,          // indexed
  email?: string,
  photo?: string,
  address: AddressSchema,
  licenseNumber: string,
  licenseExpiry: Date,
  joiningDate: Date,
  status: DriverStatus,   // ACTIVE | INACTIVE | SUSPENDED | ON_TRIP | ...
  rating: number,         // 0-5, updated after each trip
  totalTrips: number,
  totalEarnings: number,
  documents: Document[],
  currentLocation?: GeoPoint,
  lastSeen?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `userId (unique)`, `phone`, `status`, `currentLocation (2dsphere)`

---

### vehicles

```typescript
{
  _id: ObjectId,
  registrationNumber: string,  // unique, indexed
  categoryId: ObjectId,         // ref: vehicleCategories
  brand: string,
  model: string,
  variant?: string,
  manufacturingYear: number,
  color: string,
  fuelType: FuelType,
  seatCapacity: number,
  luggageCapacity: number,
  ac: boolean,
  ownerName: string,
  ownerPhone?: string,
  assignedDriverId?: ObjectId,  // current driver
  status: VehicleStatus,
  documents: Document[],
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `registrationNumber (unique)`, `categoryId`, `status`, `assignedDriverId`

---

### vehicleCategories

```typescript
{
  _id: ObjectId,
  name: string,
  code: string,           // unique: SEDAN, SUV, INNOVA
  description?: string,
  image?: string,
  seatCapacity: number,
  luggageCapacity: number,
  ac: boolean,
  fuelType?: FuelType,
  baseFare: number,
  minimumKm: number,
  ratePerKm: number,
  ratePerHour?: number,
  extraKmRate: number,
  extraHourRate?: number,
  waitingChargePerMin: number,
  nightChargeMultiplier: number,
  status: Status,
  sortOrder: number,
  createdAt: Date,
  updatedAt: Date
}
```

---

### driverVehicleAssignments

```typescript
{
  _id: ObjectId,
  driverId: ObjectId,
  vehicleId: ObjectId,
  assignmentType: AssignmentType,  // PERMANENT | TEMPORARY
  startDate: Date,
  endDate?: Date,
  isActive: boolean,
  assignedBy: ObjectId,            // ref: users (admin)
  notes?: string,
  createdAt: Date
}
```

**Indexes**: `driverId`, `vehicleId`, `isActive`

---

### locations

```typescript
{
  _id: ObjectId,
  name: string,
  code: string,           // unique
  type: LocationType,     // TAXI_STAND | TEMPLE | BUS_STAND | ...
  description?: string,
  address: AddressSchema,
  geoPoint: {             // GeoJSON
    type: "Point",
    coordinates: [longitude, latitude]
  },
  queueRadius: number,    // meters
  queueEnabled: boolean,
  bookingEnabled: boolean,
  qrEnabled: boolean,
  operatingHours: OperatingHours[],
  status: Status,
  metadata?: Record<string, unknown>,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `code (unique)`, `geoPoint (2dsphere)`, `type`, `status`

---

### taxiStands

```typescript
{
  _id: ObjectId,
  name: string,
  locationId: ObjectId,
  queueRadius: number,
  qrToken: string,        // signed JWT-like token
  qrTokenId: string,      // unique ID for rotation
  qrStatus: QRStatus,     // ACTIVE | EXPIRED | DISABLED
  qrExpiresAt?: Date,     // for dynamic QRs
  operatingHours: OperatingHours[],
  allowedVehicleCategories: ObjectId[],
  queueEnabled: boolean,
  maxQueueSize?: number,
  status: Status,
  createdAt: Date,
  updatedAt: Date
}
```

---

### queueEntries

```typescript
{
  _id: ObjectId,
  taxiStandId: ObjectId,
  driverId: ObjectId,
  vehicleId: ObjectId,
  vehicleCategoryId: ObjectId,
  joinedAt: Date,
  position: number,       // 1-based, managed by backend
  status: QueueEntryStatus, // WAITING | OFFERED | ASSIGNED | LEFT | REMOVED | EXPIRED
  lastLocation: GeoPoint,
  lastHeartbeat: Date,
  leftAt?: Date,
  tripId?: ObjectId,
  removalReason?: string,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: 
- `taxiStandId + status + position`
- `driverId + status`
- `joinedAt`

---

### bookings

```typescript
{
  _id: ObjectId,
  bookingNumber: string,  // GM-20261007-000001
  customerId: ObjectId,
  tripType: TripType,
  status: BookingStatus,
  pickupLocation: CustomerLocation,
  dropLocation?: CustomerLocation,
  waypoints?: CustomerLocation[],
  scheduledAt?: Date,     // for advance bookings
  passengers: number,
  vehicleCategoryId: ObjectId,
  fareSnapshot: FareBreakdown,  // immutable snapshot
  paymentOption: PaymentOption,
  paymentStatus: PaymentStatus,
  assignedDriverId?: ObjectId,
  assignedVehicleId?: ObjectId,
  driverAssignedAt?: Date,
  notes?: string,
  cancellationReason?: string,
  cancelledBy?: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `bookingNumber (unique)`, `customerId`, `status`, `scheduledAt`, `assignedDriverId`, `createdAt`

---

### trips

```typescript
{
  _id: ObjectId,
  tripNumber: string,     // TRIP-20261007-000001
  bookingId: ObjectId,
  customerId: ObjectId,
  driverId: ObjectId,
  vehicleId: ObjectId,
  status: TripStatus,
  pickupLocation: CustomerLocation,
  dropLocation: CustomerLocation,
  startOTP: string,       // hashed
  startOTPExpiresAt: Date,
  driverArrivedAt?: Date,
  startedAt?: Date,
  completedAt?: Date,
  actualDistanceKm?: number,
  actualDurationMinutes?: number,
  finalFare?: FareBreakdown,
  driverRating?: number,
  customerRating?: number,
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes**: `tripNumber (unique)`, `bookingId (unique)`, `driverId`, `customerId`, `status`

---

### payments

```typescript
{
  _id: ObjectId,
  paymentNumber: string,  // PAY-GM-000001
  bookingId: ObjectId,
  tripId?: ObjectId,
  customerId: ObjectId,
  amount: number,
  currency: string,       // INR
  method: PaymentMethod,  // CASH | ONLINE | WALLET
  status: PaymentStatus,
  providerOrderId?: string,
  providerPaymentId?: string,
  providerSignature?: string,
  refundId?: string,
  refundAmount?: number,
  refundedAt?: Date,
  metadata?: Record<string, unknown>,
  createdAt: Date,
  updatedAt: Date
}
```

---

### pricingRules

```typescript
{
  _id: ObjectId,
  name: string,
  ruleType: PriceRuleType, // FIXED | PER_KM | SLAB | LOCATION_TO_LOCATION
  priority: number,
  vehicleCategoryId?: ObjectId,
  originLocationId?: ObjectId,
  destinationLocationId?: ObjectId,
  tripType?: TripType,
  fixedPrice?: number,
  baseFare?: number,
  minimumKm?: number,
  ratePerKm?: number,
  slabs?: PriceSlab[],
  validFrom?: Date,
  validTo?: Date,
  status: Status,
  createdAt: Date,
  updatedAt: Date
}
```

---

### additionalCharges

```typescript
{
  _id: ObjectId,
  chargeType: ChargeType,  // TOLL | PARKING | WAITING | NIGHT_CHARGE | ...
  name: string,
  calculationMethod: CalcMethod, // FIXED | PERCENTAGE | PER_MINUTE
  value: number,
  applicableTripTypes: TripType[],
  applicableVehicleCategories: ObjectId[],
  status: Status,
  createdAt: Date,
  updatedAt: Date
}
```

---

### notifications

```typescript
{
  _id: ObjectId,
  recipientId: ObjectId,
  recipientType: string,  // CUSTOMER | DRIVER | ADMIN
  type: NotificationType,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  channels: NotifChannel[], // PUSH | SMS | EMAIL
  readAt?: Date,
  deliveredAt?: Date,
  createdAt: Date
}
```

---

### auditLogs

```typescript
{
  _id: ObjectId,
  adminId: ObjectId,
  action: string,
  module: string,
  entityId?: ObjectId,
  entityType?: string,
  oldValue?: unknown,
  newValue?: unknown,
  ipAddress: string,
  userAgent?: string,
  timestamp: Date        // immutable — never updated
}
```

**Indexes**: `adminId`, `module`, `entityId`, `timestamp`

---

## Shared Sub-schemas

### GeoPoint
```typescript
{ type: "Point", coordinates: [lng, lat] }
```

### CustomerLocation
```typescript
{
  latitude: number,
  longitude: number,
  address: string,
  locationId?: ObjectId,  // if official location
  name?: string
}
```

### AddressSchema
```typescript
{
  line1: string,
  line2?: string,
  city: string,
  state: string,
  pincode: string,
  country: string
}
```

### FareBreakdown (immutable snapshot)
```typescript
{
  distanceKm: number,
  baseFare: number,
  distanceFare: number,
  waitingCharge: number,
  toll: number,
  parking: number,
  nightCharge: number,
  driverAllowance: number,
  serviceFee: number,
  discount: number,
  tax: number,
  total: number,
  currency: string,
  ruleId: ObjectId,      // which pricing rule was applied
  calculatedAt: Date
}
```

### Document
```typescript
{
  type: DocumentType,
  fileUrl: string,
  expiresAt?: Date,
  verified: boolean,
  verifiedBy?: ObjectId,
  verifiedAt?: Date
}
```

### OperatingHours
```typescript
{
  dayOfWeek: number,  // 0=Sunday ... 6=Saturday
  openTime: string,   // "HH:MM"
  closeTime: string,
  closed: boolean
}
```

---

## Geospatial Indexes

All location fields use:
```javascript
locationSchema.index({ geoPoint: '2dsphere' });
driverSchema.index({ currentLocation: '2dsphere' });
```

Proximity query pattern:
```javascript
await Location.find({
  geoPoint: {
    $near: {
      $geometry: { type: 'Point', coordinates: [lng, lat] },
      $maxDistance: radiusMeters
    }
  }
});
```
