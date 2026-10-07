import { Schema, model, Document, Types } from 'mongoose';

// AuditLog is immutable — no updatedAt
export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  adminName: string;
  action: string;
  module: string;
  entityId?: Types.ObjectId;
  entityType?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress: string;
  userAgent?: string;
  timestamp: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    adminName: { type: String, required: true },
    action: { type: String, required: true, index: true },
    module: { type: String, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, index: true },
    entityType: String,
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    ipAddress: { type: String, required: true },
    userAgent: String,
    timestamp: { type: Date, default: Date.now, index: true },
  },
  {
    // No timestamps — we use our own immutable timestamp field
    timestamps: false,
    // Never allow updates to audit logs through Mongoose
  }
);

auditLogSchema.index({ adminId: 1, timestamp: -1 });
auditLogSchema.index({ module: 1, timestamp: -1 });
auditLogSchema.index({ entityId: 1, entityType: 1 });

// Prevent updates (audit logs are immutable)
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    next(new Error('AuditLog records are immutable and cannot be modified'));
    return;
  }
  next();
});

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
