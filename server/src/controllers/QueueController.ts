import { Request, Response } from 'express';
import { queueService } from '@/services/QueueService';
import { QueueEntry } from '@/models/QueueEntry';
import { QueueEntryStatus } from '@gomookambika/types';

export class QueueController {
  private async getDriverId(userId: string): Promise<string> {
    const { Driver } = await import('@/models/Driver');
    const driver = await Driver.findOne({
      $or: [{ userId }, { _id: userId }],
    });
    return driver ? driver._id.toString() : userId;
  }

  // POST /api/v1/queues/join
  async joinQueue(req: Request, res: Response): Promise<void> {
    const { qrToken, latitude, longitude, accuracy } = req.body;
    const driverId = await this.getDriverId(req.user!.userId);

    const result = await queueService.joinQueue({
      qrToken,
      driverId,
      latitude,
      longitude,
      accuracy,
    });

    res.status(201).json({
      success: true,
      message: `Joined queue at ${result.taxiStandName}. Position: #${result.position}`,
      data: result,
    });
  }

  // POST /api/v1/queues/leave
  async leaveQueue(req: Request, res: Response): Promise<void> {
    const driverId = await this.getDriverId(req.user!.userId);
    await queueService.leaveQueue(driverId);
    res.json({ success: true, message: 'Left queue successfully' });
  }

  // POST /api/v1/queues/heartbeat
  async heartbeat(req: Request, res: Response): Promise<void> {
    const { queueEntryId, latitude, longitude } = req.body;
    const driverId = await this.getDriverId(req.user!.userId);

    const result = await queueService.processHeartbeat({
      queueEntryId,
      driverId,
      latitude,
      longitude,
    });

    res.json({
      success: true,
      data: result,
      ...(result.warningIssued && {
        warning: `You are ${result.distanceMeters.toFixed(0)}m outside the queue radius. Please return to the taxi stand.`,
      }),
    });
  }

  // GET /api/v1/queues/my-status
  async getMyQueueStatus(req: Request, res: Response): Promise<void> {
    const driverId = await this.getDriverId(req.user!.userId);

    // 1. Check for active trip
    const { Trip } = await import('@/models/Trip');
    const { Booking } = await import('@/models/Booking');
    const { TripStatus } = await import('@gomookambika/types');

    const activeTrip = await Trip.findOne({
      $or: [{ driverId }, { driverId: req.user!.userId }],
      status: {
        $in: [
          TripStatus.DRIVER_ACCEPTED,
          TripStatus.DRIVER_ARRIVED,
          TripStatus.TRIP_STARTED,
          TripStatus.TRIP_IN_PROGRESS,
        ],
      },
    })
      .populate('bookingId')
      .populate('customerId', 'name phone');

    let validActiveTrip = null;
    if (activeTrip) {
      const tripAgeHours =
        (Date.now() - new Date(activeTrip.updatedAt || activeTrip.createdAt).getTime()) /
        (1000 * 60 * 60);
      if (tripAgeHours > 3) {
        await Trip.findByIdAndUpdate(activeTrip._id, {
          status: TripStatus.TRIP_COMPLETED,
          completedAt: new Date(),
        });
        if (activeTrip.bookingId) {
          await Booking.findByIdAndUpdate(
            (activeTrip.bookingId as any)._id || activeTrip.bookingId,
            { status: TripStatus.TRIP_COMPLETED }
          );
        }
      } else {
        validActiveTrip = activeTrip;
      }
    }

    const entry = await QueueEntry.findOne({
      $or: [{ driverId }, { driverId: req.user!.userId }],
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED] },
    })
      .populate('taxiStandId', 'name locationId')
      .populate('vehicleCategoryId', 'name code');

    if (!entry) {
      res.json({
        success: true,
        data: validActiveTrip ? { activeTrip: validActiveTrip } : null,
        message: validActiveTrip ? 'Driver is currently on active trip' : 'Not currently in any queue',
      });
      return;
    }

    // Count drivers ahead
    const driversAhead = await QueueEntry.countDocuments({
      taxiStandId: entry.taxiStandId,
      position: { $lt: entry.position },
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED] },
    });

    res.json({
      success: true,
      data: {
        ...entry.toJSON(),
        inQueue: true,
        entry: {
          _id: entry._id.toString(),
          taxiStandId: entry.taxiStandId,
          position: entry.position,
          enteredAt: (entry as any).joinedAt || (entry as any).createdAt || new Date().toISOString(),
          joinedAt: (entry as any).joinedAt,
        },
        driversAhead,
        estimatedWaitMinutes: driversAhead * 15,
        activeTrip: validActiveTrip,
      },
    });
  }
}

export const queueController = new QueueController();
