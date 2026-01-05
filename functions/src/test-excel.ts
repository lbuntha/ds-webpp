
import * as dotenv from 'dotenv';
import * as path from 'path';
import { TelegramService } from './services/telegramService';
import * as ExcelJS from 'exceljs';

// Load .env from functions root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testExcel() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
        console.error('❌ TELEGRAM_BOT_TOKEN is missing');
        return;
    }

    // Get Chat ID from args or hardcode if needed (but args is better)
    const chatId = process.argv[2];
    if (!chatId) {
        console.error('❌ Please provide a Chat ID as an argument.');
        console.log('Usage: npx ts-node src/test-excel.ts <YOUR_CHAT_ID>');
        return;
    }

    console.log(`Testing Excel send to ${chatId}...`);

    // 1. Generate Dummy Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Test Sheet');
    worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Name', key: 'name', width: 32 },
        { header: 'Date', key: 'date', width: 15 }
    ];
    worksheet.addRow({ id: 1, name: 'John Doe', date: new Date() });
    worksheet.addRow({ id: 2, name: 'Test Parcel', date: new Date() });

    const buffer = await workbook.xlsx.writeBuffer() as any as Buffer;
    console.log(`Generated Excel buffer: ${buffer.length} bytes`);

    // 2. Send
    const service = new TelegramService();
    const success = await service.sendDocument(chatId, buffer, 'test_report.xlsx', 'This is a test Excel report.');

    if (success) {
        console.log('✅ Document sent successfully!');
    } else {
        console.error('❌ Failed to send document.');
    }
}

testExcel();
