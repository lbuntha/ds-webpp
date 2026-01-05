
export interface PayWayTransaction {
    amount: number;
    currency: 'USD' | 'KHR';
    trxId: string;
    payer: string;
    date: Date;
    originalText: string;
}

export class PayWayParser {

    /**
     * Parses a raw Telegram message text to extract PayWay transaction details.
     * Expected Format Examples:
     * "Received $10.00 from SOK DARA"
     * "Trx ID: 123456789"
     * ...
     */
    static parse(text: string): PayWayTransaction | null {
        if (!text) return null;

        // 1. Check for PayWay signature (add more flexible checks if needed)
        // Usually PayWay messages start with "Received" or contain "PayWay"
        // But for now we just try to match the pattern.

        // Pattern: Received [Currency] [Amount] from [Name]
        // Supports: $1.50, USD 1.50, KHR 5000, ៛5000
        const receivedRegex = /Received\s*(\$|USD|KHR|៛)\s*([\d,.]+)\s*from\s*(.+)/i;
        const trxRegex = /Trx ID:\s*(\d+)/i;


        const receivedMatch = text.match(receivedRegex);
        const trxMatch = text.match(trxRegex);

        if (receivedMatch && trxMatch) {
            let currencyStr = receivedMatch[1].toUpperCase();
            let amountStr = receivedMatch[2].replace(/,/g, ''); // Remove commas
            const payer = receivedMatch[3].trim().split('\n')[0]; // Take first line only if multiline
            const trxId = trxMatch[1];

            // Normalize Currency
            let currency: 'USD' | 'KHR' = 'USD';
            if (currencyStr === 'KHR' || currencyStr === '៛') {
                currency = 'KHR';
            }

            return {
                amount: parseFloat(amountStr),
                currency,
                trxId,
                payer,
                date: new Date(), // Caller should overwrite this with message date
                originalText: text
            };
        }

        return null;
    }
}
