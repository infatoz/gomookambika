import mongoose from 'mongoose';
import { config } from './env';
import { logger } from '@/utils/logger';

let isConnected = false;

export async function connectMongoDB(): Promise<void> {
  if (isConnected) return;

  const options: mongoose.ConnectOptions = {
    dbName: config.MONGODB_DB_NAME,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 2,
    retryWrites: true,
  };

  try {
    mongoose.set('strictQuery', true);

    // Event listeners for connection monitoring
    mongoose.connection.on('connected', () => {
      logger.info('✅ MongoDB connected');
      isConnected = true;
    });

    mongoose.connection.on('error', err => {
      logger.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
      isConnected = false;
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
      isConnected = true;
    });

    await mongoose.connect(config.MONGODB_URI, options);
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (!isConnected) return;
  await mongoose.disconnect();
  isConnected = false;
  logger.info('MongoDB disconnected gracefully');
}

export { mongoose };
