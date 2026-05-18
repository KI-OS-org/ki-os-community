# KI-OS — LanceDB Vector Memory

LanceDB ist ein eingebetteter Vektordatenbank-Treiber für KI-OS. Er ermöglicht semantische Suche über den gesamten Gesprächsspeicher — kein externer Datenbankserver nötig.

---

## Was LanceDB bietet

| Feature | Detail |
|---------|--------|
| **HNSW Vector Search** | Millisecond-schnelle Ähnlichkeitssuche über alle gespeicherten Fakten |
| **Embedded** | Läuft direkt in Node.js — kein separater Server |
| **Semantic Memory** | Findet verwandte Kontexte ohne exaktes Keyword-Match |
| **Optional** | KI-OS läuft ohne LanceDB — File-Backend ist der Standard |

---

## Installation

LanceDB ist eine optionale Dependency — sie wird **nicht** mit `npm install` mitgeliefert:

```bash
npm install @lancedb/lancedb
```

> **Hinweis:** `@lancedb/lancedb` enthält native Binaries (Rust). Beim ersten Install werden diese kompiliert oder als Prebuilt heruntergeladen. Node.js 20+ erforderlich.

---

## Konfiguration

In `.env`:

```env
MEMORY_DRIVER=lancedb

# Optional: Embedding-Modell für semantische Suche
# Ohne EMBEDDING_PROVIDER: LanceDB speichert Texte ohne Embeddings (keine Ähnlichkeitssuche)
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

Unterstützte `EMBEDDING_PROVIDER`-Werte:

| Wert | Modell | Kosten |
|------|--------|--------|
| `openai` | `text-embedding-3-small` | Niedrig |
| `anthropic` | Voyage AI (via Anthropic) | Niedrig |
| *(leer)* | Kein Embedding — nur Textspeicher | Kostenlos |

---

## Verzeichnis

LanceDB legt seine Datenbankdatei standardmäßig hier ab:

```
.ki-os-lancedb/        ← Vektordatenbank (automatisch erstellt)
```

Pfad anpassbar über:

```env
LANCEDB_PATH=./data/lancedb
```

Diese Dateien sollten **nicht** in Git eingecheckt werden (sind in `.gitignore` enthalten).

---

## Vergleich: Memory-Treiber

| Treiber | Standard | Semantisch | Persistent | Setup |
|---------|:--------:|:----------:|:----------:|-------|
| `file` | ✅ | ❌ | ✅ | Keine |
| `sqlite` | ❌ | ❌ | ✅ | Keine |
| `lancedb` | ❌ | ✅ | ✅ | `npm install @lancedb/lancedb` |
| `dynamodb` | ❌ | ❌ | ✅ | AWS-Credentials (Enterprise) |

---

## Status

| Version | Status |
|---------|--------|
| v1.1.0 | File / SQLite / InMemory stabil |
| v1.2.0 | LanceDB-Treiber geplant (Q3 2026) |

Der LanceDB-Backend-Driver ist für **v1.2.0** geplant. Die `npm install @lancedb/lancedb`-Anleitung im README beschreibt den Zielzustand — wer den Treiber vorab einbauen möchte, findet die Adapter-Schnittstelle in `backend/memory/adapters/base.adapter.js`.

---

## Selbst implementieren (für Beitragende)

Ein LanceDB-Adapter muss `base.adapter.js` implementieren:

```javascript
// backend/memory/adapters/lancedb.adapter.js
const { BaseAdapter } = require('./base.adapter');

class LanceDbAdapter extends BaseAdapter {
  async get(key)         { /* ... */ }
  async set(key, value)  { /* ... */ }
  async delete(key)      { /* ... */ }
  async search(query, k) { /* semantische Suche */ }
}
module.exports = LanceDbAdapter;
```

Dann in `backend/memory/index.js` registrieren:

```javascript
if (driver === 'lancedb') {
  const LanceDbAdapter = require('./adapters/lancedb.adapter');
  return new LanceDbAdapter();
}
```

Pull Requests willkommen: [github.com/KI-OS-org/ki-os](https://github.com/KI-OS-org/ki-os)

---

*KI-OS Community Edition — AGPL-3.0 — [ki-os.org](https://ki-os.org)*
