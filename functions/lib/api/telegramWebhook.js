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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
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
        // --- 1. HANDLE COMMANDS ---
        if (chatId && text.startsWith('/')) {
            const chatType = ((_c = message.chat) === null || _c === void 0 ? void 0 : _c.type) || 'private';
            const chatTitle = ((_d = message.chat) === null || _d === void 0 ? void 0 : _d.title) || null;
            const fromUser = ((_e = message.from) === null || _e === void 0 ? void 0 : _e.first_name) || 'User';
            const isGroup = chatType === 'group' || chatType === 'supergroup';
            // ============================================
            // COMMAND: /link <CODE_OR_ID>
            // ============================================
            if (text.startsWith('/link')) {
                const parts = text.split(/\s+/);
                if (parts.length < 2) {
                    await sendMessage(chatId, `📋 *How to Link Your Account*\n\n` +
                        `Please provide your customer code or ID:\n` +
                        `\`/link YOUR_CODE\`\n\n` +
                        `Example: \`/link CUST001\` or \`/link JK3erpQN...\``);
                }
                else {
                    const customerCode = parts[1].trim();
                    // Search by code first, then by document ID
                    let customersSnapshot = await db.collection('customers')
                        .where('code', '==', customerCode.toUpperCase())
                        .limit(1)
                        .get();
                    if (customersSnapshot.empty) {
                        // Try by document ID
                        const customerDoc = await db.collection('customers').doc(customerCode).get();
                        if (customerDoc.exists) {
                            customersSnapshot = { empty: false, docs: [customerDoc] };
                        }
                    }
                    if (customersSnapshot.empty) {
                        await sendMessage(chatId, `❌ *Customer not found*\n\nNo customer found with code/ID: \`${customerCode}\`\n\nPlease check and try again.`);
                    }
                    else {
                        const customerDoc = customersSnapshot.docs[0];
                        const customerData = customerDoc.data();
                        const updateData = {
                            telegramChatId: chatId,
                            telegramChatType: chatType,
                            telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                            telegramLinkedBy: fromUser
                        };
                        if (chatTitle)
                            updateData.telegramGroupName = chatTitle;
                        await customerDoc.ref.update(updateData);
                        const locationDesc = isGroup ? `group "${chatTitle}"` : 'your Telegram';
                        await sendMessage(chatId, `✅ *Successfully Linked!*\n\n` +
                            `Customer: *${customerData === null || customerData === void 0 ? void 0 : customerData.name}*\n` +
                            `Notifications will now be sent to ${locationDesc}.\n\n` +
                            `_To unlink, use /unlink_`);
                        console.log(`✅ Linked ${chatType} chat (${chatId}) to Customer ${customerDoc.id}`);
                    }
                }
            }
            // ============================================
            // COMMAND: /unlink
            // ============================================
            else if (text === '/unlink') {
                const customersSnapshot = await db.collection('customers')
                    .where('telegramChatId', '==', chatId)
                    .limit(1)
                    .get();
                if (customersSnapshot.empty) {
                    await sendMessage(chatId, `ℹ️ No customer account is linked to this chat.`);
                }
                else {
                    const customerDoc = customersSnapshot.docs[0];
                    const customerData = customerDoc.data();
                    await customerDoc.ref.update({
                        telegramChatId: admin.firestore.FieldValue.delete(),
                        telegramChatType: admin.firestore.FieldValue.delete(),
                        telegramGroupName: admin.firestore.FieldValue.delete(),
                        telegramLinkedAt: admin.firestore.FieldValue.delete(),
                        telegramLinkedBy: admin.firestore.FieldValue.delete()
                    });
                    await sendMessage(chatId, `✅ *Unlinked Successfully*\n\nCustomer *${customerData === null || customerData === void 0 ? void 0 : customerData.name}* unlinked.\n\n_To link again, use /link YOUR_CODE_`);
                    console.log(`✅ Unlinked chat (${chatId}) from Customer ${customerDoc.id}`);
                }
            }
            // ============================================
            // COMMAND: /status
            // ============================================
            else if (text === '/status') {
                const customersSnapshot = await db.collection('customers')
                    .where('telegramChatId', '==', chatId)
                    .limit(1)
                    .get();
                if (customersSnapshot.empty) {
                    await sendMessage(chatId, `ℹ️ *Not Linked*\n\nThis chat is not linked to any customer.\n\nUse \`/link YOUR_CODE\` to connect.`);
                }
                else {
                    const customerData = customersSnapshot.docs[0].data();
                    await sendMessage(chatId, `✅ *Linked*\n\nCustomer: *${customerData === null || customerData === void 0 ? void 0 : customerData.name}*\n\n_Notifications will be sent here._`);
                }
            }
            // ============================================
            // COMMAND: /start (with optional params)
            // ============================================
            else if (text.startsWith('/start')) {
                const parts = text.split(' ');
                if (parts.length >= 2) {
                    const param = parts[1].trim();
                    // Handle startgroup=link_CODE format
                    if (param.startsWith('link_')) {
                        const customerCode = param.replace('link_', '');
                        // Search by code first, then by document ID
                        let customersSnapshot = await db.collection('customers')
                            .where('code', '==', customerCode.toUpperCase())
                            .limit(1)
                            .get();
                        if (customersSnapshot.empty) {
                            const customerDoc = await db.collection('customers').doc(customerCode).get();
                            if (customerDoc.exists) {
                                customersSnapshot = { empty: false, docs: [customerDoc] };
                            }
                        }
                        if (!customersSnapshot.empty) {
                            const customerDoc = customersSnapshot.docs[0];
                            const customerData = customerDoc.data();
                            const updateData = {
                                telegramChatId: chatId,
                                telegramChatType: chatType,
                                telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                                telegramLinkedBy: fromUser
                            };
                            if (chatTitle)
                                updateData.telegramGroupName = chatTitle;
                            await customerDoc.ref.update(updateData);
                            const locationDesc = isGroup ? `group "${chatTitle}"` : 'your Telegram';
                            await sendMessage(chatId, `✅ *Successfully Linked!*\n\n` +
                                `Customer: *${customerData === null || customerData === void 0 ? void 0 : customerData.name}*\n` +
                                `Notifications will now be sent to ${locationDesc}.`);
                            console.log(`✅ Auto-linked ${chatType} chat (${chatId}) to Customer ${customerDoc.id} via startgroup`);
                        }
                        else {
                            await sendMessage(chatId, `❌ *Customer not found*\n\nUse \`/link YOUR_CODE\` with your correct code.`);
                        }
                    }
                    else {
                        // Old flow: /start UID - try to link via user account
                        const uid = param;
                        try {
                            const userDoc = await db.collection('users').doc(uid).get();
                            if (userDoc.exists) {
                                const userData = userDoc.data();
                                let customerId = userData === null || userData === void 0 ? void 0 : userData.linkedCustomerId;
                                // Fallback: find customer by linkedUserId
                                if (!customerId) {
                                    const custByUser = await db.collection('customers')
                                        .where('linkedUserId', '==', uid)
                                        .limit(1).get();
                                    if (!custByUser.empty)
                                        customerId = custByUser.docs[0].id;
                                }
                                if (customerId) {
                                    await db.collection('customers').doc(customerId).update({
                                        telegramChatId: chatId,
                                        telegramChatType: chatType,
                                        telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                                        telegramLinkedBy: fromUser
                                    });
                                    await sendMessage(chatId, `✅ *Account Linked Successfully!*\n\nHello ${(userData === null || userData === void 0 ? void 0 : userData.name) || 'Customer'},\nYou will now receive notifications here.`);
                                    console.log(`✅ Linked User ${uid} (Customer ${customerId}) to Chat ${chatId}`);
                                }
                                else {
                                    await sendMessage(chatId, `⚠️ *No customer profile linked.*\n\nTry using: \`/link YOUR_CUSTOMER_CODE\``);
                                }
                            }
                            else {
                                // User not found - suggest /link command
                                await sendMessage(chatId, `❌ *Could not find your account*\n\nPlease use: \`/link YOUR_CUSTOMER_CODE\`\n\n_Your code can be found in your profile._`);
                            }
                        }
                        catch (error) {
                            console.error('Link Error:', error);
                            await sendMessage(chatId, `❌ *Error Linking Account.*\nPlease try \`/link YOUR_CODE\` instead.`);
                        }
                    }
                }
                else {
                    // Plain /start - welcome message
                    await sendMessage(chatId, `👋 *Welcome!*\n\n` +
                        `I'm your notification bot. Here's how to get started:\n\n` +
                        `📌 *Link your account:*\n\`/link YOUR_CODE\`\n\n` +
                        `📌 *Check link status:*\n\`/status\`\n\n` +
                        `📌 *Unlink this chat:*\n\`/unlink\`\n\n` +
                        `_You can add me to a group too!_`);
                }
            }
            // ============================================
            // COMMAND: /help
            // ============================================
            else if (text === '/help') {
                await sendMessage(chatId, `📖 *Available Commands*\n\n` +
                    `\`/link CODE\` - Link customer account\n` +
                    `\`/unlink\` - Remove link\n` +
                    `\`/status\` - Check link status\n` +
                    `\`/help\` - Show this message`);
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
                chatId: ((_g = (_f = message.chat) === null || _f === void 0 ? void 0 : _f.id) === null || _g === void 0 ? void 0 : _g.toString()) || '',
                chatTitle: ((_h = message.chat) === null || _h === void 0 ? void 0 : _h.title) || 'Private',
                chatType: ((_j = message.chat) === null || _j === void 0 ? void 0 : _j.type) || 'unknown',
                from: ((_k = message.from) === null || _k === void 0 ? void 0 : _k.first_name) || ((_l = message.sender_chat) === null || _l === void 0 ? void 0 : _l.title) || 'Unknown',
                fromId: ((_p = (((_m = message.from) === null || _m === void 0 ? void 0 : _m.id) || ((_o = message.sender_chat) === null || _o === void 0 ? void 0 : _o.id))) === null || _p === void 0 ? void 0 : _p.toString()) || '',
                fromUsername: ((_q = message.from) === null || _q === void 0 ? void 0 : _q.username) || ((_r = message.sender_chat) === null || _r === void 0 ? void 0 : _r.username) || '',
                text: message.text || '',
                date: admin.firestore.Timestamp.fromDate(new Date(message.date * 1000)),
                processed: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            // Save to Firestore
            const docRef = await db.collection('telegram_messages').add(docData);
            console.log('✅ Message saved:', docRef.id, '| From:', docData.from, '| Text:', (_s = docData.text) === null || _s === void 0 ? void 0 : _s.substring(0, 50));
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