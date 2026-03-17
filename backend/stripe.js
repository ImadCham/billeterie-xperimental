// --- SECURITY: Stripe keys must be set in .env ---
if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY manquante dans .env');
if (!process.env.STRIPE_PUBLISHABLE_KEY) throw new Error('STRIPE_PUBLISHABLE_KEY manquante dans .env');

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY;
const STRIPE_PUBLISHABLE = process.env.STRIPE_PUBLISHABLE_KEY;
const stripe = require("stripe")(STRIPE_SECRET);
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = async (req, res) => {
    try {
        const { items } = req.body;
        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: "Invalid items selection." });
        }
        // Count sold tickets to determine pricing tier
        const { count, error: countError } = await supabase
            .from('attendees')
            .select('*', { count: 'exact', head: true });

        const totalSold = count || 0;
        
        // CAPACITY LIMITS
        const CAPACITY_LIMIT = 300;
        const EARLY_BIRD_LIMIT = 80;
        
        let subtotal = 0;
        let totalQty = 0;
        let mainTier = "";

        for (const item of items) {
            const qty = item.qty || 0;
            totalQty += qty;
            
            if (item.id === 'early') {
                // If user somehow tries to buy early bird when sold out
                if (totalSold >= EARLY_BIRD_LIMIT) {
                    return res.status(400).json({ error: "Les billets Early Bird sont épuisés." });
                }
                subtotal += qty * 10.00;
                mainTier = "Early Bird";
            } else {
                subtotal += qty * 15.00;
                if (!mainTier) mainTier = "Admission Générale";
            }
        }

        if (totalSold + totalQty > CAPACITY_LIMIT) {
            return res.status(400).json({ error: "L'événement est COMPLET." });
        }
        
        // Frais de service (1.00$ par billet)
        const fraisService = totalQty * 1.00;
        
        // Calcul des taxes du Québec
        const montantTaxable = subtotal + fraisService;
        const tps = montantTaxable * 0.05;
        const tvq = montantTaxable * 0.09975;
        const totalAmount = montantTaxable + tps + tvq;

        const amountInCents = Math.round(totalAmount * 100);

        // Generate a unique Ticket ID here before payment
        const generatedTicketId = crypto.randomUUID();

        // Create a PaymentIntent with the order amount and currency
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: "cad",
            // In the latest api verison, automatic_payment_methods is enabled by default
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                qty: totalQty,
                tier: mainTier,
                ticketId: generatedTicketId
            }
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            publishableKey: STRIPE_PUBLISHABLE,
            amount: amountInCents,
            ticketTier: mainTier,
            ticketId: generatedTicketId
        });
    } catch (error) {
        console.error("Error creating payment intent:", error);
        res.status(500).json({ error: error.message });
    }
};