"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleWebhook = void 0;
const admin = __importStar(require("firebase-admin"));
const telegramService_1 = require("../services/telegramService");
const telegramService = new telegramService_1.TelegramService();
const handleWebhook = async (req, res) => {
    try {
        const update = req.body;
        // Basic validation
        if (!update || !update.message) {
            // Telegram sends other updates too, just ignore them successfully
            return res.status(200).send('OK');
        }
        const message = update.message;
        const chatId = message.chat.id;
        const text = message.text;
        console.log(`[Telegram Webhook] Received message from ${chatId}: ${text}`);
        // Check for /start <UID>
        if (text && text.startsWith('/start ')) {
            const parts = text.split(' ');
            if (parts.length < 2) {
                await telegramService.sendMessage(chatId.toString(), "Welcome! Please use the 'Connect Telegram' button from the App to link your account.");
                return res.status(200).send('OK');
            }
            const uid = parts[1].trim();
            // 1. Find User by UID
            const userDoc = await admin.firestore().collection('users').doc(uid).get();
            if (!userDoc.exists) {
                await telegramService.sendMessage(chatId.toString(), "❌ Error: User account not found. Please try again from the App.");
                return res.status(200).send('OK');
            }
            const userData = userDoc.data();
            const customerId = userData === null || userData === void 0 ? void 0 : userData.linkedCustomerId;
            if (!customerId) {
                await telegramService.sendMessage(chatId.toString(), "❌ Error: No customer profile linked to your account.");
                return res.status(200).send('OK');
            }
            // 2. Update Customer with Chat ID
            // We use the chatId as string
            await admin.firestore().collection('customers').doc(customerId).update({
                telegramChatId: chatId.toString()
            });
            // 3. Confirm success
            await telegramService.sendMessage(chatId.toString(), `✅ *Success!* Your Telegram account has been linked to *${userData === null || userData === void 0 ? void 0 : userData.name}*.\n\nYou will now receive settlement reports and notifications here.`);
            console.log(`[Telegram Webhook] Linked Chat ID ${chatId} to Customer ${customerId}`);
        }
        else {
            // Handle other commands or default
            // Maybe just ignore or say hello
            // await telegramService.sendMessage(chatId.toString(), "I am a notification bot. Please use the App to manage your account.");
        }
        return res.status(200).send('OK');
    }
    catch (error) {
        console.error('Telegram Webhook Error:', error);
        // Always return 200 to Telegram to prevent retry loops
        return res.status(200).send('Error');
    }
};
exports.handleWebhook = handleWebhook;
//# sourceMappingURL=telegram.controller.js.map