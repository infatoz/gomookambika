import { Schema, model, Document, Types } from 'mongoose';
import { UserRole, UserStatus } from '@gomookambika/types';

export interface IUser extends Document {
  _id: Types.ObjectId;
  phone: string;
  name: string;
  email?: string;
  role: UserRole;
  permissions: string[];
  profilePhoto?: string;
  status: UserStatus;
  deviceTokens: string[];
  lastLogin?: Date;
  // Admin-only fields
  passwordHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
      index: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
    profilePhoto: String,
    status: {
      type: String,
      enum: Object.values(UserStatus),
      default: UserStatus.ACTIVE,
      index: true,
    },
    deviceTokens: {
      type: [String],
      default: [],
    },
    lastLogin: Date,
    passwordHash: {
      type: String,
      select: false, // Never return in queries by default
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound indexes
userSchema.index({ role: 1, status: 1 });

export const User = model<IUser>('User', userSchema);
