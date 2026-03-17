const fetch = require('node-fetch');

// This script simulates a Stripe Webhook event for payment_intent.succeeded
// Prerequisite: The backend server must be running (node server.js)

const TICKET_ID = 'test-ticket-' + Date.now();
const WEBHOOK_URL = 'http://localhost:3000/webhook';
const SECRET = 'whsec_k17VijGeFNgg9WLFLh82B6N4VcWPb4l7'; // Mock or real secret

async function simulateWebhook() {
    console.log('--- Simulating Webhook Event ---');
    
    const event = {
        id: 'evt_test_123',
        type: 'payment_intent.succeeded',
        data: {
            object: {
                id: 'pi_test_123',
                amount: 1264,
                currency: 'cad',
                receipt_email: 'xperimentalvol@gmail.com',
                metadata: {
                    qty: '1',
                    tier: 'Early Bird',
                    ticketId: TICKET_ID
                }
            }
        }
    };

    // Note: To test real signature verification, we'd need to mock stripe.webhooks.constructEvent
    // Since we are running the real webhook handler, it might fail signature check if we don't bypass it.
    // RECOMMENDATION: Test by calling /webhook directly if you mock the handler, 
    // or just trust the logic if signature is verified by Stripe normally.
    
    console.log(`Sending mock event for ticket: ${TICKET_ID}`);
    
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Stripe-Signature': 'mock_signature' // This will fail real constructEvent
            },
            body: JSON.stringify(event)
        });

        const text = await response.text();
        console.log(`Response status: ${response.status}`);
        console.log(`Response body: ${text}`);

        if (response.status === 400 && text.includes('Webhook Error')) {
            console.log('! signature verification failed as expected (this is normal for a mock script)');
            console.log('! The logic inside handleStripeWebhook was not executed.');
        }

    } catch (err) {
        console.error('Error sending webhook:', err.message);
    }
}

// simulateWebhook();
console.log('To run this test, you need "node-fetch".');
console.log('The webhook handler requires a valid signature from Stripe.');
