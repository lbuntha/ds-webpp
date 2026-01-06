
import { sendSMS } from './services/sms.service';

const testSMS = async () => {
    // You should modify the phone number here to your own for testing
    const TEST_PHONE = '85512345678'; // Replace with real number
    const TEST_MESSAGE = 'DoorStep Test OTP: 123456';

    console.log('--- Starting SMS Test ---');
    console.log(`Target: ${TEST_PHONE}`);
    console.log(`Message: ${TEST_MESSAGE}`);

    try {
        const result = await sendSMS(TEST_PHONE, TEST_MESSAGE);
        console.log('--- SMS Test Result ---');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('--- SMS Test Failed ---');
        console.error(error);
    }
};

// Check if run directly
if (require.main === module) {
    // Check for command line arguments
    const args = process.argv.slice(2);
    if (args.length > 0) {
        const phone = args[0];
        const msg = args[1] || 'Test Message';
        sendSMS(phone, msg)
            .then(res => console.log('Result:', res))
            .catch(err => console.error('Error:', err));
    } else {
        console.log('Usage: npx ts-node src/test-sms.ts <phone_number> [message]');
        console.log('Running default test...');
        testSMS();
    }
}
