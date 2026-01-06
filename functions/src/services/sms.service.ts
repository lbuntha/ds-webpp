
import fetch from 'node-fetch';
import https from 'https';

// Create an agent that ignores SSL certificate errors (equivalent to verify=False in requests)
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

export const sendSMS = async (phone: string, content: string): Promise<any> => {
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

        const response = await fetch(`${URL}?${params.toString()}`, {
            method: 'GET',
            agent: httpsAgent
        });

        const data = await response.json();

        console.log('[SMS-SERVICE] Response:', data);
        return data;
    } catch (error) {
        console.error('[SMS-SERVICE] Error sending SMS:', error);
        throw error;
    }
};
