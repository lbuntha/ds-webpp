
import { Router } from 'express';
import { handleWebhook } from '../controllers/telegram.controller';

const router = Router();

// Endpoint: POST /telegram/webhook
router.post('/webhook', handleWebhook);

export const telegramRoutes = router;
