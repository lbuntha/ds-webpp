
import * as dotenv from 'dotenv';
import { TelegramService } from './services/telegramService';
import * as path from 'path';

// Load .env from functions root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testTelegram() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN is missing in functions/.env');
        console.log('Please create functions/.env and add: TELEGRAM_BOT_TOKEN=your_token');
        return;
    }

    console.log(`✅ Found Token: ${token.slice(0, 5)}...`);

    // Ask for Chat ID via args or hardcode for test
    const chatId = process.argv[2];
    if (!chatId) {
        console.error('❌ Please provide a Chat ID as an argument.');
        console.log('Usage: npx ts-node src/test-telegram.ts <YOUR_CHAT_ID>');
        return;
    }

    const service = new TelegramService();
    console.log(`Sending test message to ${chatId}...`);

    const success = await service.sendMessage(chatId, '*Test Message form Local Environment* \nIntegration is working!');

    if (success) {
        console.log('✅ Message sent successfully!');
    } else {
        console.error('❌ Failed to send message.');
    }
}

testTelegram();
