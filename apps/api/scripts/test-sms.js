/**
 * SMS Simulator — Test Moja SMS without Twilio credits!
 * 
 * This script simulates Twilio's webhook by sending POST requests
 * to your local /sms/incoming endpoint, just like Twilio would.
 * 
 * Usage:
 *   node test-sms.js                    (interactive mode)
 *   node test-sms.js "Hello Moja!"      (single message)
 * 
 * Make sure your API server is running first: pnpm dev
 */

const readline = require('readline');

const API_URL = 'http://localhost:4000/sms/incoming';

// Simulate a phone number — use your registered user's phone number
// Change this to match the phone number in your database!
const FROM_NUMBER = process.argv[2] === '--from' ? process.argv[3] : '+10000000000';

async function sendSms(body) {
    try {
        // Simulate exactly what Twilio sends to our webhook
        const params = new URLSearchParams({
            From: FROM_NUMBER,
            To: process.env.TWILIO_PHONE_NUMBER || '+15551234567',
            Body: body,
            MessageSid: 'SM' + Math.random().toString(36).substring(2, 34),
            AccountSid: 'TEST_ACCOUNT',
            NumMedia: '0',
        });

        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString(),
        });

        const xml = await res.text();

        // Extract the message text from TwiML response
        // TwiML looks like: <Response><Message>text here</Message></Response>
        const match = xml.match(/<Message>([\s\S]*?)<\/Message>/);
        const reply = match ? match[1] : xml;

        return reply;
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            return '❌ Cannot connect to API. Make sure server is running (pnpm dev)';
        }
        return `❌ Error: ${error.message}`;
    }
}

async function interactiveMode() {
    console.log('\n' + '='.repeat(60));
    console.log('  📱 MOJA SMS SIMULATOR');
    console.log('  Simulating SMS from:', FROM_NUMBER);
    console.log('  Type messages like you would text them.');
    console.log('  Type "quit" to exit the simulator.');
    console.log('='.repeat(60) + '\n');

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const ask = () => {
        rl.question('📤 You: ', async (input) => {
            if (!input || input.toLowerCase() === 'quit') {
                console.log('\n👋 Simulator closed.\n');
                rl.close();
                return;
            }

            const reply = await sendSms(input);
            console.log(`📥 Moja: ${reply}\n`);
            ask();
        });
    };

    ask();
}

async function singleMessage() {
    // Find the message argument (skip --from flag if present)
    let messageIndex = 2;
    if (process.argv[2] === '--from') {
        messageIndex = 4;
    }
    const message = process.argv[messageIndex];

    if (!message) {
        // No arguments — launch interactive mode
        await interactiveMode();
        return;
    }

    console.log(`📤 Sending: "${message}" from ${FROM_NUMBER}`);
    const reply = await sendSms(message);
    console.log(`📥 Moja: ${reply}`);
}

// Run
singleMessage();
