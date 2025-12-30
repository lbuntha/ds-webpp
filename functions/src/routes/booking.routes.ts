import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as bookingController from '../controllers/booking.controller';

const router = Router();

// All booking routes require authentication
router.use(authenticate);

router.post('/create', bookingController.createBooking);
router.get('/', bookingController.listBookings);
router.get('/:id', bookingController.getBookingDetails);

export default router;
