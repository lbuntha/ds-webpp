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

    if (message) {
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
