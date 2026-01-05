const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input'); // npm i input
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load from functions/.env

const apiId = Number(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;

// Helper to validate env vars
if (!apiId || !apiHash) {
    console.error("❌ Missing TELEGRAM_API_ID or TELEGRAM_API_HASH in .env");
    process.exit(1);
}

const stringSession = new StringSession(''); // Start with empty session

(async () => {
    console.log("Loading interactive client...");

    // 1. Create Client
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    // 2. Start (Triggers login flow)
    await client.start({
        phoneNumber: async () => await input.text('Please enter your number (international format, e.g. +855...): '),
        password: async () => await input.text('Please enter your password (if 2FA enabled): '),
        phoneCode: async () => await input.text('Please enter the code you received: '),
        onError: (err) => console.log(err),
    });

    console.log("✅ You should now be connected.");

    // 3. Save Session
    const sessionString = client.session.save();
    console.log("\n⬇️ SAVE THIS STRING TO YOUR functions/.env AS 'TELEGRAM_SESSION' ⬇️\n");
    console.log(sessionString);
    console.log("\n⬆️ ----------------------------------------------------------- ⬆️");

    await client.disconnect();
})();
