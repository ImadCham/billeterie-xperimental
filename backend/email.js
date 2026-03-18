// dotenv loaded by server.js
const nodemailer = require("nodemailer");
const path = require("path");

async function sendTicket(email, file, ticketId, tier = 'Régulier', customerName = '', qty = 1, total = 0) {

    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    const displayName = customerName ? customerName : 'cher(e) client(e)';
    const orderNum = '#XP-' + ticketId.substring(0, 8).toUpperCase();

    // --- Calculate pricing breakdown ---
    const tierLower = tier.toLowerCase();
    const isEarly = tierLower.includes('early');
    const isLast = tierLower.includes('last');
    
    let unitPrice = 15.00;
    if (isEarly) unitPrice = 10.00;
    else if (isLast) unitPrice = 20.00;

    const subtotal = unitPrice * qty;
    const fraisService = qty * 1.00;
    const montantTaxable = subtotal + fraisService;
    const tps = montantTaxable * 0.05;
    const tvq = montantTaxable * 0.09975;
    const totalFinal = total > 0 ? total : (montantTaxable + tps + tvq);
    
    let tierDisplay = 'Admission Générale';
    if (isEarly) tierDisplay = 'Early Bird';
    else if (isLast) tierDisplay = 'Dernière Minute (Last Chance)';
    const orderDate = new Date().toLocaleDateString('fr-CA');

    const htmlTemplate = `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Vos Billets - Xperimental Vol.2</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0d0d0d; margin: 0; padding: 0; color: #ffffff; }
            .container { max-width: 580px; margin: 0 auto; background: #111111; border-radius: 16px; overflow: hidden; }
            .poster-banner { width: 100%; display: block; }
            .header { background: #111111; padding: 28px 30px 20px; text-align: center; border-bottom: 1px solid #222; }
            .header h1 { margin: 0 0 6px; font-size: 26px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #fff; }
            .header p { margin: 0; color: #888; font-size: 13px; letter-spacing: 0.5px; }
            .accent-bar { height: 4px; background: linear-gradient(90deg, #7c3aed, #4f46e5); }
            .content { padding: 32px 30px; }
            .greeting { font-size: 18px; font-weight: 700; color: #fff; margin: 0 0 10px; }
            .subtitle { font-size: 14px; color: #aaa; line-height: 1.65; margin: 0 0 24px; }
            .details-box { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 20px 22px; margin-bottom: 24px; }
            .details-box p { margin: 8px 0; font-size: 14px; color: #ccc; }
            .details-box strong { color: #fff; }
            .order-num { font-family: monospace; font-size: 16px; font-weight: 700; color: #7c3aed; background: rgba(124,58,237,0.1); padding: 6px 12px; border-radius: 6px; display: inline-block; margin-bottom: 8px; }
            .section-title { font-size: 18px; font-weight: 800; color: #fff; margin: 0 0 16px; font-style: italic; }
            .ticket-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #2a2a2a; }
            .ticket-row:last-child { border-bottom: none; }
            .ticket-row .left { font-size: 14px; color: #ccc; }
            .ticket-row .left strong { color: #fff; font-weight: 700; }
            .ticket-row .right { font-size: 14px; color: #ccc; text-align: right; font-weight: 600; }
            .ticket-badge { display: inline-block; background: #2a2a2a; border: 1px solid #3a3a3a; border-radius: 4px; padding: 2px 8px; font-size: 11px; color: #999; margin-top: 4px; }
            .fee-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; color: #888; }
            .total-row { display: flex; justify-content: space-between; padding: 14px 0 0; margin-top: 10px; border-top: 2px solid #333; font-size: 16px; font-weight: 800; color: #fff; }
            .order-info-box { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 20px 22px; margin-bottom: 24px; }
            .order-info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a2a; font-size: 13px; }
            .order-info-row:last-child { border-bottom: none; }
            .order-info-row .label { color: #888; }
            .order-info-row .value { color: #fff; font-weight: 600; text-align: right; }
            .warning { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 8px; padding: 14px 16px; margin-top: 20px; }
            .warning p { margin: 0; font-size: 13px; color: #f87171; line-height: 1.5; }
            .footer { background: #0d0d0d; padding: 20px 30px; text-align: center; border-top: 1px solid #1f1f1f; }
            .footer p { margin: 4px 0; color: #555; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="accent-bar"></div>
            <img src="cid:event-poster" alt="Affiche Xperimental Vol.2" class="poster-banner">
            <div class="header">
                <h1>XPERIMENTAL VOL.2</h1>
                <p>Samedi 27 Mars 2026 &bull; 22h00 &ndash; 3h00 &bull; 356 Av Mont-Royal E, Montréal</p>
            </div>
            <div class="content">
                <p class="greeting">Merci ${displayName} ! 🎉</p>
                <p class="subtitle">Votre paiement a été traité avec succès. Votre place est officiellement réservée. Vos billets (PDF avec QR codes) sont en <strong>pièce jointe</strong> de ce courriel.</p>
                
                <!-- TICKET INFO SECTION -->
                <p class="section-title">Informations sur les billets</p>
                <div class="details-box" style="padding: 16px 22px;">
                    <div class="ticket-row">
                        <div class="left">
                            <strong>${qty}x &nbsp; ${tierDisplay}</strong><br>
                            <span class="ticket-badge">Billet électronique</span>
                        </div>
                        <div class="right">${subtotal.toFixed(2)} $ CA</div>
                    </div>
                    <div class="fee-row" style="margin-top: 12px;">
                        <span>Frais de service :</span>
                        <span>+ ${fraisService.toFixed(2)} $ CA</span>
                    </div>
                    <div class="fee-row">
                        <span>TPS (5%) :</span>
                        <span>+ ${tps.toFixed(2)} $ CA</span>
                    </div>
                    <div class="fee-row">
                        <span>TVQ (9.975%) :</span>
                        <span>+ ${tvq.toFixed(2)} $ CA</span>
                    </div>
                    <div class="total-row">
                        <span>Total, frais inclus :</span>
                        <span>${totalFinal.toFixed(2)} $ CA</span>
                    </div>
                </div>

                <!-- ORDER INFO SECTION -->
                <p class="section-title">Informations sur la commande</p>
                <div class="order-info-box">
                    <div class="order-info-row">
                        <span class="label">Numéro de commande :</span>
                        <span class="value">${orderNum}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Date de commande :</span>
                        <span class="value">${orderDate}</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Montant de la transaction :</span>
                        <span class="value">${totalFinal.toFixed(2)} $ CA</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Événement :</span>
                        <span class="value">Xperimental Vol.2</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Lieu :</span>
                        <span class="value">356 Av Mont-Royal E, Montréal</span>
                    </div>
                    <div class="order-info-row">
                        <span class="label">Date :</span>
                        <span class="value">Sam. 27 Mars 2026, 22h00</span>
                    </div>
                </div>

                <div class="warning">
                    <p>⚠️ <strong>Important :</strong> Présentez le PDF en pièce jointe sur votre téléphone avec la luminosité au maximum lors de votre arrivée. Chaque billet contient un QR code unique.</p>
                </div>
            </div>
            <div class="footer">
                <p>Questions ? Répondez simplement à ce courriel.</p>
                <p>&copy; 2026 Xperimental. Tous droits réservés.</p>
            </div>
        </div>
    </body>
    </html>
    `;

    await transporter.sendMail({
        from: '"Xperimental Vol.2 - Billets" <' + process.env.EMAIL_USER + '>',
        replyTo: process.env.EMAIL_USER,
        to: email,
        subject: 'Confirmation ' + orderNum + ' — Vos billets Xperimental Vol.2',
        headers: {
            'X-Priority': '1',
            'X-Mailer': 'Xperimental-Ticketing',
            'List-Unsubscribe': '<mailto:' + process.env.EMAIL_USER + '?subject=unsubscribe>'
        },
        text: "Bonjour " + displayName + ",\n\nMerci pour votre achat !\n\n--- Informations sur les billets ---\n" + qty + "x " + tierDisplay + " — " + subtotal.toFixed(2) + " $ CA\nFrais de service : " + fraisService.toFixed(2) + " $ CA\nTPS (5%) : " + tps.toFixed(2) + " $ CA\nTVQ (9.975%) : " + tvq.toFixed(2) + " $ CA\nTotal : " + totalFinal.toFixed(2) + " $ CA\n\n--- Informations sur la commande ---\nNumero de commande : " + orderNum + "\nEvenement : Xperimental Vol.2\nDate : Samedi 27 mars 2026 a 22h00\nLieu : 356 Av Mont-Royal E, Montreal\n\nPresentez votre QR code a la porte avec la luminosite au maximum.\n\nBonne soiree !\nL'equipe Xperimental",
        html: htmlTemplate,
        attachments: [
            {
                filename: 'poster.jpeg',
                path: path.join(__dirname, '../frontend/assets/poster.jpeg'),
                cid: 'event-poster'
            },
            {
                filename: 'Billets_Xperimental_Vol2.pdf',
                path: file,
                contentType: 'application/pdf'
            }
        ]
    });
}

module.exports = sendTicket;