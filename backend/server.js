require('dotenv').config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require('fs');
const rateLimit = require('express-rate-limit');

const createPaymentIntent = require("./stripe");
const { handleStripeWebhook } = require("./webhook");
const generateTicket = require('./tickets');
const sendTicket = require('./email');

// Supabase client (server-side)
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

const app = express();

// --- SECURITY: Restrict CORS ---
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    process.env.FRONTEND_URL  // Set this in .env for production
].filter(Boolean);

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Not allowed by CORS'));
    }
}));

// --- SECURITY: Rate Limiting ---
const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { error: 'Trop de requêtes. Réessayez dans 1 minute.' }
});

const emailLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Trop de requêtes. Réessayez dans 1 minute.' }
});

// --- ROUTES ---
app.post("/webhook", express.raw({type: 'application/json'}), handleStripeWebhook);
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));
app.post("/create-payment-intent", paymentLimiter, createPaymentIntent);

app.post("/api/send-ticket", emailLimiter, async (req, res) => {
    try {
        const { ticketId, ticketIds, email, tier, customerName, orderId, qty, total } = req.body;
        const ticketTier = tier || 'Régulier';
        const ticketQty = parseInt(qty) || 1;
        const ticketTotal = parseFloat(total) || 0;

        // --- SECURITY: Validate email format ---
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ error: "Adresse email invalide." });
        }

        // Accept either a single ticketId or an array of ticketIds
        const ids = ticketIds || (ticketId ? [ticketId] : null);

        if (!ids || ids.length === 0) {
            return res.status(400).json({ error: "Missing ticketId(s) or email" });
        }

        console.log(`Building PDF for ${ids.length} ticket(s) → ${email}...`);

        // 1. Generate PDF
        const pdfPath = await generateTicket(ids, ticketTier, customerName || '');

        // 2. Send email with pricing details
        await sendTicket(email, pdfPath, ids[0], ticketTier, customerName || '', ticketQty, ticketTotal);

        // 3. Save ticket(s) to Supabase attendees table (upsert — safe if called twice)
        const rows = ids.map(id => ({
            qr_code: id,     // On utilise la colonne qr_code qui n'a pas de FK
            email: email,
            checked_in: false
        }));

        const { error: dbError } = await supabase
            .from('attendees')
            .upsert(rows, { onConflict: 'qr_code' });

        if (dbError) {
            console.error('Supabase insert error:', dbError.message);
        } else {
            console.log(`✅ ${ids.length} ticket(s) saved to Supabase for ${email}`);
        }

        // 4. Clean up PDF after 5 min
        setTimeout(() => {
            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        }, 1000 * 60 * 5);

        res.json({ success: true, message: "Email Sent!" });
    } catch (e) {
        console.error("Failed to send ticket email:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});