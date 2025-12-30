import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as driverController from '../controllers/driver.controller';

const router = Router();

// All driver routes require authentication
router.use(authenticate);
router.use(requireRole(['driver']));

router.get('/jobs', driverController.getJobs);
router.post('/accept/:id', driverController.acceptJob);
router.post('/complete/:id', driverController.completeDelivery);

export default router;
