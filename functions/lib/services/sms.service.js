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
    const API_KEY = process.env.PLASGATE_API_KEY || "Or_X_2up6I6rP1mj8fPHHufqr7MkyW";
    const SENDER_ID = process.env.PLASGATE_SENDER_ID || "DoorStep";
    const URL = "https://api.plasgate.com/send";
    const params = new URLSearchParams({
        token: API_KEY,
        phone: phone,
        senderID: SENDER_ID,
        text: content
    });
    try {
        console.log(`[SMS-SERVICE] Sending SMS to ${phone}: ${content}`);
        const response = await (0, node_fetch_1.default)(`${URL}?${params.toString()}`, {
            method: 'GET',
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