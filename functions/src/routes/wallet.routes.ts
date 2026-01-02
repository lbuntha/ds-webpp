import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as walletController from '../controllers/wallet.controller';

const router = Router();

// All wallet routes require authentication
router.use(authenticate);

// Main wallet endpoint (returns balance + ledger)
router.get('/ledger', walletController.getWalletLedger);

export default router;
