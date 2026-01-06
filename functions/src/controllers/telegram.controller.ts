
import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { TelegramService } from '../services/telegramService';

const telegramService = new TelegramService();

// Helper: delay function for rate limiting
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const handleWebhook = async (req: Request, res: Response) => {
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
            const customerId = userData?.linkedCustomerId;

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
            await telegramService.sendMessage(
                chatId.toString(),
                `✅ *Success!* Your Telegram account has been linked to *${userData?.name}*.\n\nYou will now receive settlement reports and notifications here.`
            );

            console.log(`[Telegram Webhook] Linked Chat ID ${chatId} to Customer ${customerId}`);
        } else {
            // Handle other commands or default
            // Maybe just ignore or say hello
            // await telegramService.sendMessage(chatId.toString(), "I am a notification bot. Please use the App to manage your account.");
        }

        return res.status(200).send('OK');

    } catch (error) {
        console.error('Telegram Webhook Error:', error);
        // Always return 200 to Telegram to prevent retry loops
        return res.status(200).send('Error');
    }
};

interface BroadcastRecipient {
    customerId: string;
    chatId: string;
    name: string;
}


/**
 * Handle broadcast messages to multiple Telegram users
 * POST /telegram/broadcast
 * Body: { message: string, recipients: BroadcastRecipient[], image?: string, filename?: string }
 */
export const handleBroadcast = async (req: Request, res: Response) => {
    try {
        const { message, recipients, image, filename } = req.body as {
            message: string;
            recipients: BroadcastRecipient[];
            image?: string; // Base64 string
            filename?: string;
        };

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        if (!recipients || recipients.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one recipient is required' });
        }

        const batchSize = 25; // Telegram rate limit ~30/sec, use 25 to be safe
        const delayBetweenBatches = 1000; // 1 second

        let sent = 0;
        let failed = 0;
        let photoFileId: string | null = null;
        let photoBuffer: Buffer | null = null;

        // Process image if provided
        if (image) {
            try {
                // Remove data:image/jpeg;base64, prefix if present
                const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
                photoBuffer = Buffer.from(base64Data, 'base64');
            } catch (e) {
                console.error('[Broadcast] Invalid image data:', e);
                return res.status(400).json({ success: false, error: 'Invalid image data' });
            }
        }

        console.log(`[Broadcast] Starting broadcast to ${recipients.length} recipients. Has image: ${!!photoBuffer}`);

        // Process in batches
        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);

            // Process batch concurrently
            const results = await Promise.allSettled(
                batch.map(async (recipient) => {
                    try {
                        let success: any;

                        // Scenario 1: Sending Photo
                        if (photoBuffer) {
                            // First successful send gets the file_id to reuse
                            if (photoFileId) {
                                // Reuse file_id (FAST)
                                success = await telegramService.sendPhoto(recipient.chatId, photoFileId, filename, message);
                            } else {
                                // Send actual buffer (SLOW - only once)
                                const result = await telegramService.sendPhoto(recipient.chatId, photoBuffer!, filename, message);
                                if (result && result.ok) {
                                    success = result;
                                    // Capture file_id for next sends
                                    const photos = result.result?.photo;
                                    if (photos && photos.length > 0) {
                                        // Get distinct file_id from the largest photo
                                        photoFileId = photos[photos.length - 1].file_id;
                                        console.log(`[Broadcast] Captured file_id for reuse: ${photoFileId}`);
                                    }
                                }
                            }
                        }
                        // Scenario 2: Text Only
                        else {
                            success = await telegramService.sendMessage(recipient.chatId, message);
                        }

                        return { success: !!success, recipient };
                    } catch (e) {
                        console.error(`[Broadcast] Error sending to ${recipient.chatId}:`, e);
                        return { success: false, recipient };
                    }
                })
            );

            // Count results
            for (const result of results) {
                if (result.status === 'fulfilled' && result.value.success) {
                    sent++;
                } else {
                    failed++;
                }
            }

            // Rate limit delay between batches
            if (i + batchSize < recipients.length) {
                await delay(delayBetweenBatches);
            }
        }

        console.log(`[Broadcast] Complete: ${sent} sent, ${failed} failed`);

        return res.status(200).json({
            success: true,
            sent,
            failed,
            total: recipients.length
        });

    } catch (error) {
        console.error('Broadcast Error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error' });
    }
};

