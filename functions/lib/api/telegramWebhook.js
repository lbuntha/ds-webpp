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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupTelegramWebhook = exports.testTelegramMessages = exports.telegramWebhook = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const node_fetch_1 = __importDefault(require("node-fetch"));
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
// Generate a secret token for webhook verification (optional but recommended)
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
/**
 * Verify the request is coming from Telegram
 * Telegram sends a secret token in the header if configured
 */
const verifyTelegramRequest = (req) => {
    // If no secret is configured, skip verification (not recommended for production)
    if (!WEBHOOK_SECRET) {
        console.warn('⚠️ TELEGRAM_WEBHOOK_SECRET not configured. Skipping request verification.');
        return true;
    }
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
    return secretHeader === WEBHOOK_SECRET;
};
/**
 * Webhook handler for real-time Telegram updates
 * Saves all messages to Firestore for later processing
 *
 * Security features:
 * - Only accepts POST requests
 * - Validates secret token (if configured)
 * - Deduplicates messages by update_id
 */
/**
 * Helper to send a text message using raw fetch
 */
const sendMessage = async (chatId, text) => {
    if (!TELEGRAM_BOT_TOKEN)
        return;
    try {
        await (0, node_fetch_1.default)(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
        });
    }
    catch (err) {
        console.error('Failed to send reply:', err);
    }
};
exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    // Only allow POST requests
    if (req.method !== 'POST') {
        res.status(405).send('Method not allowed');
        return;
    }
    // Verify the request is from Telegram
    if (!verifyTelegramRequest(req)) {
        console.error('❌ Unauthorized webhook request rejected');
        res.status(401).send('Unauthorized');
        return;
    }
    const update = req.body;
    // Validate update has required fields
    if (!update || !update.update_id) {
        res.status(400).send('Invalid request body');
        return;
    }
    const message = update.message || update.channel_post;
    // Process Message
    if (message) {
        const chatId = (_b = (_a = message.chat) === null || _a === void 0 ? void 0 : _a.id) === null || _b === void 0 ? void 0 : _b.toString();
        const text = message.text || '';
        // --- 1. HANDLE COMMANDS (e.g. /start <UID>) ---
        if (chatId && text.startsWith('/start')) {
            const parts = text.split(' ');
            if (parts.length === 2) {
                const uid = parts[1].trim();
                console.log(`🔗 Linking Request: UID=${uid}, ChatID=${chatId}`);
                try {
                    // Find User
                    const userDoc = await db.collection('users').doc(uid).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        const customerId = userData === null || userData === void 0 ? void 0 : userData.linkedCustomerId;
                        if (customerId) {
                            // Update Customer with Telegram Chat ID
                            await db.collection('customers').doc(customerId).update({
                                telegramChatId: chatId,
                                telegramUsername: ((_c = message.from) === null || _c === void 0 ? void 0 : _c.username) || '',
                                telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            await sendMessage(chatId, `✅ *Account Linked Successfully!*\n\nHello ${(userData === null || userData === void 0 ? void 0 : userData.name) || 'Customer'},\nYou will now receive settlement reports in this chat.`);
                            console.log(`✅ Linked User ${uid} (Customer ${customerId}) to Chat ${chatId}`);
                        }
                        else {
                            await sendMessage(chatId, `⚠️ *Account Found, but not linked to a Customer Profile.*\nPlease contact support.`);
                        }
                    }
                    else {
                        await sendMessage(chatId, `❌ *User Not Found.*\nPlease try clicking the "Connect Telegram" button in your app again.`);
                    }
                }
                catch (error) {
                    console.error('Link Error:', error);
                    await sendMessage(chatId, `❌ *Error Linking Account.*\nPlease try again later.`);
                }
            }
            else {
                // Just /start without param
                await sendMessage(chatId, `👋 *Welcome to DoorStep delivery bot!*\n\nTo link your account, please use the "Connect Telegram" button in your DoorStep web app.`);
            }
        }
        // --- 2. LOG MESSAGE TO FIRESTORE ---
        try {
            // Check for duplicate (idempotency)
            const existingDoc = await db.collection('telegram_messages')
                .where('updateId', '==', update.update_id)
                .limit(1)
                .get();
            if (!existingDoc.empty) {
                console.log('⏭️ Duplicate message ignored:', update.update_id);
                res.status(200).send('OK');
                return;
            }
            // Prepare document data
            const docData = {
                updateId: update.update_id,
                messageId: message.message_id,
                chatId: ((_e = (_d = message.chat) === null || _d === void 0 ? void 0 : _d.id) === null || _e === void 0 ? void 0 : _e.toString()) || '',
                chatTitle: ((_f = message.chat) === null || _f === void 0 ? void 0 : _f.title) || 'Private',
                chatType: ((_g = message.chat) === null || _g === void 0 ? void 0 : _g.type) || 'unknown',
                from: ((_h = message.from) === null || _h === void 0 ? void 0 : _h.first_name) || ((_j = message.sender_chat) === null || _j === void 0 ? void 0 : _j.title) || 'Unknown',
                fromId: ((_m = (((_k = message.from) === null || _k === void 0 ? void 0 : _k.id) || ((_l = message.sender_chat) === null || _l === void 0 ? void 0 : _l.id))) === null || _m === void 0 ? void 0 : _m.toString()) || '',
                fromUsername: ((_o = message.from) === null || _o === void 0 ? void 0 : _o.username) || ((_p = message.sender_chat) === null || _p === void 0 ? void 0 : _p.username) || '',
                text: message.text || '',
                date: admin.firestore.Timestamp.fromDate(new Date(message.date * 1000)),
                processed: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            // Save to Firestore
            const docRef = await db.collection('telegram_messages').add(docData);
            console.log('✅ Message saved:', docRef.id, '| From:', docData.from, '| Text:', (_q = docData.text) === null || _q === void 0 ? void 0 : _q.substring(0, 50));
        }
        catch (error) {
            console.error('❌ Error processing message:', error.message);
            // Still return 200 to prevent Telegram from retrying
        }
    }
    res.status(200).send('OK');
});
/**
 * Test endpoint to fetch recent messages (for debugging only)
 * Consider removing or protecting this in production
 */
exports.testTelegramMessages = functions.https.onRequest(async (req, res) => {
    // Simple API key check for test endpoint
    const apiKey = req.query.key || req.headers['x-api-key'];
    const expectedKey = process.env.TEST_API_KEY || 'doorstep-test-key';
    if (apiKey !== expectedKey) {
        res.status(401).json({ error: 'Unauthorized. Provide ?key=YOUR_KEY or x-api-key header.' });
        return;
    }
    if (!TELEGRAM_BOT_TOKEN) {
        res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
        return;
    }
    try {
        const response = await (0, node_fetch_1.default)(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=10`);
        const data = await response.json();
        if (!data.ok) {
            res.status(500).json({ error: 'Telegram API error', details: data });
            return;
        }
        const messages = (data.result || []).map((update) => {
            var _a, _b, _c, _d;
            const msg = update.message || update.channel_post;
            if (!msg)
                return null;
            return {
                update_id: update.update_id,
                chat_id: (_a = msg.chat) === null || _a === void 0 ? void 0 : _a.id,
                chat_title: ((_b = msg.chat) === null || _b === void 0 ? void 0 : _b.title) || 'Private',
                from: ((_c = msg.from) === null || _c === void 0 ? void 0 : _c.first_name) || ((_d = msg.sender_chat) === null || _d === void 0 ? void 0 : _d.title) || 'Unknown',
                text: msg.text || '[No text]',
                date: new Date(msg.date * 1000).toISOString()
            };
        }).filter(Boolean);
        res.status(200).json({
            success: true,
            message_count: messages.length,
            messages
        });
    }
    catch (error) {
        console.error('Error fetching Telegram updates:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * Utility: Set up webhook with Telegram (call this once)
 * Usage: curl YOUR_FUNCTION_URL/setupTelegramWebhook?key=YOUR_KEY
 */
exports.setupTelegramWebhook = functions.https.onRequest(async (req, res) => {
    const apiKey = req.query.key || req.headers['x-api-key'];
    const expectedKey = process.env.TEST_API_KEY || 'doorstep-test-key';
    if (apiKey !== expectedKey) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    if (!TELEGRAM_BOT_TOKEN) {
        res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not configured' });
        return;
    }
    const webhookUrl = `https://us-central1-doorstep-c75e3.cloudfunctions.net/telegramWebhook`;
    try {
        let url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
        // Add secret token if configured
        if (WEBHOOK_SECRET) {
            url += `&secret_token=${encodeURIComponent(WEBHOOK_SECRET)}`;
        }
        const response = await (0, node_fetch_1.default)(url);
        const data = await response.json();
        res.status(200).json({
            success: true,
            webhookUrl,
            telegramResponse: data
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
//# sourceMappingURL=telegramWebhook.js.map