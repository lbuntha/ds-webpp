"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayWayParser = void 0;
class PayWayParser {
    /**
     * Parses a raw Telegram message text to extract PayWay transaction details.
     * Expected Format Examples:
     * "Received $10.00 from SOK DARA"
     * "Trx ID: 123456789"
     * ...
     */
    static parse(text) {
        if (!text)
            return null;
        // Pattern 1: Standard "Received" (Keep for compatibility if needed)
        // Pattern 2: "Paid by ... at DS by ... DSxxx" (From Screenshot)
        // Ex: "$35.00 paid by MIN KIMNAT ... at DS by S.ORN DS004. Trx. ID: ..."
        const format1 = /Received\s*(\$|USD|KHR|៛)\s*([\d,.]+)\s*from\s*(.+)/i;
        // Regex Explanation:
        // 1. Currency ($|USD...)
        // 2. Amount ([\d,.]+)
        // 3. Payer: "paid by (.+?) on" (lazy match until 'on')
        // 4. Driver Info: "at DS by (.+?) Trx" -> This contains Name and Code.
        // Let's be specific for Code: "DS\d+"
        const format2 = /(\$|USD|KHR|៛)([\d,.]+)\s*paid by\s*(.+?)\s*(?:on|via).+?at DS by\s*(.+?)(DS\d{3,4})\.?\s*Trx/i;
        let match = text.match(format2);
        let type = 2;
        if (!match) {
            match = text.match(format1);
            type = 1;
        }
        if (match) {
            let amountStr, currencyStr, payer, driverCode;
            let trxIdMatch = text.match(/Trx\.? ID:?\s*(\d+)/i); // Handle "Trx. ID" or "Trx ID"
            if (type === 2) {
                currencyStr = match[1];
                amountStr = match[2];
                payer = match[3].trim(); // "MIN KIMNAT (*356)"
                // match[4] is Driver Name "S.ORN "
                driverCode = match[5]; // "DS004"
            }
            else {
                // Type 1
                currencyStr = match[1];
                amountStr = match[2];
                payer = match[3].trim().split('\n')[0];
                driverCode = undefined; // No driver code in this format
            }
            const trxId = trxIdMatch ? trxIdMatch[1] : `unknown_${Date.now()}`;
            // Normalize Currency
            let currency = 'USD';
            currencyStr = currencyStr.toUpperCase();
            if (currencyStr === 'KHR' || currencyStr === '៛') {
                currency = 'KHR';
            }
            return {
                amount: parseFloat(amountStr.replace(/,/g, '')),
                currency,
                trxId,
                payer,
                driverCode, // New field, optional
                date: new Date(),
                originalText: text
            };
        }
        return null;
    }
}
exports.PayWayParser = PayWayParser;
//# sourceMappingURL=paywayParser.service.js.map