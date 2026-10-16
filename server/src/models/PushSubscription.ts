import { Schema, model, Document, Types } from 'mongoose';

export interface IPushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface IPushSubscription extends Document {
  endpoint: string;
  keys: IPushSubscriptionKeys;
  role: 'driver' | 'customer' | 'admin';
  userId?: Types.ObjectId | string;
  phone?: string;
  userAgent?: string;
  lastActive: Date;
  createdAt: Date;
  updatedAt: Date;
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    endpoint: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    role: {
      type: String,
      required: true,
      enum: ['driver', 'customer', 'admin'],
      index: true,
    },
    userId: {
      type: Schema.Types.Mixed,
      index: true,
    },
    phone: {
      type: String,
      index: true,
      trim: true,
    },
    userAgent: {
      type: String,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const PushSubscription = model<IPushSubscription>('PushSubscription', pushSubscriptionSchema);
