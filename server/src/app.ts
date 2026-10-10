import 'express-async-errors';
import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

import { config } from '@/config/env';
import { connectMongoDB } from '@/config/database';
import { connectRedis } from '@/config/redis';
import { initializeSocket } from '@/sockets';
import { setupRoutes } from '@/routes';
import { errorHandler } from '@/middlewares/errorHandler';
import { notFoundHandler } from '@/middlewares/notFoundHandler';
import { rateLimiter } from '@/middlewares/rateLimiter';
import { logger, httpLogStream } from '@/utils/logger';
import { setupSwagger } from '@/config/swagger';

const app = express();
const server = http.createServer(app);

// ─── SECURITY MIDDLEWARE ─────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:', 'http:'],
        connectSrc: ["'self'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin: (_origin, callback) => callback(null, true),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// ─── STATIC ASSETS & UPLOADS ─────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── BODY PARSING ────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression() as any); // eslint-disable-line @typescript-eslint/no-explicit-any

// ─── LOGGING ─────────────────────────────────────────────────
if (config.NODE_ENV !== 'test') {
  app.use(
    morgan('combined', {
      stream: httpLogStream,
    })
  );
}

// ─── RATE LIMITING ───────────────────────────────────────────
app.use('/api', rateLimiter);

// ─── HEALTH CHECK ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'Go Mookambika API is running',
    timestamp: new Date().toISOString(),
    version: config.API_VERSION,
    environment: config.NODE_ENV,
  });
});

// ─── API ROUTES ──────────────────────────────────────────────
setupRoutes(app);

// ─── SWAGGER DOCS ────────────────────────────────────────────
if (config.SWAGGER_ENABLED) {
  setupSwagger(app);
}

// ─── STATIC WEB APP FALLBACK (Customer PWA on port 5000) ───────
const customerWebPath = process.env.CUSTOMER_WEB_PATH || '/var/www/customer';
if (fs.existsSync(customerWebPath)) {
  app.use(express.static(customerWebPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path === '/health') {
      return next();
    }
    const indexPath = path.join(customerWebPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

// ─── ERROR HANDLING ──────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── SOCKET.IO ───────────────────────────────────────────────
initializeSocket(server);

// ─── STARTUP ─────────────────────────────────────────────────
async function startServer() {
  try {
    // MongoDB is required — fatal if unavailable
    await connectMongoDB();

    // Redis is optional — server runs in degraded mode without it
    await connectRedis();

    server.listen(config.PORT, () => {
      logger.info(`🚀 Go Mookambika API started`);
      logger.info(`   Environment: ${config.NODE_ENV}`);
      logger.info(`   Port: ${config.PORT}`);
      logger.info(`   API: http://localhost:${config.PORT}/api/${config.API_VERSION}`);
      if (config.SWAGGER_ENABLED) {
        logger.info(`   Docs: http://localhost:${config.PORT}/api-docs`);
      }
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();

export { app, server };
