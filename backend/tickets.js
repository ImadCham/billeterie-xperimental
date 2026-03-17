const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

/**
 * Generate a wallet-pass-style PDF — one page per ticket.
 * Design: XPERIMENTAL header | full poster | info row | QR code | ID
 */
async function generateTicket(ids, tier = 'Régulier', names = '') {
    const ticketIds = Array.isArray(ids) ? ids : [ids];
    const namesList = Array.isArray(names) ? names : ticketIds.map(() => names);

    // Pre-generate all QR codes as PNG buffers
    const qrBuffers = await Promise.all(
        ticketIds.map(id => QRCode.toBuffer(id, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } }))
    );

    const posterPath = path.join(__dirname, '../frontend/assets/poster.jpeg');
    const hasPoster = fs.existsSync(posterPath);

    return new Promise((resolve, reject) => {
        const dir = path.join(__dirname, '../tickets');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, `${ticketIds[0]}.pdf`);

        // Use custom page size matching the wallet pass proportions (like a phone screen)
        // 400 x 750 points
        const PW = 400;
        const PH = 880;

        const doc = new PDFDocument({ size: [PW, PH], margin: 0, autoFirstPage: false });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        ticketIds.forEach((id, i) => {
            doc.addPage();
            const name = namesList[i] || namesList[0] || '';
            const shortId = id.substring(0, 8).toUpperCase();

            // ── Black background ─────────────────────────────────────────────
            doc.rect(0, 0, PW, PH).fill('#000000');

            // ── Header row: "X P E R I M E N T A L" + date/time ─────────────
            const headerH = 44;
            doc.rect(0, 0, PW, headerH).fill('#111111');

            doc.fillColor('#ffffff')
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('X P E R I M E N T A L', 16, 14, { lineBreak: false });

            doc.fillColor('#ffffff')
               .fontSize(9)
               .font('Helvetica')
               .text('3/27/26', PW - 80, 12, { width: 68, align: 'right', lineBreak: false });
            doc.fillColor('#ffffff')
               .fontSize(13)
               .font('Helvetica-Bold')
               .text('10:00 PM', PW - 80, 24, { width: 68, align: 'right', lineBreak: false });

            // ── Date line under header ───────────────────────────────────────
            doc.fillColor('#cccccc')
               .fontSize(8.5)
               .font('Helvetica')
               .text('27/03/2026  356 Av Mont-Royal E  22:00-03:00', 16, headerH + 4, { width: PW - 32 });

            // ── Poster image ─────────────────────────────────────────────────
            const posterY = headerH + 22;
            const posterH = 340;
            if (hasPoster) {
                doc.image(posterPath, 0, posterY, { width: PW, height: posterH });
            } else {
                doc.rect(0, posterY, PW, posterH).fill('#1a1a2e');
                doc.fillColor('#555').fontSize(18).font('Helvetica-Bold')
                   .text('XPERIMENTAL', 0, posterY + posterH / 2 - 10, { width: PW, align: 'center' });
            }

            // ── Info section (ÉVÈNEMENT / NOM) ───────────────────────────────
            const infoY = posterY + posterH;
            const infoH = 72;
            doc.rect(0, infoY, PW, infoH).fill('#1a1a1a');

            const col1X = 20, col2X = PW / 2 + 10;

            // Column labels
            doc.fillColor('#888888').fontSize(8).font('Helvetica')
               .text('ÉVÈNEMENT', col1X, infoY + 10)
               .text('NAME / NOM', col2X, infoY + 10);

            // Column values — show individual name per ticket, not combined tier
            doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
               .text(tier, col1X, infoY + 28, { width: PW / 2 - 30, lineBreak: false });
            doc.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold')
               .text(name || '-', col2X, infoY + 28, { width: PW / 2 - 20, lineBreak: false });

            // ── QR Code section ──────────────────────────────────────────────
            const qrSectionY = infoY + infoH;
            const qrSectionH = PH - qrSectionY;
            doc.rect(0, qrSectionY, PW, qrSectionH).fill('#111111');

            const qrSize = 200;
            const qrX = (PW - qrSize) / 2;
            const qrY = qrSectionY + 26;

            // White background behind QR
            doc.rect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16).fill('#ffffff');
            doc.image(qrBuffers[i], qrX, qrY, { width: qrSize, height: qrSize });

            // Ticket short ID below QR
            doc.fillColor('#666666').fontSize(9).font('Helvetica')
               .text(shortId, 0, qrY + qrSize + 16, { width: PW, align: 'center' });
        });

        doc.end();
        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
    });
}

module.exports = generateTicket;