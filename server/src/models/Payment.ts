import { Schema, model, Document, Types } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '@gomookambika/types';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  paymentNumber: string;
  bookingId: Types.ObjectId;
  tripId?: Types.ObjectId;
  customerId: Types.ObjectId;
  driverId?: Types.ObjectId;
  amount: number; // in rupees
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerSignature?: string;
  refundId?: string;
  refundAmount?: number;
  refundReason?: string;
  refundedAt?: Date;
  metadata?: Map<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    paymentNumber: { type: String, required: true, unique: true, index: true },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    tripId: { type: Schema.Types.ObjectId, ref: 'Trip' },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    driverId: { type: Schema.Types.ObjectId, ref: 'Driver' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    method: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.PENDING,
      index: true,
    },
    providerOrderId: { type: String, sparse: true },
    providerPaymentId: { type: String, sparse: true },
    providerSignature: { type: String, select: false },
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundedAt: Date,
    metadata: { type: Map, of: Schema.Types.Mixed },
  },
  { timestamps: true }
);

paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ customerId: 1, status: 1 });

export const Payment = model<IPayment>('Payment', paymentSchema);
