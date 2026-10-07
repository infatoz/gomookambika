import { Request, Response } from 'express';
import { queueService } from '@/services/QueueService';
import { QueueEntry } from '@/models/QueueEntry';
import { QueueEntryStatus } from '@gomookambika/types';

export class QueueController {
  // POST /api/v1/queues/join
  async joinQueue(req: Request, res: Response): Promise<void> {
    const { qrToken, latitude, longitude, accuracy } = req.body;
    const driverId = req.user!.userId;

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
    const driverId = req.user!.userId;
    await queueService.leaveQueue(driverId);
    res.json({ success: true, message: 'Left queue successfully' });
  }

  // POST /api/v1/queues/heartbeat
  async heartbeat(req: Request, res: Response): Promise<void> {
    const { queueEntryId, latitude, longitude } = req.body;
    const driverId = req.user!.userId;

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
    const driverId = req.user!.userId;

    const entry = await QueueEntry.findOne({
      driverId,
      status: { $in: [QueueEntryStatus.WAITING, QueueEntryStatus.OFFERED] },
    })
      .populate('taxiStandId', 'name locationId')
      .populate('vehicleCategoryId', 'name code');

    if (!entry) {
      res.json({ success: true, data: null, message: 'Not currently in any queue' });
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
        driversAhead,
        estimatedWaitMinutes: driversAhead * 15, // Simple estimate: 15 min per driver
      },
    });
  }
}

export const queueController = new QueueController();
