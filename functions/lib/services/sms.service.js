"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
const https_1 = __importDefault(require("https"));
// Create an agent that ignores SSL certificate errors (equivalent to verify=False in requests)
const httpsAgent = new https_1.default.Agent({
    rejectUnauthorized: false
});
const sendSMS = async (phone, content) => {
    const PRIVATE_KEY = process.env.PLASGATE_PRIVATE_KEY || "f-B0Om1QTE6va7VmjKey3b9jbu0T6mMCC91qfrlMg1wqHizmJFGSANFbdbd0X6p2-oumaLN-96IsTLI4hMRtbg";
    const SECRET_KEY = process.env.PLASGATE_SECRET_KEY || "$5$rounds=535000$1wR3Be1HOkovm15M$FEH.SME6XeimaFi0qigSFdthpKdIRbtobo9z.r5Er37";
    const SENDER_ID = process.env.PLASGATE_SENDER_ID || "DoorStep";
    const URL = "https://cloudapi.plasgate.com/rest/send";
    // Normalize phone number:
    // 1. Remove non-digits
    // 2. Remove leading 0 if present
    // 3. Ensure 855 prefix for Cambodian numbers
    let normalizedPhone = phone.replace(/\D/g, '');
    if (normalizedPhone.startsWith('0')) {
        normalizedPhone = normalizedPhone.substring(1);
    }
    if (!normalizedPhone.startsWith('855') && normalizedPhone.length <= 10) {
        normalizedPhone = `855${normalizedPhone}`;
    }
    // Construct POST request
    // Note: private_key goes in query params, secret in header, data in body
    const params = new URLSearchParams({
        private_key: PRIVATE_KEY
    });
    const body = {
        sender: SENDER_ID,
        to: normalizedPhone,
        content: content
    };
    try {
        console.log(`[SMS-SERVICE] Sending SMS to ${normalizedPhone} via POST`);
        const response = await (0, node_fetch_1.default)(`${URL}?${params.toString()}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Secret': SECRET_KEY
            },
            body: JSON.stringify(body),
            agent: httpsAgent
        });
        const data = await response.json();
        console.log('[SMS-SERVICE] Response:', data);
        return data;
    }
    catch (error) {
        console.error('[SMS-SERVICE] Error sending SMS:', error);
        throw error;
    }
};
exports.sendSMS = sendSMS;
//# sourceMappingURL=sms.service.js.map