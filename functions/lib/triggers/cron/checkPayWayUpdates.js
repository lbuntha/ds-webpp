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
exports.checkPayWayUpdates = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const telegram_1 = require("telegram");
const sessions_1 = require("telegram/sessions");
const paywayParser_service_1 = require("../../services/paywayParser.service");
const db = admin.firestore();
// Configuration
const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;
const SESSION_STRING = process.env.TELEGRAM_APP_SESSION;
// You can set the target group ID here or in .env
// If strictly PayWay bot, we can filter by sender 'PayWay' or specific ID
const PAYWAY_SENDER_NAMES = ['PayWay', 'PayWay by ABA'];
exports.checkPayWayUpdates = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    if (!API_ID || !API_HASH || !SESSION_STRING) {
        console.error("Missing Telegram Client credentials.");
        return;
    }
    const client = new telegram_1.TelegramClient(new sessions_1.StringSession(SESSION_STRING), API_ID, API_HASH, {
        connectionRetries: 1,
    });
    try {
        console.log("Connecting to Telegram Client...");
        await client.connect();
        // Ideally, we know the Group ID. 
        // For now, let's assume we are looking for messages in a specific group ID stored in config
        // OR we just check the 'common' dialogs. 
        // A better approach for the user: Look for the group titled "DoorStep (Delivery)" (or whatever they use).
        // Let's rely on an ENV or just a known dialog name.
        // TODO: Move to ENV. For now, we search.
        const TARGET_GROUP_TITLE = 'DoorStep (Delivery)'; // Adjust if needed
        const dialogs = await client.getDialogs({ limit: 20 });
        const group = dialogs.find((d) => d.title === TARGET_GROUP_TITLE || d.name === TARGET_GROUP_TITLE);
        if (!group) {
            console.log(`Group '${TARGET_GROUP_TITLE}' not found in recent dialogs.`);
            return;
        }
        const history = await client.getMessages(group.entity, { limit: 10 });
        let newCount = 0;
        for (const msg of history) {
            // Check if from PayWay (Sender)
            // msg.sender could be a User or Channel. 
            // We need to fetch sender info or check title.
            // Cast sender to any to safely access properties, or check instance type
            const senderObject = await msg.getSender();
            const senderAny = senderObject;
            const senderName = (senderAny === null || senderAny === void 0 ? void 0 : senderAny.firstName) || (senderAny === null || senderAny === void 0 ? void 0 : senderAny.title) || 'Unknown';
            // Check signature in message or sender name
            // PayWay usually appears as a user named "PayWay by ABA" or similar
            // Simple check:
            const isPayWay = PAYWAY_SENDER_NAMES.some(n => senderName.includes(n)) ||
                (msg.message && msg.message.includes('PayWay'));
            if (isPayWay) {
                // Idempotency Check
                const msgId = msg.id.toString();
                // Ensure group.id exists and is converted to string safely
                const groupIdStr = group.id ? group.id.toString() : 'unknown_chat';
                const updateId = `${groupIdStr}_${msgId}`; // Composite ID
                const exists = await db.collection('telegram_messages').doc(updateId).get();
                if (exists.exists)
                    continue;
                // Parse immediately or just save raw?
                // Plan said: Save to Firestore -> telegram_messages.
                // Let's parse immediately to save fields, but keep raw too.
                const parsed = paywayParser_service_1.PayWayParser.parse(msg.message || '');
                await db.collection('telegram_messages').doc(updateId).set({
                    updateId: updateId, // Unique Key
                    messageId: msgId,
                    chatId: groupIdStr,
                    chatTitle: group.title,
                    from: senderName,
                    text: msg.message,
                    date: new Date(msg.date * 1000),
                    processed: !!parsed, // Mark processed if we successfully parsed it
                    transactionData: parsed || null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'userbot_poll'
                });
                newCount++;
            }
        }
        console.log(`Synced ${newCount} new PayWay messages.`);
    }
    catch (e) {
        console.error("Userbot Error:", e);
    }
    finally {
        await client.disconnect();
    }
});
//# sourceMappingURL=checkPayWayUpdates.js.map