
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
        const chatType = message.chat.type; // 'private', 'group', or 'supergroup'
        const chatTitle = message.chat.title || null; // Group name (null for private chats)
        const text = message.text?.trim();
        const fromUser = message.from?.first_name || 'User';

        console.log(`[Telegram Webhook] Received from ${chatType} chat (${chatId}): ${text}`);

        if (!text) {
            return res.status(200).send('OK');
        }

        // ============================================
        // COMMAND: /link <CUSTOMER_CODE>
        // Allows customers to link their individual or group chat
        // ============================================
        if (text.startsWith('/link')) {
            const parts = text.split(/\s+/);
            if (parts.length < 2) {
                const isGroup = chatType === 'group' || chatType === 'supergroup';
                await telegramService.sendMessage(
                    chatId.toString(),
                    `📋 *How to Link Your Account*\n\n` +
                    `Please provide your customer code:\n` +
                    `\`/link YOUR_CODE\`\n\n` +
                    `Example: \`/link CUST001\`\n\n` +
                    (isGroup ? `_This will link this group to receive notifications._` : `_This will link your Telegram to receive notifications._`)
                );
                return res.status(200).send('OK');
            }

            const customerCode = parts[1].trim();

            // Find customer by code first, then by document ID
            let customersSnapshot = await admin.firestore()
                .collection('customers')
                .where('code', '==', customerCode.toUpperCase())
                .limit(1)
                .get();

            // If not found by code, try by document ID
            if (customersSnapshot.empty) {
                const customerDoc = await admin.firestore()
                    .collection('customers')
                    .doc(customerCode)
                    .get();

                if (customerDoc.exists) {
                    // Create a fake QuerySnapshot-like structure
                    customersSnapshot = {
                        empty: false,
                        docs: [customerDoc]
                    } as any;
                }
            }

            if (customersSnapshot.empty) {
                await telegramService.sendMessage(
                    chatId.toString(),
                    `❌ *Customer not found*\n\nNo customer found with code/ID: \`${customerCode}\`\n\nPlease check your code and try again.`
                );
                return res.status(200).send('OK');
            }

            const customerDoc = customersSnapshot.docs[0];
            const customerData = customerDoc.data();

            // Update customer with chat ID and chat info
            const updateData: any = {
                telegramChatId: chatId.toString(),
                telegramChatType: chatType,
                telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                telegramLinkedBy: fromUser
            };

            // If it's a group, also store the group name
            if (chatTitle) {
                updateData.telegramGroupName = chatTitle;
            }

            await customerDoc.ref.update(updateData);

            const isGroup = chatType === 'group' || chatType === 'supergroup';
            const locationDesc = isGroup ? `group "${chatTitle}"` : 'your Telegram';

            await telegramService.sendMessage(
                chatId.toString(),
                `✅ *Successfully Linked!*\n\n` +
                `Customer: *${customerData.name}*\n` +
                `Code: \`${customerCode}\`\n\n` +
                `Notifications will now be sent to ${locationDesc}.\n\n` +
                `_To unlink, use /unlink_`
            );

            console.log(`[Telegram] Linked ${chatType} chat (${chatId}) to Customer ${customerDoc.id} (${customerData.name})`);
            return res.status(200).send('OK');
        }

        // ============================================
        // COMMAND: /unlink
        // Removes Telegram link from customer
        // ============================================
        if (text === '/unlink') {
            // Find customer linked to this chat
            const customersSnapshot = await admin.firestore()
                .collection('customers')
                .where('telegramChatId', '==', chatId.toString())
                .limit(1)
                .get();

            if (customersSnapshot.empty) {
                await telegramService.sendMessage(
                    chatId.toString(),
                    `ℹ️ No customer account is linked to this chat.`
                );
                return res.status(200).send('OK');
            }

            const customerDoc = customersSnapshot.docs[0];
            const customerData = customerDoc.data();

            await customerDoc.ref.update({
                telegramChatId: admin.firestore.FieldValue.delete(),
                telegramChatType: admin.firestore.FieldValue.delete(),
                telegramGroupName: admin.firestore.FieldValue.delete(),
                telegramLinkedAt: admin.firestore.FieldValue.delete(),
                telegramLinkedBy: admin.firestore.FieldValue.delete()
            });

            await telegramService.sendMessage(
                chatId.toString(),
                `✅ *Unlinked Successfully*\n\n` +
                `Customer *${customerData.name}* has been unlinked from this chat.\n\n` +
                `_To link again, use /link YOUR_CODE_`
            );

            console.log(`[Telegram] Unlinked chat (${chatId}) from Customer ${customerDoc.id}`);
            return res.status(200).send('OK');
        }

        // ============================================
        // COMMAND: /status
        // Check if this chat is linked
        // ============================================
        if (text === '/status') {
            const customersSnapshot = await admin.firestore()
                .collection('customers')
                .where('telegramChatId', '==', chatId.toString())
                .limit(1)
                .get();

            if (customersSnapshot.empty) {
                await telegramService.sendMessage(
                    chatId.toString(),
                    `ℹ️ *Not Linked*\n\nThis chat is not linked to any customer account.\n\nUse \`/link YOUR_CODE\` to connect.`
                );
            } else {
                const customerData = customersSnapshot.docs[0].data();
                await telegramService.sendMessage(
                    chatId.toString(),
                    `✅ *Linked*\n\n` +
                    `Customer: *${customerData.name}*\n` +
                    `Code: \`${customerData.code || 'N/A'}\`\n\n` +
                    `_Notifications will be sent here._`
                );
            }
            return res.status(200).send('OK');
        }

        // ============================================
        // COMMAND: /start (with optional parameters)
        // Handles: /start (welcome), /start UID (app link), /start link_CODE (group link)
        // ============================================
        if (text.startsWith('/start')) {
            const parts = text.split(' ');
            const isGroup = chatType === 'group' || chatType === 'supergroup';

            // If /start has a parameter
            if (parts.length >= 2) {
                const param = parts[1].trim();

                // ============================================
                // CASE 1: /start link_CODE (Auto-link group by customer code)
                // This is triggered when user clicks "Add Bot to Group" button
                // ============================================
                if (param.startsWith('link_')) {
                    const customerCode = param.replace('link_', '');

                    if (!customerCode) {
                        await telegramService.sendMessage(
                            chatId.toString(),
                            `📋 *Link Your Account*\n\n` +
                            `Please use: \`/link YOUR_CODE\`\n\n` +
                            `Example: \`/link CUST001\``
                        );
                        return res.status(200).send('OK');
                    }

                    // Find customer by code first, then by document ID
                    let customersSnapshot = await admin.firestore()
                        .collection('customers')
                        .where('code', '==', customerCode.toUpperCase())
                        .limit(1)
                        .get();

                    // If not found by code, try by document ID
                    if (customersSnapshot.empty) {
                        const customerDoc = await admin.firestore()
                            .collection('customers')
                            .doc(customerCode)
                            .get();

                        if (customerDoc.exists) {
                            customersSnapshot = {
                                empty: false,
                                docs: [customerDoc]
                            } as any;
                        }
                    }

                    if (customersSnapshot.empty) {
                        await telegramService.sendMessage(
                            chatId.toString(),
                            `❌ *Customer not found*\n\n` +
                            `No customer found with code/ID: \`${customerCode}\`\n\n` +
                            `Please use: \`/link YOUR_CODE\` with your correct code.`
                        );
                        return res.status(200).send('OK');
                    }

                    const customerDoc = customersSnapshot.docs[0];
                    const customerData = customerDoc.data();

                    // Update customer with chat ID and chat info
                    const updateData: any = {
                        telegramChatId: chatId.toString(),
                        telegramChatType: chatType,
                        telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                        telegramLinkedBy: fromUser
                    };

                    if (chatTitle) {
                        updateData.telegramGroupName = chatTitle;
                    }

                    await customerDoc.ref.update(updateData);

                    const locationDesc = isGroup ? `group "${chatTitle || 'this group'}"` : 'your Telegram';

                    await telegramService.sendMessage(
                        chatId.toString(),
                        `✅ *Successfully Linked!*\n\n` +
                        `Customer: *${customerData.name}*\n` +
                        `Code: \`${customerCode}\`\n\n` +
                        `Notifications will now be sent to ${locationDesc}.\n\n` +
                        `_To unlink, use /unlink_`
                    );

                    console.log(`[Telegram] Auto-linked ${chatType} chat (${chatId}) to Customer ${customerDoc.id} via startgroup`);
                    return res.status(200).send('OK');
                }

                // ============================================
                // CASE 2: /start UID (App-based linking via user ID)
                // ============================================
                const uid = param;

                // First, try to find User by UID
                const userDoc = await admin.firestore().collection('users').doc(uid).get();

                let customerId: string | undefined;
                let customerName: string = 'your account';

                if (userDoc.exists) {
                    const userData = userDoc.data();
                    customerId = userData?.linkedCustomerId;
                    customerName = userData?.name || 'your account';

                    // If user has no linkedCustomerId, try to find customer by linkedUserId
                    if (!customerId) {
                        const customerByUserIdSnapshot = await admin.firestore()
                            .collection('customers')
                            .where('linkedUserId', '==', uid)
                            .limit(1)
                            .get();

                        if (!customerByUserIdSnapshot.empty) {
                            const customerDoc = customerByUserIdSnapshot.docs[0];
                            customerId = customerDoc.id;
                            customerName = customerDoc.data().name || customerName;
                        }
                    }
                } else {
                    // User doesn't exist in 'users' collection, check if UID is a customer ID directly
                    const customerDoc = await admin.firestore().collection('customers').doc(uid).get();
                    if (customerDoc.exists) {
                        customerId = uid;
                        customerName = customerDoc.data()?.name || 'your account';
                    } else {
                        // Also try finding customer by linkedUserId
                        const customerByUserIdSnapshot = await admin.firestore()
                            .collection('customers')
                            .where('linkedUserId', '==', uid)
                            .limit(1)
                            .get();

                        if (!customerByUserIdSnapshot.empty) {
                            const cDoc = customerByUserIdSnapshot.docs[0];
                            customerId = cDoc.id;
                            customerName = cDoc.data().name || customerName;
                        }
                    }
                }

                if (!customerId) {
                    await telegramService.sendMessage(
                        chatId.toString(),
                        `❌ *Could not find your account*\n\n` +
                        `Try using the /link command instead:\n` +
                        `\`/link YOUR_CUSTOMER_CODE\`\n\n` +
                        `_Your customer code can be found in your profile._`
                    );
                    return res.status(200).send('OK');
                }

                // Update Customer with Chat ID
                const updateData: any = {
                    telegramChatId: chatId.toString(),
                    telegramChatType: chatType,
                    telegramLinkedAt: admin.firestore.FieldValue.serverTimestamp(),
                    telegramLinkedBy: fromUser
                };

                if (chatTitle) {
                    updateData.telegramGroupName = chatTitle;
                }

                await admin.firestore().collection('customers').doc(customerId).update(updateData);

                await telegramService.sendMessage(
                    chatId.toString(),
                    `✅ *Success!* Your Telegram has been linked to *${customerName}*.\n\nYou will now receive settlement reports and notifications here.`
                );

                console.log(`[Telegram Webhook] Linked Chat ID ${chatId} to Customer ${customerId} via app`);
            } else {
                // Plain /start - show welcome message
                await telegramService.sendMessage(
                    chatId.toString(),
                    `👋 *Welcome!*\n\n` +
                    `I'm your notification bot. Here's how to get started:\n\n` +
                    `📌 *Link your account:*\n` +
                    `\`/link YOUR_CUSTOMER_CODE\`\n\n` +
                    `📌 *Check link status:*\n` +
                    `\`/status\`\n\n` +
                    `📌 *Unlink this chat:*\n` +
                    `\`/unlink\`\n\n` +
                    `_You can add me to a group and link there too!_`
                );
            }
            return res.status(200).send('OK');
        }

        // ============================================
        // COMMAND: /help
        // ============================================
        if (text === '/help') {
            await telegramService.sendMessage(
                chatId.toString(),
                `📖 *Available Commands*\n\n` +
                `\`/link CODE\` - Link customer account\n` +
                `\`/unlink\` - Remove link\n` +
                `\`/status\` - Check link status\n` +
                `\`/help\` - Show this message\n\n` +
                `_You can use me in private chat or add me to a group!_`
            );
            return res.status(200).send('OK');
        }

        // Ignore other messages (don't spam groups)
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

