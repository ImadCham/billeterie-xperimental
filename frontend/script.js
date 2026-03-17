const SUPABASE_URL = "https://gzvyzkshymhgyoukhhzx.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dnl6a3NoeW1oZ3lvdWtoaHp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjczODYsImV4cCI6MjA4ODk0MzM4Nn0.OAeZpSxHMlHDvrb--h98ms_b4fFsbkkVWbnutC_8baA";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// Dictionary for bilingual support
const dict = {
    fr: {
        location: "356 AV MONT-ROYAL E – MONTREAL",
        main_btn: "ACHETER BILLETS",
        back: "← Retour",
        select: "Sélectionner vos billets",
        early_title: "Early Bird",
        early_desc: "Quantité limitée. (Seulement 80 disponibles)",
        regular_title: "Admission Générale (Regular)",
        regular_desc: "Accès standard à l'événement.",
        total_label: "Total :",
        buy_empty: "Sélectionner",
        buy_n: "Acheter",
        ticket_singular: "billet",
        ticket_plural: "billets",
        sold_out: "COMPLET",
        sold_out_desc: "Toutes les places ont été vendues.",
        presenter: "Xperimental présente",
        event_details: "Samedi 27 Mars 2026 de 22:00 à 3:00 au 356 Av Mont-Royal E",
        loading: "Chargement..."
    },
    en: {
        location: "356 AV MONT-ROYAL E – MONTREAL",
        main_btn: "BUY TICKETS",
        back: "← Back",
        select: "Select Tickets",
        early_title: "Early Bird",
        early_desc: "Limited quantity. (Only 80 available)",
        regular_title: "General Admission (Regular)",
        regular_desc: "Standard access to the event.",
        total_label: "Total:",
        buy_empty: "Select",
        buy_n: "Buy",
        ticket_singular: "ticket",
        ticket_plural: "tickets",
        sold_out: "SOLD OUT",
        sold_out_desc: "All tickets have been sold.",
        presenter: "Xperimental presents",
        event_details: "Saturday, March 27, 2026 from 10:00 PM to 3:00 AM at 356 Av Mont-Royal E",
        loading: "Loading..."
    }
};

let currentLang = 'fr';
let quantities = {
    early: 0,
    regular: 0
};
const TICKETS = {
    early: 10.00,
    regular: 15.00
};

// Change Language
function setLang(lang) {
    currentLang = lang;
    
    // Update active button visually
    document.getElementById('btn-fr').classList.remove('active');
    document.getElementById('btn-en').classList.remove('active');
    document.getElementById('btn-' + lang).classList.add('active');
    
    // Update texts in the DOM (with null checks for safety)
    const d = dict[lang];
    const setIfExists = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };
    
    setIfExists('t-location', d.location);
    setIfExists('t-main-btn', d.main_btn);
    setIfExists('t-back', d.back);
    setIfExists('t-select', d.select);
    
    // Ticket specific
    setIfExists('t-early-title', d.early_title);
    setIfExists('t-early-desc', d.early_desc);
    setIfExists('t-regular-title', d.regular_title);
    setIfExists('t-regular-desc', d.regular_desc);
    
    // Header & Details
    const presenter = document.querySelector('.event-presenter');
    if (presenter) presenter.innerText = d.presenter;
    const details = document.querySelector('.event-details');
    if (details) details.innerText = d.event_details;
    
    setIfExists('t-total-label', d.total_label);
    
    updateCheckoutUI();
}

// Navigation between views
function showTickets() {
    document.getElementById('home-page').classList.remove('view-active');
    document.getElementById('home-page').classList.add('view-hidden');
    
    document.getElementById('tickets-page').classList.remove('view-hidden');
    document.getElementById('tickets-page').classList.add('view-active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showHome() {
    document.getElementById('tickets-page').classList.remove('view-active');
    document.getElementById('tickets-page').classList.add('view-hidden');
    
    document.getElementById('home-page').classList.remove('view-hidden');
    document.getElementById('home-page').classList.add('view-active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Modify Quantities
function updateQty(tier, change) {
    let newQty = quantities[tier] + change;
    
    // Limits
    if (newQty < 0) return;
    
    // Limit to 10 total per transaction to avoid abuse
    const totalCurrent = quantities.early + quantities.regular;
    if (change > 0 && totalCurrent >= 10) return;
    
    quantities[tier] = newQty;
    document.getElementById(`qty-${tier}`).innerText = newQty;
    
    updateCheckoutUI();
}

// Calculate Total & update Bar
function updateCheckoutUI() {
    const totalItems = quantities.early + quantities.regular;
    const totalAmount = (quantities.early * TICKETS.early) + (quantities.regular * TICKETS.regular);
    
    document.getElementById('total-price').innerText = `$${totalAmount.toFixed(2)}`;
    
    const checkoutBar = document.getElementById('checkout-bar');
    const checkoutBtn = document.getElementById('checkout-btn');
    const d = dict[currentLang];
    
    if (totalItems > 0) {
        checkoutBar.classList.add('visible');
        checkoutBtn.disabled = false;
        
        const ticketWord = totalItems > 1 ? d.ticket_plural : d.ticket_singular;
        checkoutBtn.innerText = `${d.buy_n} ${totalItems} ${ticketWord}`;
    } else {
        checkoutBar.classList.remove('visible');
        checkoutBtn.disabled = true;
        checkoutBtn.innerText = d.buy_empty;
    }
}

// Dummy Checkout Function for Stripe Integration
function checkout() {
    const totalAmount = (quantities.early * TICKETS.early) + (quantities.regular * TICKETS.regular);
    
    const checkoutBtn = document.getElementById('checkout-btn');
    const d = dict[currentLang];
    checkoutBtn.innerText = d.loading;
    checkoutBtn.disabled = true;
    
    // Prepare items for URL - simple comma separated format or multiple params
    const items = [];
    if (quantities.early > 0) items.push(`early:${quantities.early}`);
    if (quantities.regular > 0) items.push(`regular:${quantities.regular}`);
    
    // Redirect to checkout.html with query parameters
    setTimeout(() => {
        const queryParams = `?qty=${quantities.early + quantities.regular}&items=${items.join(',')}&total=${totalAmount}&lang=${currentLang}`;
        
        if (window.location.protocol === 'file:') {
            window.location.href = `http://localhost:3000/checkout.html${queryParams}`;
        } else {
            window.location.href = `checkout.html${queryParams}`;
        }
    }, 500);
}

// Initialize on Document Load
document.addEventListener("DOMContentLoaded", async () => {
    // Default to French
    setLang('fr');
    
    // Dynamically query Supabase to set the correct ticket tier and price
    try {
        const { count, error } = await supabaseClient
            .from('attendees')
            .select('*', { count: 'exact', head: true });
            
        let totalSold = count || 0;
        const CAPACITY_LIMIT = 300;
        const EARLY_BIRD_LIMIT = 80;

        // 1. Check Full Capacity
        if (!error && totalSold >= CAPACITY_LIMIT) {
             // ... already handled by backend error but let's hide in UI
             ["early", "regular"].forEach(tier => {
                 const card = document.getElementById(`card-${tier}`);
                 if (card) card.classList.add('sold-out');
                 const ctrl = document.getElementById(`ctrl-${tier}`);
                 if (ctrl) ctrl.style.display = 'none';
                 const title = document.getElementById(`t-${tier}-title`);
                 if (title) title.innerText = dict[currentLang].sold_out;
             });

             const mainBtn = document.getElementById('t-main-btn');
             if (mainBtn) {
                 mainBtn.innerText = "SOLD OUT / COMPLET";
                 mainBtn.disabled = true;
                 mainBtn.style.opacity = "0.5";
             }
             return;
        }
        
        // 2. Check Early Bird Limit
        if (!error && totalSold >= EARLY_BIRD_LIMIT) {
            // Hide Early Bird
            const ebCard = document.getElementById('card-early');
            if (ebCard) ebCard.style.display = 'none';

            // Show Regular
            const regCard = document.getElementById('card-regular');
            if (regCard) {
                regCard.style.display = 'flex';
                // Reset Regular quantity just in case
                quantities.regular = 0;
            }
        } else {
            // Under 80: Show only Early Bird
            const ebCard = document.getElementById('card-early');
            if (ebCard) ebCard.style.display = 'flex';
            
            const regCard = document.getElementById('card-regular');
            if (regCard) regCard.style.display = 'none';
        }
    } catch(err) {
        console.error("Error fetching ticket pricing state", err);
    }

    // Check if coming back from checkout
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('view') === 'tickets') {
        showTickets();
        
        // Clean URL so refresh doesn't keep opening tickets if user wants home later
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path:newUrl}, '', newUrl);
    }
});