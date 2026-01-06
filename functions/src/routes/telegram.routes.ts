
import { Router } from 'express';
import { handleWebhook, handleBroadcast } from '../controllers/telegram.controller';

const router = Router();

// Endpoint: POST /telegram/webhook
router.post('/webhook', handleWebhook);

// Endpoint: POST /telegram/broadcast
router.post('/broadcast', handleBroadcast);

export const telegramRoutes = router;

