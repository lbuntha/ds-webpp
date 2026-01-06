
// If relative import fails, I might need to redefine or import from the shared source if structured.
// However, functions/src usually doesn't have access to ../../src unless configured.
// Let's check if I can assume types or just use 'any' for now to be safe, or redefine minimal interface.
// For robust code, I'll redefine minimal interfaces here to avoid build issues if ../../ is outside scope.

// Minimal Interfaces for local usage
interface LocalWalletTransaction {
    id: string;
    userId: string;
    userName?: string;
    amount: number;
    currency: 'USD' | 'KHR';
    type: string;
    status: string;
    date: string;
    description?: string;
    bankAccountId?: string;
    relatedItems?: { bookingId: string, itemId: string }[];
}

export interface SettlementBreakdown {
    totalCOD: number;
    totalDeliveryFee: number;
    netPayout: number;
}

import FormData from 'form-data';
import fetch from 'node-fetch';

export class TelegramService {
    private botToken: string;

    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        if (!this.botToken) {
            console.warn('TELEGRAM_BOT_TOKEN is not set. Telegram notifications will not be sent.');
        }
    }

    async sendMessage(chatId: string, text: string): Promise<boolean> {
        if (!this.botToken) return false;

        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            const response = await fetch(url, {
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
        } catch (error) {
            console.error('Failed to send Telegram message:', error);
            return false;
        }
    }

    async sendDocument(chatId: string, fileBuffer: Buffer, filename: string, caption?: string): Promise<boolean> {
        if (!this.botToken) return false;

        try {
            const form = new FormData();
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

            const response = await fetch(url, {
                method: 'POST',
                body: form as any,
                // @ts-ignore
                headers: form.getHeaders ? form.getHeaders() : {}
            });

            const data = await response.json();
            if (!data.ok) {
                console.error('Telegram Document API Error:', data);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Failed to send Telegram document:', error);
            return false;
        }
    }

    async sendPhoto(chatId: string, photo: Buffer | string, filename?: string, caption?: string): Promise<any> {
        if (!this.botToken) return null;

        try {
            const form = new FormData();
            form.append('chat_id', chatId);

            if (Buffer.isBuffer(photo)) {
                form.append('photo', photo, { filename: filename || 'image.jpg' });
            } else {
                form.append('photo', photo); // It's a file_id or URL
            }

            if (caption) {
                form.append('caption', caption);
                form.append('parse_mode', 'Markdown');
            }

            const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;

            const response = await fetch(url, {
                method: 'POST',
                body: form as any,
                // @ts-ignore
                headers: form.getHeaders ? form.getHeaders() : {}
            });

            const data = await response.json();
            if (!data.ok) {
                console.error('Telegram Photo API Error:', data);
                return null;
            }
            return data;
        } catch (error) {
            console.error('Failed to send Telegram photo:', error);
            return null;
        }
    }


    async sendSettlementReport(chatId: string, txn: LocalWalletTransaction, customerName: string, statusOverride?: string, excelBuffer?: Buffer, breakdown?: SettlementBreakdown): Promise<boolean> {
        const isUSD = txn.currency === 'USD';
        const symbol = isUSD ? '$' : '៛';
        const fmt = (val: number) => isUSD
            ? `${symbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
            : `${val.toLocaleString()} ${symbol}`;

        const amountStr = fmt(txn.amount);

        const title = statusOverride === 'APPROVED' ? '*Settlement Payout Approved & Sent*' : '*Settlement Payout Initiated*';
        const bodyText = statusOverride === 'APPROVED'
            ? `Your settlement payout has been approved and transferred. Reference: \`${txn.id}\``
            : `A settlement payout has been initiated for your account.`;

        let summaryLines: string[] = [];
        if (breakdown) {
            summaryLines = [
                `*Summary Breakdown:*`,
                `• Total COD: ${fmt(breakdown.totalCOD)}`,
                `• Total Delivery Fees: -${fmt(breakdown.totalDeliveryFee)}`,
                `• *Net Payout: ${fmt(breakdown.netPayout)}*`
            ];
        }

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
            `*Parcels Included:* ${txn.relatedItems?.length || 0}`,
            ``,
            statusOverride === 'APPROVED' ? `_See attached Excel file for detailed breakdown._` : '',
            ``,
            `This amount will be transferred to your registered bank account shortly.`,
            `Please check your banking app for receipt.`
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
