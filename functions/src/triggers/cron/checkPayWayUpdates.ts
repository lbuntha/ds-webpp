import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { PayWayParser } from '../../services/paywayParser.service';

const db = admin.firestore();

// Configuration
const API_ID = Number(process.env.TELEGRAM_API_ID);
const API_HASH = process.env.TELEGRAM_API_HASH;
const SESSION_STRING = process.env.TELEGRAM_APP_SESSION;
// You can set the target group ID here or in .env
// If strictly PayWay bot, we can filter by sender 'PayWay' or specific ID
const PAYWAY_SENDER_NAMES = ['PayWay', 'PayWay by ABA'];

export const checkPayWayUpdates = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
    if (!API_ID || !API_HASH || !SESSION_STRING) {
        console.error("Missing Telegram Client credentials.");
        return;
    }

    const client = new TelegramClient(new StringSession(SESSION_STRING), API_ID, API_HASH, {
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
        const TARGET_GROUP_TITLE = 'DS004 - Sing Tola'; // Updated from screenshot

        const dialogs = await client.getDialogs({ limit: 20 });
        const group = dialogs.find((d: any) => d.title === TARGET_GROUP_TITLE || d.name === TARGET_GROUP_TITLE);

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
            const senderAny = senderObject as any;
            const senderName = senderAny?.firstName || senderAny?.title || 'Unknown';

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
                if (exists.exists) continue;

                // Parse immediately or just save raw?
                // Plan said: Save to Firestore -> telegram_messages.
                // Let's parse immediately to save fields, but keep raw too.
                const parsed = PayWayParser.parse(msg.message || '');

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

    } catch (e) {
        console.error("Userbot Error:", e);
    } finally {
        await client.disconnect();
    }
});
