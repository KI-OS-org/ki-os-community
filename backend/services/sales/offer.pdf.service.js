/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba · AGPL-3.0-only
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OUTPUT_DIR = process.env.OFFER_OUTPUT_DIR || './data/offers/';

class OfferPdfService {
  constructor() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  generateMarkdown(offer) {
    const today = new Date().toISOString().split('T')[0];
    return `# Angebot — ${offer.company || 'Unbekannt'}
**An:** ${offer.contactName || 'Unbekannt'}, ${offer.company || 'Unbekannt'}
**Datum:** ${today}
**Gültig bis:** ${offer.validUntil || '30 Tage'}

## Leistungen
${offer.services || 'Keine Leistungen angegeben'}

## Preis
EUR ${offer.priceEur || '0'} zzgl. MwSt.

## Notizen
${offer.notes || 'Keine weiteren Hinweise'}

---
*KI-OS · ki-os.org*
`;
  }

  async generate(offer) {
    const offerId = offer.id || crypto.randomUUID();
    const markdownPath = path.join(OUTPUT_DIR, `${offerId}.md`);
    const pdfPath = path.join(OUTPUT_DIR, `${offerId}.pdf`);

    // Generate markdown
    const markdownContent = this.generateMarkdown(offer);
    await fs.promises.writeFile(markdownPath, markdownContent);

    // Generate PDF placeholder
    await fs.promises.writeFile(pdfPath, 'PDF_PLACEHOLDER — TODO: pdfkit/puppeteer');

    return {
      markdownPath,
      pdfPath,
      offerId
    };
  }

  async list() {
    const files = await fs.promises.readdir(OUTPUT_DIR);
    const mdFiles = files.filter(file => file.endsWith('.md'));

    return mdFiles.map(file => {
      const offerId = file.replace('.md', '');
      const markdownPath = path.join(OUTPUT_DIR, file);
      const pdfPath = path.join(OUTPUT_DIR, `${offerId}.pdf`);

      return {
        offerId,
        markdownPath,
        pdfPath,
        exists: fs.existsSync(markdownPath) && fs.existsSync(pdfPath)
      };
    });
  }

  getPath(offerId) {
    return {
      markdownPath: path.join(OUTPUT_DIR, `${offerId}.md`),
      pdfPath: path.join(OUTPUT_DIR, `${offerId}.pdf`)
    };
  }
}

module.exports = { OfferPdfService };