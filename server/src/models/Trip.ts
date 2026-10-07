import { Schema, model, Document, Types } from 'mongoose';
import { TripStatus, CustomerLocation, FareBreakdown, PriceRuleType } from '@gomookambika/types';

const customerLocationSchema = new Schema<CustomerLocation>(
  {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, required: true },
    locationId: { type: Schema.Types.ObjectId, ref: 'Location' },
    name: String,
  },
  { _id: false }
);

export interface ITrip extends Document {
  _id: Types.ObjectId;
  tripNumber: string;
  bookingId: Types.ObjectId;
  customerId: Types.ObjectId;
  driverId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  status: TripStatus;
  pickupLocation: CustomerLocation;
  dropLocation: CustomerLocation;
  startOTPHash: string; // Hashed OTP — never expose
  startOTPExpiresAt: Date;
  startOTPVerified: boolean;
  driverArrivedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  actualDistanceKm?: number;
  actualDurationMinutes?: number;
  finalFare?: FareBreakdown;
  driverRating?: number;
  driverRatingComment?: string;
  customerRating?: number;
  customerRatingComment?: string;
  routePolyline?: string; // Encoded polyline for map display
  createdAt: Date;
  updatedAt: Date;
}

const tripSchema = new Schema<ITrip>(
  {
    tripNumber: { type: String, required: true, unique: true, index: true },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: true,
      index: true,
    },
    vehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TripStatus),
      default: TripStatus.DRIVER_ASSIGNED,
      index: true,
    },
    pickupLocation: { type: customerLocationSchema, required: true },
    dropLocation: { type: customerLocationSchema, required: true },
    startOTPHash: { type: String, required: true, select: false },
    startOTPExpiresAt: { type: Date, required: true },
    startOTPVerified: { type: Boolean, default: false },
    driverArrivedAt: Date,
    startedAt: Date,
    completedAt: Date,
    actualDistanceKm: Number,
    actualDurationMinutes: Number,
    finalFare: {
      distanceKm: Number,
      baseFare: Number,
      distanceFare: Number,
      waitingCharge: { type: Number, default: 0 },
      toll: { type: Number, default: 0 },
      parking: { type: Number, default: 0 },
      nightCharge: { type: Number, default: 0 },
      driverAllowance: { type: Number, default: 0 },
      serviceFee: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      total: Number,
      currency: { type: String, default: 'INR' },
      calculatedAt: Date,
    },
    driverRating: { type: Number, min: 1, max: 5 },
    driverRatingComment: String,
    customerRating: { type: Number, min: 1, max: 5 },
    customerRatingComment: String,
    routePolyline: String,
  },
  { timestamps: true }
);

tripSchema.index({ driverId: 1, status: 1 });
tripSchema.index({ customerId: 1, status: 1, createdAt: -1 });

export const Trip = model<ITrip>('Trip', tripSchema);
