import { Schema, model, Document, Types } from 'mongoose';
import {
  BookingStatus,
  TripType,
  PaymentOption,
  PaymentStatus,
  CustomerLocation,
  FareBreakdown,
  PriceRuleType,
} from '@gomookambika/types';

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

const fareBreakdownSchema = new Schema<FareBreakdown & { ruleId?: Types.ObjectId; ruleName?: string; ruleType?: PriceRuleType; calculatedAt: Date }>(
  {
    distanceKm: { type: Number, required: true },
    baseFare: { type: Number, required: true, min: 0 },
    distanceFare: { type: Number, required: true, min: 0 },
    waitingCharge: { type: Number, default: 0 },
    toll: { type: Number, default: 0 },
    parking: { type: Number, default: 0 },
    nightCharge: { type: Number, default: 0 },
    driverAllowance: { type: Number, default: 0 },
    serviceFee: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    ruleId: { type: Schema.Types.ObjectId, ref: 'PricingRule' },
    ruleName: String,
    ruleType: { type: String, enum: Object.values(PriceRuleType) },
    calculatedAt: { type: Date, required: true },
  },
  { _id: false }
);

export interface IBooking extends Document {
  _id: Types.ObjectId;
  bookingNumber: string;
  customerId: Types.ObjectId;
  tripType: TripType;
  status: BookingStatus;
  pickupLocation: CustomerLocation;
  dropLocation?: CustomerLocation;
  scheduledAt?: Date;
  passengers: number;
  vehicleCategoryId: Types.ObjectId;
  fareSnapshot: FareBreakdown;
  paymentOption: PaymentOption;
  paymentStatus: PaymentStatus;
  assignedDriverId?: Types.ObjectId;
  assignedVehicleId?: Types.ObjectId;
  driverAssignedAt?: Date;
  originTaxiStandId?: Types.ObjectId;
  destinationTaxiStandId?: Types.ObjectId;
  notes?: string;
  cancellationReason?: string;
  cancelledBy?: Types.ObjectId;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    bookingNumber: {
      type: String,
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
    tripType: {
      type: String,
      enum: Object.values(TripType),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(BookingStatus),
      default: BookingStatus.CONFIRMED,
      index: true,
    },
    pickupLocation: { type: customerLocationSchema, required: true },
    dropLocation: customerLocationSchema,
    scheduledAt: { type: Date, index: true },
    passengers: { type: Number, required: true, min: 1, max: 20 },
    vehicleCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'VehicleCategory',
      required: true,
    },
    fareSnapshot: { type: fareBreakdownSchema, required: true },
    paymentOption: {
      type: String,
      enum: Object.values(PaymentOption),
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    assignedDriverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      index: true,
    },
    assignedVehicleId: {
      type: Schema.Types.ObjectId,
      ref: 'Vehicle',
    },
    driverAssignedAt: Date,
    originTaxiStandId: { type: Schema.Types.ObjectId, ref: 'TaxiStand' },
    destinationTaxiStandId: { type: Schema.Types.ObjectId, ref: 'TaxiStand' },
    notes: { type: String, maxlength: 500 },
    cancellationReason: String,
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
  },
  { timestamps: true }
);

bookingSchema.index({ customerId: 1, status: 1, createdAt: -1 });
bookingSchema.index({ status: 1, scheduledAt: 1 });
bookingSchema.index({ assignedDriverId: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });

export const Booking = model<IBooking>('Booking', bookingSchema);
