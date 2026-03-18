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
        // Allow requests with no origin (mobile apps, same-origin fetches, curl)
        if (!origin) return callback(null, true);
        // Allow Render internal same-domain requests
        if (origin === 'null') return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        // Also allow any subdomain of onrender.com (for flexibility)
        if (origin && origin.endsWith('.onrender.com')) return callback(null, true);
        console.warn('CORS blocked origin:', origin);
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
    max: 30, // Increased to handle group purchases
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

        console.log(`📧 /api/send-ticket called → email: ${email}, tier: ${tier}, qty: ${qty}, ticketIds: ${JSON.stringify(ticketIds || ticketId)}`);

        // 1. Generate PDF
        const pdfPath = await generateTicket(ids, ticketTier, customerName || '');
        console.log(`📄 PDF generated at: ${pdfPath}`);

        // 2. Send email with pricing details
        await sendTicket(email, pdfPath, ids[0], ticketTier, customerName || '', ticketQty, ticketTotal);

        // 3. Save ticket(s) to Supabase attendees table (upsert — safe if called twice)
        const rows = ids.map(id => ({
            qr_code: id,
            email: email,
            checked_in: false,
            tier: ticketTier,
            customer_name: customerName || ''
        }));

        const { error: dbError } = await supabase
            .from('attendees')
            .upsert(rows, { onConflict: 'qr_code' });

        if (dbError) {
            console.error('Supabase insert error:', dbError.message);
            // Retry without new columns if schema not yet updated
            const fallbackRows = ids.map(id => ({ qr_code: id, email: email, checked_in: false }));
            await supabase.from('attendees').upsert(fallbackRows, { onConflict: 'qr_code' });
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

// --- ADMIN STATS ROUTE (Password-protected) ---
app.get("/api/admin/stats", async (req, res) => {
    const password = req.query.p;
    const adminPassword = process.env.ADMIN_PASSWORD || 'xpAdmin2026';
    
    if (password !== adminPassword) {
        return res.status(401).json({ error: "Non autorisé." });
    }

    try {
        const { data, error, count } = await supabase
            .from('attendees')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });
        
        if (error) throw error;

        const attendees = data || [];
        const totalSold = count || attendees.length;

        // Per-tier breakdown
        const tierCounts = { early: 0, regular: 0, last: 0, unknown: 0 };
        let revenue = 0;
        attendees.forEach(a => {
            const t = (a.tier || '').toLowerCase();
            if (t.includes('early')) { tierCounts.early++; revenue += 10; }
            else if (t.includes('last') || t.includes('derni')) { tierCounts.last++; revenue += 20; }
            else if (t.includes('regular') || t.includes('g') || t.includes('adm')) { tierCounts.regular++; revenue += 15; }
            else { tierCounts.unknown++; revenue += 10; }
        });

        res.json({
            total: totalSold,
            capacity: 300,
            revenue: revenue.toFixed(2),
            tiers: tierCounts,
            attendees: attendees.map(a => ({
                name: a.customer_name || a.name || '—',
                email: a.email || '—',
                tier: a.tier || '—',
                checked_in: a.checked_in || false,
                created_at: a.created_at || null
            }))
        });
    } catch (e) {
        console.error("Admin stats error:", e);
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