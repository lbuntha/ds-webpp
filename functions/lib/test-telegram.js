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
const dotenv = __importStar(require("dotenv"));
const telegramService_1 = require("./services/telegramService");
const path = __importStar(require("path"));
// Load .env from functions root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
async function testTelegram() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN is missing in functions/.env');
        console.log('Please create functions/.env and add: TELEGRAM_BOT_TOKEN=your_token');
        return;
    }
    console.log(`✅ Found Token: ${token.slice(0, 5)}...`);
    // Ask for Chat ID via args or hardcode for test
    const chatId = process.argv[2];
    if (!chatId) {
        console.error('❌ Please provide a Chat ID as an argument.');
        console.log('Usage: npx ts-node src/test-telegram.ts <YOUR_CHAT_ID>');
        return;
    }
    const service = new telegramService_1.TelegramService();
    console.log(`Sending test message to ${chatId}...`);
    const success = await service.sendMessage(chatId, '*Test Message form Local Environment* \nIntegration is working!');
    if (success) {
        console.log('✅ Message sent successfully!');
    }
    else {
        console.error('❌ Failed to send message.');
    }
}
testTelegram();
//# sourceMappingURL=test-telegram.js.map