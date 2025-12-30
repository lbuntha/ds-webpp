import { Router } from 'express';
import * as authController from '../controllers/auth.controller';

const router = Router();

// Authentication endpoints
router.post('/request-otp', authController.requestOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);
router.post('/reset-password-otp', authController.resetPasswordWithOTP);

export default router;
