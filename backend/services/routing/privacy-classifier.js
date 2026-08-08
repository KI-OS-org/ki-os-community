/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * KI-OS — (C) 2026 Ingo Schaffer
 * https://ki-os.org
 * @license AGPL-3.0-only
 * @file backend/services/routing/privacy-classifier.js
 * @description Privacy Classifier — erkennt sensible/regulierte Daten im Request
 */
"use strict";

const categories = {
  FINANZDATEN: { weight: 10, keywords: ["kontoauszug", "iban", "bic", "kreditkarte", "transaktion", "kontonummer", "buchung", "überweisung", "depot", "dividende", "aktie", "portfolio", "steuer", "finanzamt", "einkommensteuer", "umsatzsteuer"] },
  PERSONALDATEN: { weight: 9, keywords: ["gehalt", "lohn", "gehaltszettel", "lohnabrechnung", "personalakte", "mitarbeiter", "kündigung", "abmahnung", "sozialversicherung", "rentenversicherung"] },
  GESUNDHEIT: { weight: 10, keywords: ["patient", "diagnose", "krankenakte", "befund", "arzt", "rezept", "medikament", "behandlung", "krankenhaus", "krankenkasse"] },
  RECHTLICH: { weight: 9, keywords: ["mandant", "anwalt", "vertrag", "klage", "urteil", "rechtssache", "streitwert", "notariat", "vollmacht"] },
  VERTRAULICH: { weight: 8, keywords: ["vertraulich", "geheim", "intern", "confidential", "nda", "geheimhaltung", "nur für interne nutzung"] },
  PERSONENBEZOGEN: { weight: 7, keywords: ["geburtstag", "geburtsdatum", "adresse", "personalausweis", "reisepass", "sozialversicherungsnummer", "steueridentifikationsnummer"] }
};

function classify(text) {
  const lowerText = text.toLowerCase();
  const matchedKeywords = [];
  let bestMatch = null;

  for (const categoryName in categories) {
    const category = categories[categoryName];
    for (const keyword of category.keywords) {
      // Simple stemming: check if keyword is a substring of any word in the text
      const wordsInText = lowerText.split(/\s+/);
      for (const word of wordsInText) {
        if (word.includes(keyword)) {
          matchedKeywords.push(keyword);
          if (!bestMatch || category.weight > bestMatch.weight) {
            bestMatch = {
              category: categoryName,
              weight: category.weight,
              keyword: keyword
            };
          }
          break; // Move to next keyword once a match is found for this keyword
        }
      }
    }
  }

  const uniqueMatchedKeywords = [...new Set(matchedKeywords)];
  const numMatches = uniqueMatchedKeywords.length;
  let confidence = 0;
  let sensitive = false;
  let reason = "Keine sensiblen Daten gefunden.";
  let category = null;

  if (numMatches > 0) {
    category = bestMatch.category;
    if (numMatches === 1) {
      confidence = 0.6;
    } else if (numMatches === 2) {
      confidence = 0.8;
    } else {
      confidence = 1.0;
    }

    if (bestMatch.weight >= 9 && numMatches >= 1) {
      sensitive = true;
      reason = `Sensible Daten (${category}) mit Gewicht ${bestMatch.weight} erkannt.`;
    } else if (bestMatch.weight < 9 && numMatches >= 2) {
      sensitive = true;
      reason = `Sensible Daten (${category}) mit Gewicht ${bestMatch.weight} und mehreren Treffern erkannt.`;
    } else {
      reason = `Potenziell sensible Daten (${category}) erkannt, aber Kriterien nicht erfüllt.`;
    }
  }

  return {
    sensitive: sensitive,
    confidence: confidence,
    category: category,
    reason: reason,
    matchedKeywords: uniqueMatchedKeywords
  };
}

module.exports = { classify };
