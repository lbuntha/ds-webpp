"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
const telegramService_1 = require("./services/telegramService");
const ExcelJS = __importStar(require("exceljs"));
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
    const buffer = await workbook.xlsx.writeBuffer();
    console.log(`Generated Excel buffer: ${buffer.length} bytes`);
    // 2. Send
    const service = new telegramService_1.TelegramService();
    const success = await service.sendDocument(chatId, buffer, 'test_report.xlsx', 'This is a test Excel report.');
    if (success) {
        console.log('✅ Document sent successfully!');
    }
    else {
        console.error('❌ Failed to send document.');
    }
}
testExcel();
//# sourceMappingURL=test-excel.js.map