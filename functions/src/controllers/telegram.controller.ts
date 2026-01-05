
import { Request, Response } from 'express';
import * as admin from 'firebase-admin';
import { TelegramService } from '../services/telegramService';

const telegramService = new TelegramService();

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
