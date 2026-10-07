import { Schema, model, Document, Types } from 'mongoose';
import { Status, FuelType } from '@gomookambika/types';

export interface ITripFareDetails {
  baseFare: number;
  ratePerKm: number;
  minimumKm: number;
  waitingChargePerMin: number;
  nightChargeMultiplier: number;
  driverAllowance?: number;
  baseHours?: number;
  baseKm?: number;
  extraKmRate?: number;
  extraHourRate?: number;
}

export interface IVehicleCategoryFares {
  oneWay?: ITripFareDetails;
  roundTrip?: ITripFareDetails;
  rental?: ITripFareDetails;
}

export interface IVehicleCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  image?: string;
  icon?: string;
  seatCapacity: number;
  luggageCapacity: number;
  ac: boolean;
  fuelType?: FuelType;
  baseFare: number;
  minimumKm: number;
  ratePerKm: number;
  ratePerHour?: number;
  extraKmRate: number;
  extraHourRate?: number;
  waitingChargePerMin: number;
  nightChargeMultiplier: number;
  fares?: IVehicleCategoryFares;
  status: Status;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const tripFareSubSchema = {
  baseFare: { type: Number, min: 0, default: 0 },
  ratePerKm: { type: Number, min: 0, default: 0 },
  minimumKm: { type: Number, min: 0, default: 0 },
  waitingChargePerMin: { type: Number, min: 0, default: 0 },
  nightChargeMultiplier: { type: Number, default: 1, min: 1, max: 3 },
  driverAllowance: { type: Number, min: 0, default: 0 },
  baseHours: { type: Number, min: 1, default: 2 },
  baseKm: { type: Number, min: 0, default: 20 },
  extraKmRate: { type: Number, min: 0, default: 0 },
  extraHourRate: { type: Number, min: 0, default: 0 },
};

const vehicleCategorySchema = new Schema<IVehicleCategory>(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: { type: String, maxlength: 500 },
    image: String,
    icon: String,
    seatCapacity: { type: Number, required: true, min: 1, max: 60 },
    luggageCapacity: { type: Number, default: 0, min: 0 },
    ac: { type: Boolean, default: true },
    fuelType: { type: String, enum: Object.values(FuelType) },
    // All fare fields in rupees (not paise)
    baseFare: { type: Number, required: true, min: 0, default: 0 },
    minimumKm: { type: Number, required: true, min: 0, default: 0 },
    ratePerKm: { type: Number, required: true, min: 0, default: 0 },
    ratePerHour: { type: Number, min: 0 },
    extraKmRate: { type: Number, min: 0, default: 0 },
    extraHourRate: { type: Number, min: 0 },
    waitingChargePerMin: { type: Number, default: 0, min: 0 },
    nightChargeMultiplier: { type: Number, default: 1, min: 1, max: 3 },
    fares: {
      oneWay: tripFareSubSchema,
      roundTrip: tripFareSubSchema,
      rental: tripFareSubSchema,
    },
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
      index: true,
    },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Pre-save hook to ensure top-level and fares.oneWay fields are kept synchronized
vehicleCategorySchema.pre('save', function (next) {
  if (this.fares?.oneWay) {
    if (this.fares.oneWay.baseFare !== undefined) this.baseFare = this.fares.oneWay.baseFare;
    if (this.fares.oneWay.ratePerKm !== undefined) this.ratePerKm = this.fares.oneWay.ratePerKm;
    if (this.fares.oneWay.minimumKm !== undefined) this.minimumKm = this.fares.oneWay.minimumKm;
    if (this.fares.oneWay.waitingChargePerMin !== undefined) this.waitingChargePerMin = this.fares.oneWay.waitingChargePerMin;
    if (this.fares.oneWay.nightChargeMultiplier !== undefined) this.nightChargeMultiplier = this.fares.oneWay.nightChargeMultiplier;
  } else if (this.baseFare !== undefined || this.ratePerKm !== undefined) {
    if (!this.fares) this.fares = {};
    this.fares.oneWay = {
      baseFare: this.baseFare ?? 0,
      ratePerKm: this.ratePerKm ?? 0,
      minimumKm: this.minimumKm ?? 0,
      waitingChargePerMin: this.waitingChargePerMin ?? 0,
      nightChargeMultiplier: this.nightChargeMultiplier ?? 1,
    };
  }
  next();
});

vehicleCategorySchema.index({ status: 1, sortOrder: 1 });

export const VehicleCategory = model<IVehicleCategory>('VehicleCategory', vehicleCategorySchema);
