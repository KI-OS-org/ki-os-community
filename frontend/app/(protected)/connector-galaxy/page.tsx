"use client";

/**
 * KI-OS · Connector Galaxy — Live-Seite
 *
 * Bettet die bestehende connector-galaxy/index.html als Vollbild-iframe ein.
 * Holt live Connector-Daten vom Backend und schickt sie via postMessage
 * in den iframe, der daraufhin Hub-Farben und Terminal-Log aktualisiert.
 *
 * Status-Farben (im Galaxy sichtbar):
 *   ● Grün  (#22c55e) — ok / connected / active
 *   ● Gelb  (#fbbf24) — pending / syncing / polling (Daten unterwegs)
 *   ● Rot   (#ef4444) — error / disconnected / failed
 */

import { useEffect, useRef, useCallback } from "react";

// ── Typen ────────────────────────────────────────────────────────────────────

interface RawConnector {
  id?:          string;
  name:         string;
  status?:      string;
  category?:    string;
  description?: string;
  dataRate?:    string;
  lastSync?:    string;
  active?:      boolean;
}

interface LiveConnector {
  id?:          string;
  name:         string;
  status:       string;
  description?: string;
  dataRate?:    string;
  lastSync?:    string;
}

// ── Status-Normierung ─────────────────────────────────────────────────────────

function deriveStatus(c: RawConnector): string {
  const raw = (c.status ?? "").toLowerCase();
  if (raw) return raw;
  // Falls kein Status-Feld: active-Flag auswerten
  if (c.active === true)  return "connected";
  if (c.active === false) return "disconnected";
  return "unknown";
}

// ── Hauptseite ────────────────────────────────────────────────────────────────

export default function ConnectorGalaxyPage() {
  const iframeRef  = useRef<HTMLIFrameElement>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // postMessage → iframe
  const sendToGalaxy = useCallback((connectors: LiveConnector[]) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "connector-update", connectors },
      "*"
    );
  }, []);

  // Backend-Daten holen + aufbereiten
  const fetchAndSync = useCallback(async () => {
    try {
      const res = await fetch("/api/connectors/registry", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const raw: RawConnector[] = Array.isArray(json)
        ? json
        : (json.connectors ?? json.data ?? json.items ?? []);

      const connectors: LiveConnector[] = raw.map((c) => ({
        id:          c.id,
        name:        c.name,
        status:      deriveStatus(c),
        description: c.description ?? c.category,
        dataRate:    c.dataRate,
        lastSync:    c.lastSync,
      }));

      sendToGalaxy(connectors);
    } catch {
      // Backend offline — sende leere Liste mit Hinweis
      sendToGalaxy([
        { name: "KI-OS Backend", status: "error", description: "Backend nicht erreichbar" },
      ]);
    }
  }, [sendToGalaxy]);

  // Polling starten sobald iframe geladen
  const onIframeLoad = useCallback(() => {
    // Sofort erste Sync
    fetchAndSync();
    // Danach alle 30s
    timerRef.current = setInterval(fetchAndSync, 30_000);
  }, [fetchAndSync]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // SSE: AgentMesh-Events → Connector-Updates ableiten
  useEffect(() => {
    let es: EventSource | null = null;

    const connect = () => {
      es = new EventSource("/api/agentmesh/events");
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data) as Record<string, string>;
          // output_ready → alle bekannten Connectors kurz als "ok" flashen
          if (data.type === "output_ready") {
            fetchAndSync();
          }
        } catch { /* ignore */ }
      };
      es.onerror = () => { es?.close(); setTimeout(connect, 5000); };
    };

    connect();
    return () => es?.close();
  }, [fetchAndSync]);

  // Layout-Chrome:
  //   äußeres p-6 oben:  1.5rem
  //   OrbitHeader:       ~140px (p-5 + h1 + badges)
  //   space-y-6 Gap:     1.5rem
  //   p-6 unten:         1.5rem
  //   ≈ 14rem total → calc(100vh - 14rem)
  return (
    <div
      style={{
        // OrbitHeader ~140px + outer padding ~24px top + gap ~24px + 24px bottom
        // Negative margins top+bottom heben das space-y und padding des Layouts auf
        marginTop:    "-1.5rem",
        marginBottom: "-1.5rem",
        height:       "calc(100vh - 9rem)",
        background:   "#020510",
        borderRadius: "1.5rem",
        overflow:     "hidden",
      }}
    >
      <iframe
        ref={iframeRef}
        src="/simulations/connector-galaxy/index.html"
        onLoad={onIframeLoad}
        style={{
          width:   "100%",
          height:  "100%",
          border:  "none",
          display: "block",
        }}
        title="Connector Galaxy"
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
