import { Schema, model, Document, Types } from 'mongoose';
import { OTPPurpose } from '@gomookambika/types';

export interface IOTPRecord extends Document {
  _id: Types.ObjectId;
  phone: string;
  otpHash: string;
  purpose: OTPPurpose;
  attempts: number;
  expiresAt: Date;
  usedAt?: Date;
  ipAddress: string;
  createdAt: Date;
}

const otpRecordSchema = new Schema<IOTPRecord>(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
      select: false, // Never expose hash
    },
    purpose: {
      type: String,
      enum: Object.values(OTPPurpose),
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL index
    },
    usedAt: Date,
    ipAddress: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

otpRecordSchema.index({ phone: 1, purpose: 1 });

export const OTPRecord = model<IOTPRecord>('OTPRecord', otpRecordSchema);
