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
// PayWay sender names to match
const PAYWAY_SENDER_NAMES = ['PayWay', 'PayWay by ABA'];

// Interface for Telegram Group config
interface TelegramGroupConfig {
    id: string;
    name: string;
    chatTitle: string;
    isActive: boolean;
    monitorPayWay: boolean;
}

export const checkPayWayUpdates = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
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

    const telegramGroups = groupsSnapshot.docs.map(doc => doc.data() as TelegramGroupConfig);
    console.log(`Found ${telegramGroups.length} active telegram groups to monitor.`);

    const client = new TelegramClient(new StringSession(SESSION_STRING), API_ID, API_HASH, {
        connectionRetries: 1,
    });

    try {
        console.log("Connecting to Telegram Client...");
        await client.connect();

        const dialogs = await client.getDialogs({ limit: 50 });

        let totalNewCount = 0;

        // Iterate over each configured group
        for (const tgGroup of telegramGroups) {
            const group = dialogs.find((d: any) => d.title === tgGroup.chatTitle || d.name === tgGroup.chatTitle);

            if (!group) {
                console.log(`Group '${tgGroup.chatTitle}' (${tgGroup.name}) not found in recent dialogs.`);
                continue;
            }

            const history = await client.getMessages(group.entity, { limit: 10 });

            let newCount = 0;

            for (const msg of history) {
                // Check if from PayWay (Sender)
                const senderObject = await msg.getSender();
                const senderAny = senderObject as any;
                const senderName = senderAny?.firstName || senderAny?.title || 'Unknown';

                // Check signature in message or sender name
                const isPayWay = PAYWAY_SENDER_NAMES.some(n => senderName.includes(n)) ||
                    (msg.message && msg.message.includes('PayWay'));

                if (isPayWay) {
                    // Idempotency Check
                    const msgId = msg.id.toString();
                    const groupIdStr = group.id ? group.id.toString() : 'unknown_chat';
                    const updateId = `${groupIdStr}_${msgId}`; // Composite ID

                    const exists = await db.collection('telegram_messages').doc(updateId).get();
                    if (exists.exists) continue;

                    // Parse immediately and save
                    const parsed = PayWayParser.parse(msg.message || '');

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

    } catch (e) {
        console.error("Userbot Error:", e);
    } finally {
        await client.disconnect();
    }
});

