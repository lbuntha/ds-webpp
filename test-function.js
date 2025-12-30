// Test script for authenticated Cloud Function calls
// Run with: node test-function.js

const https = require('https');

// Your function URL
const FUNCTION_URL = 'https://api-ivsn3uu2pa-uc.a.run.app';

// Test 1: Health check (will fail without auth)
function testHealthCheck() {
    console.log('Testing /health endpoint...\n');

    https.get(`${FUNCTION_URL}/health`, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('Status Code:', res.statusCode);
            console.log('Response:', data);
            console.log('\n---\n');
        });
    }).on('error', (err) => {
        console.error('Error:', err.message);
    });
}

// Test 2: With Firebase ID token (you'll need to get this from your app)
function testWithAuth(idToken) {
    console.log('Testing with authentication...\n');

    const options = {
        hostname: 'api-ivsn3uu2pa-uc.a.run.app',
        path: '/health',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${idToken}`
        }
    };

    const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
            data += chunk;
        });

        res.on('end', () => {
            console.log('Status Code:', res.statusCode);
            console.log('Response:', data);
        });
    });

    req.on('error', (err) => {
        console.error('Error:', err.message);
    });

    req.end();
}

// Run tests
testHealthCheck();

// To test with auth, get an ID token from your Firebase app and uncomment:
// const idToken = 'YOUR_FIREBASE_ID_TOKEN_HERE';
// testWithAuth(idToken);
