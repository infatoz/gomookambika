import { Schema, model, Document, Types } from 'mongoose';
import { VehicleStatus, FuelType, DocumentType } from '@gomookambika/types';

export interface IVehicleDocument {
  type: DocumentType;
  fileUrl: string;
  expiresAt?: Date;
  verified: boolean;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
}

export interface IVehicle extends Document {
  _id: Types.ObjectId;
  registrationNumber: string;
  categoryId: Types.ObjectId;
  brand: string;
  vehicleModel: string;  // Renamed from 'model' to avoid conflict with Mongoose Document
  variant?: string;
  manufacturingYear: number;
  color: string;
  fuelType: FuelType;
  seatCapacity: number;
  luggageCapacity: number;
  ac: boolean;
  ownerName: string;
  ownerPhone?: string;
  assignedDriverId?: Types.ObjectId;
  status: VehicleStatus;
  documents: IVehicleDocument[];
  createdAt: Date;
  updatedAt: Date;
}

const vehicleDocumentSchema = new Schema<IVehicleDocument>(
  {
    type: { type: String, enum: Object.values(DocumentType), required: true },
    fileUrl: { type: String, required: true },
    expiresAt: Date,
    verified: { type: Boolean, default: false },
    verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date,
  },
  { _id: false }
);

const vehicleSchema = new Schema<IVehicle>(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'VehicleCategory',
      required: true,
      index: true,
    },
    brand: { type: String, required: true, trim: true },
    vehicleModel: { type: String, required: true, trim: true },
    variant: { type: String, trim: true },
    manufacturingYear: { type: Number, required: true },
    color: { type: String, required: true, trim: true },
    fuelType: { type: String, enum: Object.values(FuelType), required: true },
    seatCapacity: { type: Number, required: true, min: 1 },
    luggageCapacity: { type: Number, default: 0, min: 0 },
    ac: { type: Boolean, default: true },
    ownerName: { type: String, required: true, trim: true },
    ownerPhone: String,
    assignedDriverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(VehicleStatus),
      default: VehicleStatus.ACTIVE,
      index: true,
    },
    documents: [vehicleDocumentSchema],
  },
  { timestamps: true }
);

vehicleSchema.index({ status: 1, categoryId: 1 });
vehicleSchema.index({ 'documents.expiresAt': 1 });

export const Vehicle = model<IVehicle>('Vehicle', vehicleSchema);
