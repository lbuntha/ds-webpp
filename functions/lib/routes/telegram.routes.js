"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.telegramRoutes = void 0;
const express_1 = require("express");
const telegram_controller_1 = require("../controllers/telegram.controller");
const router = (0, express_1.Router)();
// Endpoint: POST /telegram/webhook
router.post('/webhook', telegram_controller_1.handleWebhook);
// Endpoint: POST /telegram/broadcast
router.post('/broadcast', telegram_controller_1.handleBroadcast);
exports.telegramRoutes = router;
//# sourceMappingURL=telegram.routes.js.map