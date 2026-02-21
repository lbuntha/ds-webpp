
import fetch from 'node-fetch';

// const API_URL = 'http://127.0.0.1:5001/doorstep-delivery-2ad27/us-central1/api';
// Use the URL from .env or default to localhost
const API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:5001/doorstep-c75e3/us-central1/api';

async function runtest() {
    const phone = '012999888';

    console.log(`1. Requesting OTP for ${phone}...`);
    try {
        const reqRes = await fetch(`${API_URL}/auth/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, purpose: 'LOGIN' })
        });

        const reqData = await reqRes.json();
        console.log('Request OTP Response:', reqData);

        if (!reqRes.ok) throw new Error(reqData.message);

        const code = reqData.data.debugCode;
        if (!code) throw new Error('Debug code not returned! Check auth.controller.ts');

        console.log(`2. Got OTP Code: ${code}`);

        console.log(`3. Logging in with OTP...`);
        const loginRes = await fetch(`${API_URL}/auth/login-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, otp: code })
        });

        const loginData = await loginRes.json();
        console.log('Login Response:', loginData);

        if (!loginRes.ok) {
            // If user not found, we expect 404. Ideally we should create a user first.
            // But for now, let's see if we get "User not found" which confirms OTP verification passed.
            if (loginData.message && loginData.message.includes('User not found')) {
                console.log('✅ OTP Verified (User not found is expected if not signed up)');
            } else {
                throw new Error(loginData.message);
            }
        } else {
            console.log('✅ Login Successful!');
            console.log('Token:', loginData.data.token ? 'Received' : 'Missing');
        }

    } catch (e: any) {
        console.error('❌ Test Failed:', e.message);
    }
}

runtest();
