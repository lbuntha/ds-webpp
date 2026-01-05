
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from functions root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function getChatId() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN is missing in functions/.env');
        return;
    }

    console.log(`Checking updates for bot...`);

    try {
        const url = `https://api.telegram.org/bot${token}/getUpdates`;
        const response = await fetch(url);
        const data = await response.json();

        if (!data.ok) {
            console.error('❌ Telegram API Error:', data.description);
            return;
        }

        const updates = data.result;
        if (!updates || updates.length === 0) {
            console.log('⚠️ No messages found.');
            console.log('👉 Please open your bot in Telegram and send a message (e.g., "Hello").');
            console.log('   Then run this script again.');
            return;
        }

        // Get the last message
        const lastUpdate = updates[updates.length - 1];
        const message = lastUpdate.message || lastUpdate.edited_message || lastUpdate.channel_post;

        if (message && message.chat) {
            console.log('\n✅ FOUND CHAT ID:');
            console.log(`   ${message.chat.id}`);
            console.log(`   (From User: ${message.chat.first_name || ''} ${message.chat.last_name || ''})`);
        } else {
            console.log('⚠️ Found activity, but could not determine Chat ID. Please send a clear text message to the bot.');
            console.log('Debug:', JSON.stringify(lastUpdate, null, 2));
        }

    } catch (error) {
        console.error('❌ Failed to connect to Telegram API:', error);
    }
}

getChatId();
