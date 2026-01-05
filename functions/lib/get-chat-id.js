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
const path = __importStar(require("path"));
// Load .env from functions root
dotenv.config({ path: path.resolve(__dirname, '../.env') });
async function getChatId() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN is missing in functions/.env');
        return;
    }
    console.log(`Checking updates for bot...`);
    try {
        const url = `https://api.telegram.org/bot${token}/getUpdates`;
        const response = await fetch(url);
        const data = await response.json();
        if (!data.ok) {
            console.error('❌ Telegram API Error:', data.description);
            return;
        }
        const updates = data.result;
        if (!updates || updates.length === 0) {
            console.log('⚠️ No messages found.');
            console.log('👉 Please open your bot in Telegram and send a message (e.g., "Hello").');
            console.log('   Then run this script again.');
            return;
        }
        // Get the last message
        const lastUpdate = updates[updates.length - 1];
        const message = lastUpdate.message || lastUpdate.edited_message || lastUpdate.channel_post;
        if (message && message.chat) {
            console.log('\n✅ FOUND CHAT ID:');
            console.log(`   ${message.chat.id}`);
            console.log(`   (From User: ${message.chat.first_name || ''} ${message.chat.last_name || ''})`);
        }
        else {
            console.log('⚠️ Found activity, but could not determine Chat ID. Please send a clear text message to the bot.');
            console.log('Debug:', JSON.stringify(lastUpdate, null, 2));
        }
    }
    catch (error) {
        console.error('❌ Failed to connect to Telegram API:', error);
    }
}
getChatId();
//# sourceMappingURL=get-chat-id.js.map