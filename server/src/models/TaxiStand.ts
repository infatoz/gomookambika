import { Schema, model, Document, Types } from 'mongoose';
import { QRStatus, Status, OperatingHours } from '@gomookambika/types';

export interface ITaxiStand extends Document {
  _id: Types.ObjectId;
  name: string;
  locationId: Types.ObjectId;
  queueRadius: number;
  qrToken: string; // signed token stored server-side
  qrTokenId: string; // unique ID for this QR version
  qrStatus: QRStatus;
  qrExpiresAt?: Date;
  qrGeneratedAt: Date;
  operatingHours?: OperatingHours[];
  allowedVehicleCategories: Types.ObjectId[];
  queueEnabled: boolean;
  maxQueueSize?: number;
  status: Status;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const taxiStandSchema = new Schema<ITaxiStand>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    locationId: {
      type: Schema.Types.ObjectId,
      ref: 'Location',
      required: true,
      index: true,
    },
    queueRadius: { type: Number, required: true, min: 10, max: 5000 },
    qrToken: { type: String, required: true },
    qrTokenId: { type: String, required: true, unique: true },
    qrStatus: {
      type: String,
      enum: Object.values(QRStatus),
      default: QRStatus.ACTIVE,
      index: true,
    },
    qrExpiresAt: Date,
    qrGeneratedAt: { type: Date, default: Date.now },
    operatingHours: [
      {
        dayOfWeek: { type: Number, min: 0, max: 6, required: true },
        openTime: { type: String, required: true },
        closeTime: { type: String, required: true },
        closed: { type: Boolean, default: false },
        _id: false,
      },
    ],
    allowedVehicleCategories: [
      { type: Schema.Types.ObjectId, ref: 'VehicleCategory' },
    ],
    queueEnabled: { type: Boolean, default: true },
    maxQueueSize: { type: Number, min: 1 },
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

taxiStandSchema.index({ locationId: 1, status: 1 });
// Note: qrTokenId already indexed via unique:true on the field definition

export const TaxiStand = model<ITaxiStand>('TaxiStand', taxiStandSchema);
