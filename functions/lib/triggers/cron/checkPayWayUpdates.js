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
// PayWay sender names to match
const PAYWAY_SENDER_NAMES = ['PayWay', 'PayWay by ABA'];
exports.checkPayWayUpdates = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    if (!API_ID || !API_HASH || !SESSION_STRING) {
        console.error("Missing Telegram Client credentials.");
        return;
    }
    // Fetch active telegram groups from Firestore
    const groupsSnapshot = await db.collection('telegram_groups')
        .where('isActive', '==', true)
        .where('monitorPayWay', '==', true)
        .get();
    if (groupsSnapshot.empty) {
        console.log("No active telegram groups configured for PayWay monitoring.");
        return;
    }
    const telegramGroups = groupsSnapshot.docs.map(doc => doc.data());
    console.log(`Found ${telegramGroups.length} active telegram groups to monitor.`);
    const client = new telegram_1.TelegramClient(new sessions_1.StringSession(SESSION_STRING), API_ID, API_HASH, {
        connectionRetries: 1,
    });
    try {
        console.log("Connecting to Telegram Client...");
        await client.connect();
        const dialogs = await client.getDialogs({ limit: 50 });
        let totalNewCount = 0;
        // Iterate over each configured group
        for (const tgGroup of telegramGroups) {
            const group = dialogs.find((d) => d.title === tgGroup.chatTitle || d.name === tgGroup.chatTitle);
            if (!group) {
                console.log(`Group '${tgGroup.chatTitle}' (${tgGroup.name}) not found in recent dialogs.`);
                continue;
            }
            const history = await client.getMessages(group.entity, { limit: 10 });
            let newCount = 0;
            for (const msg of history) {
                // Check if from PayWay (Sender)
                const senderObject = await msg.getSender();
                const senderAny = senderObject;
                const senderName = (senderAny === null || senderAny === void 0 ? void 0 : senderAny.firstName) || (senderAny === null || senderAny === void 0 ? void 0 : senderAny.title) || 'Unknown';
                // Check signature in message or sender name
                const isPayWay = PAYWAY_SENDER_NAMES.some(n => senderName.includes(n)) ||
                    (msg.message && msg.message.includes('PayWay'));
                if (isPayWay) {
                    // Idempotency Check
                    const msgId = msg.id.toString();
                    const groupIdStr = group.id ? group.id.toString() : 'unknown_chat';
                    const updateId = `${groupIdStr}_${msgId}`; // Composite ID
                    const exists = await db.collection('telegram_messages').doc(updateId).get();
                    if (exists.exists)
                        continue;
                    // Parse immediately and save
                    const parsed = paywayParser_service_1.PayWayParser.parse(msg.message || '');
                    await db.collection('telegram_messages').doc(updateId).set({
                        updateId: updateId,
                        messageId: msgId,
                        chatId: groupIdStr,
                        chatTitle: group.title,
                        configGroupId: tgGroup.id, // Reference to our config
                        configGroupName: tgGroup.name,
                        from: senderName,
                        text: msg.message,
                        date: new Date(msg.date * 1000),
                        processed: !!parsed,
                        transactionData: parsed || null,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        source: 'userbot_poll'
                    });
                    newCount++;
                }
            }
            if (newCount > 0) {
                console.log(`Synced ${newCount} new PayWay messages from '${tgGroup.name}'.`);
            }
            totalNewCount += newCount;
        }
        console.log(`Total synced: ${totalNewCount} new PayWay messages across all groups.`);
    }
    catch (e) {
        console.error("Userbot Error:", e);
    }
    finally {
        await client.disconnect();
    }
});
//# sourceMappingURL=checkPayWayUpdates.js.map