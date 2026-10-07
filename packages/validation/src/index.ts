import { z } from 'zod';
import {
  TripType,
  PaymentOption,
  LocationType,
  FuelType,
  DocumentType,
  AssignmentType,
  Status,
} from '@gomookambika/types';

// ─── COMMON SCHEMAS ──────────────────────────────────────────

export const phoneSchema = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, 'Invalid Indian phone number. Format: +91XXXXXXXXXX');

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export const mongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

// ─── AUTH SCHEMAS ────────────────────────────────────────────

export const requestOTPSchema = z.object({
  phone: phoneSchema,
  purpose: z.enum(['LOGIN', 'TRIP_START', 'VERIFY_PHONE']).default('LOGIN'),
});

export const verifyOTPSchema = z.object({
  phone: phoneSchema,
  otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
  purpose: z.enum(['LOGIN', 'TRIP_START', 'VERIFY_PHONE']).default('LOGIN'),
});

export const adminLoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100, 'Password too long'),
});

// ─── USER SCHEMAS ────────────────────────────────────────────

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
});

// ─── DRIVER SCHEMAS ──────────────────────────────────────────

export const createDriverSchema = z.object({
  name: z.string().min(2, 'Name too short').max(100, 'Name too long'),
  phone: z.string().min(10, 'Phone must be at least 10 digits'),
  email: z.string().email().optional().or(z.literal('')),
  address: z
    .object({
      line1: z.string().optional().default('Kollur'),
      line2: z.string().optional(),
      city: z.string().optional().default('Kollur'),
      state: z.string().optional().default('Karnataka'),
      pincode: z.string().optional().default('576220'),
      country: z.string().default('India'),
    })
    .optional(),
  licenseNumber: z.string().min(5).max(25),
  licenseExpiry: z.string().datetime({ offset: true }),
  joiningDate: z.string().datetime({ offset: true }).optional(),
});

export const updateDriverSchema = createDriverSchema.partial().omit({ phone: true });

// ─── VEHICLE CATEGORY SCHEMAS ────────────────────────────────

export const tripFareConfigSchema = z.object({
  baseFare: z.number().min(0).default(0),
  ratePerKm: z.number().min(0).default(0),
  minimumKm: z.number().min(0).default(0),
  waitingChargePerMin: z.number().min(0).default(0),
  nightChargeMultiplier: z.number().min(1).max(3).default(1),
  driverAllowance: z.number().min(0).optional(),
  baseHours: z.number().min(1).optional(),
  baseKm: z.number().min(0).optional(),
  extraKmRate: z.number().min(0).optional(),
  extraHourRate: z.number().min(0).optional(),
});

export const vehicleCategoryFaresSchema = z.object({
  oneWay: tripFareConfigSchema.optional(),
  roundTrip: tripFareConfigSchema.optional(),
  rental: tripFareConfigSchema.optional(),
});

export const createVehicleCategorySchema = z.object({
  name: z.string().min(2).max(50),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers and underscores only'),
  description: z.string().max(500).optional(),
  image: z.string().optional(),
  icon: z.string().optional(),
  seatCapacity: z.number().int().min(1).max(60),
  luggageCapacity: z.number().int().min(0).max(30),
  ac: z.boolean().default(true),
  fuelType: z.nativeEnum(FuelType).optional(),
  baseFare: z.number().min(0).default(0),
  minimumKm: z.number().min(0).default(0),
  ratePerKm: z.number().min(0).default(0),
  ratePerHour: z.number().min(0).optional(),
  extraKmRate: z.number().min(0).optional(),
  extraHourRate: z.number().min(0).optional(),
  waitingChargePerMin: z.number().min(0).default(0),
  nightChargeMultiplier: z.number().min(1).max(3).default(1),
  fares: vehicleCategoryFaresSchema.optional(),
  status: z.nativeEnum(Status).optional(),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateVehicleCategorySchema = createVehicleCategorySchema.partial();

// ─── VEHICLE SCHEMAS ─────────────────────────────────────────

export const createVehicleSchema = z.object({
  registrationNumber: z
    .string()
    .min(3)
    .max(20)
    .toUpperCase(),
  categoryId: mongoIdSchema,
  brand: z.string().min(1).max(50),
  model: z.string().min(1).max(50).optional(),
  vehicleModel: z.string().min(1).max(50).optional(),
  variant: z.string().max(50).optional(),
  manufacturingYear: z.number().int().min(1990).max(new Date().getFullYear() + 1).optional(),
  color: z.string().min(1).max(30).optional(),
  fuelType: z.nativeEnum(FuelType).optional(),
  seatCapacity: z.number().int().min(1).max(60).optional(),
  luggageCapacity: z.number().int().min(0).max(20).optional(),
  ac: z.boolean().optional(),
  ownerName: z.string().min(1).max(100).optional(),
  ownerPhone: phoneSchema.optional(),
  assignedDriverId: mongoIdSchema.optional(),
  status: z.string().optional(),
});

export const updateVehicleSchema = createVehicleSchema.partial().omit({ registrationNumber: true });

// ─── LOCATION SCHEMAS ────────────────────────────────────────

export const createLocationSchema = z.object({
  name: z.string().min(2).max(100),
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_]+$/, 'Code must be uppercase letters, numbers and underscores'),
  type: z.nativeEnum(LocationType),
  description: z.string().max(500).optional(),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: z.string().regex(/^\d{6}$/).optional(),
    country: z.string().default('India'),
  }),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  queueRadius: z.number().min(10).max(5000).default(100),
  queueEnabled: z.boolean().default(false),
  bookingEnabled: z.boolean().default(true),
  qrEnabled: z.boolean().default(false),
  operatingHours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        openTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
        closed: z.boolean().default(false),
      })
    )
    .optional(),
});

export const updateLocationSchema = createLocationSchema.partial().omit({ code: true });

// ─── TAXI STAND SCHEMAS ──────────────────────────────────────

export const createTaxiStandSchema = z.object({
  name: z.string().min(2).max(100),
  locationId: mongoIdSchema,
  queueRadius: z.number().min(10).max(5000).default(100),
  allowedVehicleCategories: z.array(mongoIdSchema).optional(),
  maxQueueSize: z.number().int().min(1).optional(),
  operatingHours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        openTime: z.string().regex(/^\d{2}:\d{2}$/),
        closeTime: z.string().regex(/^\d{2}:\d{2}$/),
        closed: z.boolean().default(false),
      })
    )
    .optional(),
});

// ─── QUEUE SCHEMAS ───────────────────────────────────────────

export const joinQueueSchema = z.object({
  qrToken: z.string().min(10, 'Invalid QR token'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
});

export const queueHeartbeatSchema = z.object({
  queueEntryId: mongoIdSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).optional(),
});

// ─── BOOKING SCHEMAS ─────────────────────────────────────────

export const createBookingSchema = z.object({
  tripType: z.nativeEnum(TripType),
  pickupLocation: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().min(1).max(500),
    locationId: mongoIdSchema.optional(),
    name: z.string().max(100).optional(),
  }),
  dropLocation: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      address: z.string().min(1).max(500),
      locationId: mongoIdSchema.optional(),
      name: z.string().max(100).optional(),
    })
    .optional(),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  passengers: z.number().int().min(1).max(20),
  vehicleCategoryId: mongoIdSchema,
  paymentOption: z.nativeEnum(PaymentOption),
  notes: z.string().max(500).optional(),
});

// ─── FARE SCHEMAS ────────────────────────────────────────────

export const fareEstimateSchema = z.object({
  pickupLatitude: z.number().min(-90).max(90),
  pickupLongitude: z.number().min(-180).max(180),
  dropLatitude: z.number().min(-90).max(90),
  dropLongitude: z.number().min(-180).max(180),
  vehicleCategoryId: mongoIdSchema,
  tripType: z.nativeEnum(TripType),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
  passengers: z.number().int().min(1).max(20).optional(),
  pickupLocationId: mongoIdSchema.optional(),
  dropLocationId: mongoIdSchema.optional(),
});

// ─── VEHICLE ASSIGNMENT SCHEMA ───────────────────────────────

export const assignVehicleSchema = z.object({
  driverId: mongoIdSchema,
  vehicleId: mongoIdSchema,
  assignmentType: z.nativeEnum(AssignmentType),
  startDate: z.string().datetime({ offset: true }),
  endDate: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(500).optional(),
});

// ─── PRICING SCHEMAS ─────────────────────────────────────────

export const createPricingRuleSchema = z
  .object({
    name: z.string().min(2).max(100),
    ruleType: z.enum(['FIXED', 'PER_KM', 'SLAB', 'LOCATION_TO_LOCATION']),
    priority: z.number().int().min(1).max(100).default(50),
    vehicleCategoryId: mongoIdSchema.optional(),
    originLocationId: mongoIdSchema.optional(),
    destinationLocationId: mongoIdSchema.optional(),
    tripType: z.nativeEnum(TripType).optional(),
    fixedPrice: z.number().min(0).optional(),
    baseFare: z.number().min(0).optional(),
    minimumKm: z.number().min(0).optional(),
    ratePerKm: z.number().min(0).optional(),
    slabs: z
      .array(
        z.object({
          fromKm: z.number().min(0),
          toKm: z.number().positive(),
          price: z.number().min(0),
        })
      )
      .optional(),
    validFrom: z.string().datetime({ offset: true }).optional(),
    validTo: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    data => {
      if (data.ruleType === 'FIXED' || data.ruleType === 'LOCATION_TO_LOCATION') {
        return data.fixedPrice !== undefined;
      }
      if (data.ruleType === 'PER_KM') {
        return data.ratePerKm !== undefined;
      }
      if (data.ruleType === 'SLAB') {
        return data.slabs && data.slabs.length > 0;
      }
      return true;
    },
    { message: 'Invalid pricing rule configuration for selected rule type' }
  );

// ─── DOCUMENT SCHEMAS ────────────────────────────────────────

export const uploadDocumentSchema = z.object({
  entityId: mongoIdSchema,
  entityType: z.enum(['driver', 'vehicle']),
  documentType: z.nativeEnum(DocumentType),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});
