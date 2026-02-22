
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

    codCurrency?: 'USD' | 'KHR';
    deliveryFeeUSD?: number;
    deliveryFeeKHR?: number;
}

import FormData from 'form-data';
import fetch from 'node-fetch';
import * as admin from 'firebase-admin';

export class TelegramService {
    private botToken: string;

    constructor() {
        if (admin.apps.length === 0) {
            admin.initializeApp();
        }
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


    async sendSettlementReport(chatId: string, txn: LocalWalletTransaction, customerName: string, statusOverride?: string, excelBuffer?: Buffer, breakdown?: SettlementBreakdown, note?: string, excludeFees?: boolean): Promise<boolean> {
        // 1. Fetch Settlement Template from Settings
        let templateConfig: any = null;
        try {
            const settingsSnap = await admin.firestore().collection('settings').doc('general').get();
            if (settingsSnap.exists) {
                templateConfig = settingsSnap.data()?.settlementTemplate;
            }
        } catch (error) {
            console.error('Error fetching settlement template settings:', error);
        }

        const fmt = (val: number, currency?: 'USD' | 'KHR') => {
            const cur = currency || txn.currency;
            const sym = cur === 'USD' ? '$' : '៛';
            return cur === 'USD'
                ? `${sym}${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : `${val.toLocaleString()} ${sym}`;
        };

        const amountStr = fmt(txn.amount);
        const parcelCount = (txn.relatedItems?.length || 0).toString();

        // 2. Define Placeholders
        const data: Record<string, string> = {
            '{{customerName}}': customerName,
            '{{txnId}}': txn.id,
            '{{date}}': txn.date,
            '{{parcelCount}}': parcelCount,
            '{{totalCod}}': breakdown ? fmt(breakdown.totalCOD, breakdown.codCurrency) : amountStr,
            '{{totalFeesUsd}}': breakdown?.deliveryFeeUSD ? fmt(breakdown.deliveryFeeUSD, 'USD') : '$0.00',
            '{{totalFeesKhr}}': breakdown?.deliveryFeeKHR ? fmt(breakdown.deliveryFeeKHR, 'KHR') : '0 ៛',
            '{{netPayout}}': amountStr,
            '{{adminNote}}': note || '',
        };

        const format = (text: string) => {
            let result = text;
            for (const [key, value] of Object.entries(data)) {
                result = result.split(key).join(value);
            }
            return result;
        };

        // 3. Determine Content parts
        let title = '';
        let bodyText = '';
        let footerText = '';

        if (templateConfig) {
            title = statusOverride === 'APPROVED' ? format(templateConfig.approvedTitle) : format(templateConfig.initiatedTitle);
            bodyText = statusOverride === 'APPROVED' ? format(templateConfig.approvedBody) : format(templateConfig.initiatedBody);
            footerText = format(templateConfig.footer);
        } else {
            // Fallback to hardcoded defaults
            title = statusOverride === 'APPROVED' ? '*Settlement Payout Approved & Sent*' : '*Settlement Payout Initiated*';
            bodyText = statusOverride === 'APPROVED'
                ? `Your settlement payout has been approved and transferred. Reference: \`${txn.id}\``
                : `A settlement payout has been initiated for your account.`;
            footerText = `⚠️ _Please confirm the settlement amount within 7 days. After 7 days, Doorstep is not responsible for any discrepancies._\n\nThis amount will be transferred to your registered bank account shortly.\nPlease check your banking app for receipt.`;
        }

        let summaryLines: string[] = [];
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
            } else {
                // Normal Payout - With fee deductions
                // Build delivery fee lines
                const feeLines: string[] = [];

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
            `*Parcels Included:* ${parcelCount}`,
            ``,
            // Approval Note handled in Body or separate if note exists and body doesn't contain it
            // To be safe, we'll keep the Note from Admin logic if {{adminNote}} was NOT used in bodyText
            (note && !bodyText.includes(note)) ? `📝 *Note from Admin:* ${note}` : '',
            ``,
            statusOverride === 'APPROVED' ? `_See attached Excel file for detailed breakdown._` : '',
            ``,
            footerText
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
