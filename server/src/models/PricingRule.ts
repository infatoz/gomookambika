import { Schema, model, Document, Types } from 'mongoose';
import { PriceRuleType, TripType, Status, CalcMethod, ChargeType } from '@gomookambika/types';

// ─── PRICING RULE ────────────────────────────────────────────

interface IPriceSlab {
  fromKm: number;
  toKm: number;
  price: number;
}

export interface IPricingRule extends Document {
  _id: Types.ObjectId;
  name: string;
  ruleType: PriceRuleType;
  priority: number; // Lower number = higher priority
  vehicleCategoryId?: Types.ObjectId;
  originLocationId?: Types.ObjectId;
  destinationLocationId?: Types.ObjectId;
  isBidirectional?: boolean;
  tripType?: TripType;
  fixedPrice?: number;
  baseFare?: number;
  minimumKm?: number;
  ratePerKm?: number;
  includedKm?: number;
  extraKmRate?: number;
  description?: string;
  slabs?: IPriceSlab[];
  validFrom?: Date;
  validTo?: Date;
  status: Status;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const pricingRuleSchema = new Schema<IPricingRule>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    ruleType: {
      type: String,
      enum: Object.values(PriceRuleType),
      required: true,
      index: true,
    },
    priority: { type: Number, required: true, min: 1, max: 100, default: 50 },
    vehicleCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'VehicleCategory',
      index: true,
    },
    originLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
    },
    destinationLocationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
    },
    isBidirectional: { type: Boolean, default: true },
    tripType: { type: String, enum: Object.values(TripType) },
    fixedPrice: { type: Number, min: 0 },
    baseFare: { type: Number, min: 0 },
    minimumKm: { type: Number, min: 0 },
    ratePerKm: { type: Number, min: 0 },
    includedKm: { type: Number, min: 0 },
    extraKmRate: { type: Number, min: 0 },
    description: { type: String, trim: true, maxlength: 500 },
    slabs: [
      {
        fromKm: { type: Number, required: true, min: 0 },
        toKm: { type: Number, required: true },
        price: { type: Number, required: true, min: 0 },
        _id: false,
      },
    ],
    validFrom: Date,
    validTo: Date,
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
      index: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

pricingRuleSchema.index({ status: 1, priority: 1 });
pricingRuleSchema.index({ vehicleCategoryId: 1, status: 1 });
pricingRuleSchema.index({ originLocationId: 1, destinationLocationId: 1, vehicleCategoryId: 1 });

export const PricingRule = model<IPricingRule>('PricingRule', pricingRuleSchema);

// ─── ADDITIONAL CHARGES ──────────────────────────────────────

export interface IAdditionalCharge extends Document {
  _id: Types.ObjectId;
  chargeType: ChargeType;
  name: string;
  calculationMethod: CalcMethod;
  value: number;
  freeMinutes?: number; // For WAITING charges
  applicableTripTypes: TripType[];
  applicableVehicleCategories: Types.ObjectId[];
  status: Status;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const additionalChargeSchema = new Schema<IAdditionalCharge>(
  {
    chargeType: {
      type: String,
      enum: Object.values(ChargeType),
      required: true,
      unique: true,
    },
    name: { type: String, required: true, trim: true },
    calculationMethod: {
      type: String,
      enum: Object.values(CalcMethod),
      required: true,
    },
    value: { type: Number, required: true, min: 0 },
    freeMinutes: { type: Number, min: 0, default: 0 },
    applicableTripTypes: [{ type: String, enum: Object.values(TripType) }],
    applicableVehicleCategories: [{ type: Schema.Types.ObjectId, ref: 'VehicleCategory' }],
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

export const AdditionalCharge = model<IAdditionalCharge>('AdditionalCharge', additionalChargeSchema);
