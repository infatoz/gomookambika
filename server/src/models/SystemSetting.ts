import { Schema, model, Document } from 'mongoose';

export interface ISystemSetting extends Document {
  key: string;
  value: unknown;
  category: 'association' | 'queue' | 'dispatch' | 'safety';
  description?: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const systemSettingSchema = new Schema<ISystemSetting>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['association', 'queue', 'dispatch', 'safety'],
      index: true,
    },
    description: {
      type: String,
    },
    updatedBy: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const SystemSetting = model<ISystemSetting>('SystemSetting', systemSettingSchema);
