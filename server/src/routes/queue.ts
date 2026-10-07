import { Router } from 'express';
import { queueController } from '@/controllers/QueueController';
import { authenticate, requireRoles } from '@/middlewares/auth';
import { validate } from '@/middlewares/validate';
import { joinQueueSchema, queueHeartbeatSchema } from '@gomookambika/validation';
import { UserRole } from '@gomookambika/types';

const router = Router();

router.use(authenticate);

// Driver routes
router.post('/join', requireRoles(UserRole.DRIVER), validate(joinQueueSchema), queueController.joinQueue.bind(queueController));
router.post('/leave', requireRoles(UserRole.DRIVER), queueController.leaveQueue.bind(queueController));
router.post('/heartbeat', requireRoles(UserRole.DRIVER), validate(queueHeartbeatSchema), queueController.heartbeat.bind(queueController));
router.get('/my-status', requireRoles(UserRole.DRIVER), queueController.getMyQueueStatus.bind(queueController));

export default router;
