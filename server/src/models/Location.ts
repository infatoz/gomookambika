import { Schema, model, Document, Types } from 'mongoose';
import { LocationType, Status, OperatingHours } from '@gomookambika/types';

export interface ILocation extends Document {
  _id: Types.ObjectId;
  name: string;
  code: string;
  type: LocationType;
  description?: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode?: string;
    country: string;
  };
  geoPoint: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  queueRadius: number;
  queueEnabled: boolean;
  bookingEnabled: boolean;
  qrEnabled: boolean;
  operatingHours?: OperatingHours[];
  status: Status;
  metadata?: Map<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const locationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(LocationType),
      required: true,
      index: true,
    },
    description: { type: String, maxlength: 500 },
    address: {
      line1: { type: String, required: true },
      line2: String,
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: String,
      country: { type: String, default: 'India' },
    },
    geoPoint: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: (v: number[]) =>
            v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90,
          message: 'Invalid coordinates [longitude, latitude]',
        },
      },
    },
    queueRadius: { type: Number, default: 100, min: 10, max: 5000 },
    queueEnabled: { type: Boolean, default: false },
    bookingEnabled: { type: Boolean, default: true },
    qrEnabled: { type: Boolean, default: false },
    operatingHours: [
      {
        dayOfWeek: { type: Number, min: 0, max: 6, required: true },
        openTime: { type: String, required: true },
        closeTime: { type: String, required: true },
        closed: { type: Boolean, default: false },
        _id: false,
      },
    ],
    status: {
      type: String,
      enum: Object.values(Status),
      default: Status.ACTIVE,
      index: true,
    },
    metadata: { type: Map, of: Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Sparse 2dsphere index — only applied to documents that have coordinates
locationSchema.index({ geoPoint: '2dsphere' }, { sparse: true });
locationSchema.index({ type: 1, status: 1 });

export const Location = model<ILocation>('Location', locationSchema);
