import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as walletController from '../controllers/wallet.controller';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

router.get('/balance', walletController.getBalance);
router.get('/transactions', walletController.getTransactions);

export default router;
