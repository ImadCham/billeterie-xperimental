const { createClient } = require('@supabase/supabase-js');
const generateTicket = require('./tickets');
const sendTicket = require('./email');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const stripe = require("stripe")(STRIPE_SECRET);

const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        console.log(`PaymentIntent for ${paymentIntent.amount} was successful!`);
        
        try {
            // Retrieve qty and tier from metadata
            const qty = parseInt(paymentIntent.metadata?.qty) || 1;
            const ticketTier = paymentIntent.metadata?.tier || 'Régulier';
            const metadataTicketId = paymentIntent.metadata?.ticketId;
            
            // Get Customer Email safely (latest API structure)
            const customerEmail = paymentIntent.receipt_email || 'client@example.com'; 

            // Since the frontend (success.html) generates the ticket, we must retrieve it
            // using the paymentIntent.id rather than blindly creating duplicates.
            
            // Give the frontend 2 seconds to finish its insert before querying
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            let ticketId = metadataTicketId;
            
            // 1. Fetch ticket from Supabase matching this Stripe Payment
            // Try to find by qr_code (which is our unique handle)
            const { data, error } = await supabase
                .from('attendees')
                .select('*')
                .eq('qr_code', ticketId)
                .limit(1);
                
            if (data && data.length > 0) {
                console.log("Found ticket in DB:", ticketId);
                // Use the data from DB if available
            } else {
                console.log("Ticket not found in DB from frontend. Generating fallback entry...");
                // Fallback: If frontend failed to insert, webhook creates it
                if (!ticketId) ticketId = crypto.randomUUID();
                await supabase
                    .from('attendees')
                    .upsert([
                        { id: ticketId, qr_code: ticketId, checked_in: false, email: customerEmail }
                    ], { onConflict: 'qr_code' });
            }
            
            // 2. Generate PDF and QR code locally
            const pdfPath = await generateTicket(ticketId, ticketTier);

            // 3. Email the Ticket PDF
            await sendTicket(customerEmail, pdfPath, ticketId, ticketTier);
            
            // Clean up local pdf files later ideally.
            setTimeout(() => {
                if(fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
            }, 1000 * 60 * 10);

            console.log(`Processed ${qty} tickets for ${customerEmail}`);
            
        } catch (e) {
            console.error("Failed to process post-payment workflow:", e);
        }
    }

    res.send();
};

module.exports = { handleStripeWebhook };
