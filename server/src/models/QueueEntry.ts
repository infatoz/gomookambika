import { Schema, model, Document, Types } from 'mongoose';
import { QueueEntryStatus } from '@gomookambika/types';

export interface IQueueEntry extends Document {
  _id: Types.ObjectId;
  taxiStandId: Types.ObjectId;
  driverId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  vehicleCategoryId: Types.ObjectId;
  joinedAt: Date;
  position: number; // 1-based, managed server-side ONLY
  status: QueueEntryStatus;
  lastLocation: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  lastHeartbeat: Date;
  leftAt?: Date;
  tripId?: Types.ObjectId;
  tripOfferedAt?: Date;
  tripAcceptedAt?: Date;
  tripDeclinedAt?: Date;
  removalReason?: string;
  declineCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const queueEntrySchema = new Schema<IQueueEntry>(
  {
    taxiStandId: {
      type: Schema.Types.ObjectId,
      ref: 'TaxiStand',
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
    vehicleCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'VehicleCategory',
      required: true,
      index: true,
    },
    joinedAt: { type: Date, required: true, default: Date.now },
    position: {
      type: Number,
      required: true,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(QueueEntryStatus),
      default: QueueEntryStatus.WAITING,
      index: true,
    },
    lastLocation: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    lastHeartbeat: { type: Date, required: true, default: Date.now },
    leftAt: Date,
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
    tripOfferedAt: Date,
    tripAcceptedAt: Date,
    tripDeclinedAt: Date,
    removalReason: String,
    declineCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Critical compound indexes for queue queries
queueEntrySchema.index({ taxiStandId: 1, status: 1, position: 1 });
queueEntrySchema.index({ taxiStandId: 1, vehicleCategoryId: 1, status: 1, position: 1 });
queueEntrySchema.index({ driverId: 1, status: 1 });
queueEntrySchema.index({ joinedAt: 1 });
queueEntrySchema.index({ lastHeartbeat: 1 }); // For heartbeat monitoring job

export const QueueEntry = model<IQueueEntry>('QueueEntry', queueEntrySchema);
