import { Server as SocketServer } from 'socket.io';
import http from 'http';
import jwt from 'jsonwebtoken';
import { config } from '@/config/env';
import { logger } from '@/utils/logger';
import { SocketEvent } from '@gomookambika/types';
import { Driver } from '@/models/Driver';
import { Trip } from '@/models/Trip';

let io: SocketServer;

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

export function tryGetIO(): SocketServer | null {
  return io ?? null;
}

export function initializeSocket(server: http.Server): SocketServer {
  io = new SocketServer(server, {
    cors: {
      origin: (_origin, callback) => callback(null, true),
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // ─── JWT AUTHENTICATION MIDDLEWARE ────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth.token ?? socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const payload = jwt.verify(token, config.JWT_SECRET) as { userId: string; role: string };
      socket.data.userId = payload.userId;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', socket => {
    const { userId, role } = socket.data;
    logger.info(`Socket connected: userId=${userId} role=${role} socketId=${socket.id}`);

    // ─── JOIN PERSONAL ROOM ────────────────────────────────
    socket.join(`${role.toLowerCase()}:${userId}`);

    // If driver, also join room with driver document id
    if (role === 'DRIVER') {
      Driver.findOne({ $or: [{ userId }, { _id: userId }] })
        .then(driver => {
          if (driver) {
            socket.join(`driver:${driver._id.toString()}`);
            logger.info(`Driver socket ${socket.id} joined room driver:${driver._id.toString()}`);
          }
        })
        .catch(err => logger.error('Error finding driver for socket room:', err));
    }

    // Admin joins ops room
    if (['SUPER_ADMIN', 'ASSOCIATION_ADMIN', 'OPERATIONS_MANAGER', 'QUEUE_MANAGER'].includes(role)) {
      socket.join('admin:operations');
    }

    // ─── DRIVER LOCATION UPDATE ──────────────────────────
    socket.on(SocketEvent.DRIVER_LOCATION_UPDATE, async data => {
      try {
        const { latitude, longitude, heading, speed, accuracy } = data;

        // Validate basic structure
        if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

        // Update driver location in DB
        await Driver.findOneAndUpdate(
          { userId },
          {
            currentLocation: { type: 'Point', coordinates: [longitude, latitude] },
            lastSeen: new Date(),
          }
        );

        // If driver is on a trip, broadcast to customer
        const activeTrip = await Trip.findOne({
          driverId: (await Driver.findOne({ userId }))!._id,
          status: { $in: ['DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_IN_PROGRESS'] },
        }).select('customerId _id');

        if (activeTrip) {
          io.to(`trip:${activeTrip._id}`).emit(SocketEvent.TRIP_DRIVER_LOCATION, {
            tripId: activeTrip._id,
            latitude,
            longitude,
            heading,
            speed,
            accuracy,
            timestamp: Date.now(),
          });
        }
      } catch (err) {
        logger.error('Error processing driver location update:', err);
      }
    });

    // ─── DRIVER HEARTBEAT ────────────────────────────────
    socket.on(SocketEvent.DRIVER_HEARTBEAT, async data => {
      try {
        const { queueEntryId, latitude, longitude } = data;
        if (!queueEntryId || typeof latitude !== 'number' || typeof longitude !== 'number') return;

        const { queueService } = await import('@/services/QueueService');
        const result = await queueService.processHeartbeat({
          queueEntryId,
          driverId: userId,
          latitude,
          longitude,
        });

        if (result.warningIssued) {
          socket.emit(SocketEvent.QUEUE_WARNING, {
            message: `You are ${result.distanceMeters.toFixed(0)}m outside the queue radius. Please return to the taxi stand.`,
            distanceMeters: result.distanceMeters,
          });
        }
      } catch (err) {
        logger.error('Error processing heartbeat:', err);
      }
    });

    // ─── JOIN TRIP ROOM (for live tracking) ──────────────
    socket.on('trip:join', async ({ tripId }) => {
      if (!tripId) return;
      // Verify user is part of this trip
      const trip = await Trip.findById(tripId);
      if (!trip) return;
      const driver = await Driver.findOne({ userId });

      const isCustomer = trip.customerId.toString() === userId;
      const isDriver = driver && trip.driverId.toString() === driver._id.toString();

      if (isCustomer || isDriver) {
        socket.join(`trip:${tripId}`);
        logger.info(`User ${userId} joined trip room: ${tripId}`);
      }
    });

    // ─── DISCONNECT ──────────────────────────────────────
    socket.on('disconnect', reason => {
      logger.info(`Socket disconnected: userId=${userId} reason=${reason}`);
    });

    socket.on('error', err => {
      logger.error(`Socket error for ${userId}:`, err);
    });
  });

  logger.info('✅ Socket.IO initialized');
  return io;
}
