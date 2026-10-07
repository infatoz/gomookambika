import { Schema, model, Document, Types } from 'mongoose';
import {
  DriverStatus,
  FuelType,
  DocumentType,
  Address,
  GeoPoint,
} from '@gomookambika/types';

export interface IDriverDocument {
  type: DocumentType;
  fileUrl: string;
  expiresAt?: Date;
  verified: boolean;
  verifiedBy?: Types.ObjectId;
  verifiedAt?: Date;
}

export interface IDriver extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  driverCode: string;
  name: string;
  phone: string;
  email?: string;
  photo?: string;
  address: Address;
  licenseNumber: string;
  licenseExpiry: Date;
  joiningDate: Date;
  status: DriverStatus;
  rating: number;
  ratingCount: number;
  totalTrips: number;
  totalEarnings: number;
  documents: IDriverDocument[];
  currentLocation?: GeoPoint;
  lastSeen?: Date;
  activeQueueEntryId?: Types.ObjectId;
  activeTripId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const driverDocumentSchema = new Schema<IDriverDocument>(
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

const driverSchema = new Schema<IDriver>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    driverCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, index: true },
    email: { type: String, trim: true, lowercase: true },
    photo: String,
    address: {
      line1: { type: String, default: 'Kollur' },
      line2: { type: String, default: '' },
      city: { type: String, default: 'Kollur' },
      state: { type: String, default: 'Karnataka' },
      pincode: { type: String, default: '576220' },
      country: { type: String, default: 'India' },
    },
    licenseNumber: { type: String, required: true },
    licenseExpiry: { type: Date, required: true },
    joiningDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: Object.values(DriverStatus),
      default: DriverStatus.OFFLINE,
      index: true,
    },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
    totalTrips: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    documents: [driverDocumentSchema],
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: (v: number[]) => v.length === 2,
          message: 'Coordinates must be [longitude, latitude]',
        },
      },
    },
    lastSeen: Date,
    activeQueueEntryId: { type: Schema.Types.ObjectId, ref: 'QueueEntry' },
    activeTripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
  },
  { timestamps: true }
);

// Geospatial index for proximity queries
driverSchema.index({ currentLocation: '2dsphere' });
driverSchema.index({ status: 1, lastSeen: 1 });
driverSchema.index({ 'documents.expiresAt': 1 }); // For expiry alerts

export const Driver = model<IDriver>('Driver', driverSchema);
