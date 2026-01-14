import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import fetch from 'node-fetch';

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
const verifyTelegramRequest = (req: functions.https.Request): boolean => {
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
const sendMessage = async (chatId: string, text: string) => {
    if (!TELEGRAM_BOT_TOKEN) return;
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
        });
    } catch (err) {
        console.error('Failed to send reply:', err);
    }
};

export const telegramWebhook = functions.https.onRequest(async (req, res) => {
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
        const chatId = message.chat?.id?.toString();
        const text = message.text || '';

        // --- 1. HANDLE COMMANDS ---
        if (chatId && text.startsWith('/')) {
            const chatType = message.chat?.type || 'private';
            const chatTitle = message.chat?.title || null;
            const fromUser = message.from?.first_name || 'User';
            const isGroup = chatType === 'group' || chatType === 'supergroup';

            // ============================================
            // COMMAND: /link <CODE_OR_ID>
            // ============================================
            if (text.startsWith('/link')) {
                const parts = text.split(/\s+/);
                if (parts.length < 2) {
                    await sendMessage(chatId,
                        `📋 *How to Link Your Account*\n\n` +
                        `Please provide your customer code or ID:\n` +
                        `\`/link YOUR_CODE\`\n\n` +
                        `Example: \`/link CUST001\` or \`/link JK3erpQN...\``
                    );
                } else {
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
                            customersSnapshot = { empty: false, docs: [customerDoc] } as any;
                        }
                    }

                    if (customersSnapshot.empty) {
                        await sendMessage(chatId, `❌ *Customer not found*\n\nNo customer found with code/ID: \`${customerCode}\`\n\nPlease check and try again.`);
                    } else {
                        const customerDoc = customersSnapshot.docs[0];
                        const customerData = customerDoc.data();

                        const updateData: any = {
                            telegramChatId: chatId,
                            telegramChatType: chatType,
                            telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                            telegramLinkedBy: fromUser
                        };
                        if (chatTitle) updateData.telegramGroupName = chatTitle;

                        await customerDoc.ref.update(updateData);

                        const locationDesc = isGroup ? `group "${chatTitle}"` : 'your Telegram';
                        await sendMessage(chatId,
                            `✅ *Successfully Linked!*\n\n` +
                            `Customer: *${customerData?.name}*\n` +
                            `Notifications will now be sent to ${locationDesc}.\n\n` +
                            `_To unlink, use /unlink_`
                        );
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
                } else {
                    const customerDoc = customersSnapshot.docs[0];
                    const customerData = customerDoc.data();
                    await customerDoc.ref.update({
                        telegramChatId: admin.firestore.FieldValue.delete(),
                        telegramChatType: admin.firestore.FieldValue.delete(),
                        telegramGroupName: admin.firestore.FieldValue.delete(),
                        telegramLinkedAt: admin.firestore.FieldValue.delete(),
                        telegramLinkedBy: admin.firestore.FieldValue.delete()
                    });
                    await sendMessage(chatId, `✅ *Unlinked Successfully*\n\nCustomer *${customerData?.name}* unlinked.\n\n_To link again, use /link YOUR_CODE_`);
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
                } else {
                    const customerData = customersSnapshot.docs[0].data();
                    await sendMessage(chatId, `✅ *Linked*\n\nCustomer: *${customerData?.name}*\n\n_Notifications will be sent here._`);
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
                                customersSnapshot = { empty: false, docs: [customerDoc] } as any;
                            }
                        }

                        if (!customersSnapshot.empty) {
                            const customerDoc = customersSnapshot.docs[0];
                            const customerData = customerDoc.data();
                            const updateData: any = {
                                telegramChatId: chatId,
                                telegramChatType: chatType,
                                telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                                telegramLinkedBy: fromUser
                            };
                            if (chatTitle) updateData.telegramGroupName = chatTitle;
                            await customerDoc.ref.update(updateData);

                            const locationDesc = isGroup ? `group "${chatTitle}"` : 'your Telegram';
                            await sendMessage(chatId,
                                `✅ *Successfully Linked!*\n\n` +
                                `Customer: *${customerData?.name}*\n` +
                                `Notifications will now be sent to ${locationDesc}.`
                            );
                            console.log(`✅ Auto-linked ${chatType} chat (${chatId}) to Customer ${customerDoc.id} via startgroup`);
                        } else {
                            await sendMessage(chatId, `❌ *Customer not found*\n\nUse \`/link YOUR_CODE\` with your correct code.`);
                        }
                    } else {
                        // Old flow: /start UID - try to link via user account
                        const uid = param;
                        try {
                            const userDoc = await db.collection('users').doc(uid).get();
                            if (userDoc.exists) {
                                const userData = userDoc.data();
                                let customerId = userData?.linkedCustomerId;

                                // Fallback: find customer by linkedUserId
                                if (!customerId) {
                                    const custByUser = await db.collection('customers')
                                        .where('linkedUserId', '==', uid)
                                        .limit(1).get();
                                    if (!custByUser.empty) customerId = custByUser.docs[0].id;
                                }

                                if (customerId) {
                                    await db.collection('customers').doc(customerId).update({
                                        telegramChatId: chatId,
                                        telegramChatType: chatType,
                                        telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                                        telegramLinkedBy: fromUser
                                    });
                                    await sendMessage(chatId, `✅ *Account Linked Successfully!*\n\nHello ${userData?.name || 'Customer'},\nYou will now receive notifications here.`);
                                    console.log(`✅ Linked User ${uid} (Customer ${customerId}) to Chat ${chatId}`);
                                } else {
                                    await sendMessage(chatId, `⚠️ *No customer profile linked.*\n\nTry using: \`/link YOUR_CUSTOMER_CODE\``);
                                }
                            } else {
                                // User not found - suggest /link command
                                await sendMessage(chatId, `❌ *Could not find your account*\n\nPlease use: \`/link YOUR_CUSTOMER_CODE\`\n\n_Your code can be found in your profile._`);
                            }
                        } catch (error) {
                            console.error('Link Error:', error);
                            await sendMessage(chatId, `❌ *Error Linking Account.*\nPlease try \`/link YOUR_CODE\` instead.`);
                        }
                    }
                } else {
                    // Plain /start - welcome message
                    await sendMessage(chatId,
                        `👋 *Welcome!*\n\n` +
                        `I'm your notification bot. Here's how to get started:\n\n` +
                        `📌 *Link your account:*\n\`/link YOUR_CODE\`\n\n` +
                        `📌 *Check link status:*\n\`/status\`\n\n` +
                        `📌 *Unlink this chat:*\n\`/unlink\`\n\n` +
                        `_You can add me to a group too!_`
                    );
                }
            }
            // ============================================
            // COMMAND: /help
            // ============================================
            else if (text === '/help') {
                await sendMessage(chatId,
                    `📖 *Available Commands*\n\n` +
                    `\`/link CODE\` - Link customer account\n` +
                    `\`/unlink\` - Remove link\n` +
                    `\`/status\` - Check link status\n` +
                    `\`/help\` - Show this message`
                );
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
                chatId: message.chat?.id?.toString() || '',
                chatTitle: message.chat?.title || 'Private',
                chatType: message.chat?.type || 'unknown',
                from: message.from?.first_name || message.sender_chat?.title || 'Unknown',
                fromId: (message.from?.id || message.sender_chat?.id)?.toString() || '',
                fromUsername: message.from?.username || message.sender_chat?.username || '',
                text: message.text || '',
                date: admin.firestore.Timestamp.fromDate(new Date(message.date * 1000)),
                processed: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            // Save to Firestore
            const docRef = await db.collection('telegram_messages').add(docData);
            console.log('✅ Message saved:', docRef.id, '| From:', docData.from, '| Text:', docData.text?.substring(0, 50));

        } catch (error: any) {
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
export const testTelegramMessages = functions.https.onRequest(async (req, res) => {
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
        const response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates?limit=10`
        );

        const data = await response.json() as any;

        if (!data.ok) {
            res.status(500).json({ error: 'Telegram API error', details: data });
            return;
        }

        const messages = (data.result || []).map((update: any) => {
            const msg = update.message || update.channel_post;
            if (!msg) return null;

            return {
                update_id: update.update_id,
                chat_id: msg.chat?.id,
                chat_title: msg.chat?.title || 'Private',
                from: msg.from?.first_name || msg.sender_chat?.title || 'Unknown',
                text: msg.text || '[No text]',
                date: new Date(msg.date * 1000).toISOString()
            };
        }).filter(Boolean);

        res.status(200).json({
            success: true,
            message_count: messages.length,
            messages
        });

    } catch (error: any) {
        console.error('Error fetching Telegram updates:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Utility: Set up webhook with Telegram (call this once)
 * Usage: curl YOUR_FUNCTION_URL/setupTelegramWebhook?key=YOUR_KEY
 */
export const setupTelegramWebhook = functions.https.onRequest(async (req, res) => {
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

        const response = await fetch(url);
        const data = await response.json();

        res.status(200).json({
            success: true,
            webhookUrl,
            telegramResponse: data
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
