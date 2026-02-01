"use strict";
// If relative import fails, I might need to redefine or import from the shared source if structured.
// However, functions/src usually doesn't have access to ../../src unless configured.
// Let's check if I can assume types or just use 'any' for now to be safe, or redefine minimal interface.
// For robust code, I'll redefine minimal interfaces here to avoid build issues if ../../ is outside scope.
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const form_data_1 = __importDefault(require("form-data"));
const node_fetch_1 = __importDefault(require("node-fetch"));
class TelegramService {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        if (!this.botToken) {
            console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram notifications will not be sent.');
        }
    }
    async sendMessage(chatId, text) {
        if (!this.botToken)
            return false;
        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            const response = await (0, node_fetch_1.default)(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    parse_mode: 'Markdown'
                })
            });
            const data = await response.json();
            if (!data.ok) {
                console.error('Telegram API Error:', data);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Failed to send Telegram message:', error);
            return false;
        }
    }
    async sendDocument(chatId, fileBuffer, filename, caption) {
        if (!this.botToken)
            return false;
        try {
            const form = new form_data_1.default();
            form.append('chat_id', chatId);
            form.append('document', fileBuffer, { filename });
            if (caption) {
                form.append('caption', caption);
                form.append('parse_mode', 'Markdown');
            }
            const url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;
            // Note: form-data headers need to be passed correctly to fetch
            // But node-fetch or native fetch in recent Node might behave differently with FormData
            // Using common approach for node
            const response = await (0, node_fetch_1.default)(url, {
                method: 'POST',
                body: form,
                // @ts-ignore
                headers: form.getHeaders ? form.getHeaders() : {}
            });
            const data = await response.json();
            if (!data.ok) {
                console.error('Telegram Document API Error:', data);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error('Failed to send Telegram document:', error);
            return false;
        }
    }
    async sendPhoto(chatId, photo, filename, caption) {
        if (!this.botToken)
            return null;
        try {
            const form = new form_data_1.default();
            form.append('chat_id', chatId);
            if (Buffer.isBuffer(photo)) {
                form.append('photo', photo, { filename: filename || 'image.jpg' });
            }
            else {
                form.append('photo', photo); // It's a file_id or URL
            }
            if (caption) {
                form.append('caption', caption);
                form.append('parse_mode', 'Markdown');
            }
            const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
            const response = await (0, node_fetch_1.default)(url, {
                method: 'POST',
                body: form,
                // @ts-ignore
                headers: form.getHeaders ? form.getHeaders() : {}
            });
            const data = await response.json();
            if (!data.ok) {
                console.error('Telegram Photo API Error:', data);
                return null;
            }
            return data;
        }
        catch (error) {
            console.error('Failed to send Telegram photo:', error);
            return null;
        }
    }
    async sendSettlementReport(chatId, txn, customerName, statusOverride, excelBuffer, breakdown, note, excludeFees) {
        var _a;
        const fmt = (val, currency) => {
            const cur = currency || txn.currency;
            const sym = cur === 'USD' ? '$' : '៛';
            return cur === 'USD'
                ? `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : `${val.toLocaleString()} ${sym}`;
        };
        const amountStr = fmt(txn.amount);
        const title = statusOverride === 'APPROVED' ? '*Settlement Payout Approved & Sent*' : '*Settlement Payout Initiated*';
        const bodyText = statusOverride === 'APPROVED'
            ? `Your settlement payout has been approved and transferred. Reference: \`${txn.id}\``
            : `A settlement payout has been initiated for your account.`;
        let summaryLines = [];
        if (breakdown) {
            const codCurrency = breakdown.codCurrency || txn.currency;
            if (excludeFees) {
                // Gross Payout - Fees owed separately by customer
                const feeOwed = (breakdown.deliveryFeeUSD || 0) + (breakdown.deliveryFeeKHR || 0) > 0
                    ? (breakdown.deliveryFeeUSD && breakdown.deliveryFeeUSD > 0 ? fmt(breakdown.deliveryFeeUSD, 'USD') : '') +
                        (breakdown.deliveryFeeUSD && breakdown.deliveryFeeKHR ? ' + ' : '') +
                        (breakdown.deliveryFeeKHR && breakdown.deliveryFeeKHR > 0 ? fmt(breakdown.deliveryFeeKHR, 'KHR') : '')
                    : fmt(breakdown.totalDeliveryFee || 0);
                summaryLines = [
                    `*Summary Breakdown (Gross Payout):*`,
                    `• Total COD: ${fmt(breakdown.totalCOD, codCurrency)}`,
                    `• Delivery Fees: ${feeOwed} _(owed to Doorstep)_`,
                    `• *Net Payout: ${fmt(breakdown.totalCOD, codCurrency)}*` // Net = COD when fees excluded
                ];
            }
            else {
                // Normal Payout - With fee deductions
                // Build delivery fee lines
                const feeLines = [];
                if (breakdown.deliveryFeeUSD && breakdown.deliveryFeeUSD > 0) {
                    feeLines.push(`• Total Delivery Fees (USD): -${fmt(breakdown.deliveryFeeUSD, 'USD')}`);
                }
                if (breakdown.deliveryFeeKHR && breakdown.deliveryFeeKHR > 0) {
                    feeLines.push(`• Total Delivery Fees (KHR): -${fmt(breakdown.deliveryFeeKHR, 'KHR')}`);
                }
                // Fallback for legacy
                if (feeLines.length === 0 && breakdown.totalDeliveryFee) {
                    // Try to guess or just use txn currency
                    feeLines.push(`• Total Delivery Fees: -${fmt(breakdown.totalDeliveryFee)}`);
                }
                summaryLines = [
                    `*Summary Breakdown:*`,
                    `• Total COD: ${fmt(breakdown.totalCOD, codCurrency)}`,
                    ...feeLines,
                    `• *Net Payout: ${fmt(breakdown.netPayout)}*` // Net payout is always in txn currency
                ];
            }
        }
        // Terms and Conditions Footer
        const termsAndConditions = `⚠️ _Please confirm the settlement amount within 7 days. After 7 days, Doorstep is not responsible for any discrepancies._`;
        const lines = [
            title,
            `--------------------------------`,
            `Dear *${customerName}*,`,
            ``,
            bodyText,
            ``,
            ...summaryLines,
            // Fallback if breakdown not provided, though we should aim to provide it
            !breakdown ? `*Total Amount:* ${amountStr}` : '',
            `*Date:* ${txn.date}`,
            `*Parcels Included:* ${((_a = txn.relatedItems) === null || _a === void 0 ? void 0 : _a.length) || 0}`,
            ``,
            // Approval Note (if present)
            note ? `📝 *Note from Admin:* ${note}` : '',
            ``,
            statusOverride === 'APPROVED' ? `_See attached Excel file for detailed breakdown._` : '',
            ``,
            `This amount will be transferred to your registered bank account shortly.`,
            `Please check your banking app for receipt.`,
            ``,
            termsAndConditions
        ].filter(l => l !== '');
        const caption = lines.join('\n');
        // If we have an Excel buffer, send as document
        if (excelBuffer) {
            return this.sendDocument(chatId, excelBuffer, `Settlement_${txn.id}.xlsx`, caption);
        }
        // Otherwise send as text
        return this.sendMessage(chatId, caption);
    }
}
exports.TelegramService = TelegramService;
//# sourceMappingURL=telegramService.js.map