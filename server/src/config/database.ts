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

    function maskMongoUri(uri: string): string {
      return uri.replace(/\/\/(.*?:).*?@/, '//$1*****@');
    }

    logger.info(`Connecting to MongoDB: ${maskMongoUri(config.MONGODB_URI)}`);
    await mongoose.connect(config.MONGODB_URI, options);
  } catch (error: any) {
    function maskMongoUri(uri: string): string {
      return uri.replace(/\/\/(.*?:).*?@/, '//$1*****@');
    }
    logger.error(`Failed to connect to MongoDB (${maskMongoUri(config.MONGODB_URI)}): ${error?.message || error}`);
    logger.error('Tip: Please ensure MONGODB_URI is properly set in your Dokpoly Environment Variables.');
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
