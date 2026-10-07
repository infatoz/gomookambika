import { Schema, model, Document, Types } from 'mongoose';
import { Status, FuelType } from '@gomookambika/types';

export interface IVehicleCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  image?: string;
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
  status: Status;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

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
    seatCapacity: { type: Number, required: true, min: 1, max: 20 },
    luggageCapacity: { type: Number, default: 0, min: 0 },
    ac: { type: Boolean, default: true },
    fuelType: { type: String, enum: Object.values(FuelType) },
    // All fare fields in rupees (not paise)
    baseFare: { type: Number, required: true, min: 0 },
    minimumKm: { type: Number, required: true, min: 0 },
    ratePerKm: { type: Number, required: true, min: 0 },
    ratePerHour: { type: Number, min: 0 },
    extraKmRate: { type: Number, min: 0, default: 0 },
    extraHourRate: { type: Number, min: 0 },
    waitingChargePerMin: { type: Number, default: 0, min: 0 },
    nightChargeMultiplier: { type: Number, default: 1, min: 1, max: 3 },
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

vehicleCategorySchema.index({ status: 1, sortOrder: 1 });

export const VehicleCategory = model<IVehicleCategory>('VehicleCategory', vehicleCategorySchema);
