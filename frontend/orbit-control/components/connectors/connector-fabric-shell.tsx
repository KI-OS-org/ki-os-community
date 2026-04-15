/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectorRegistry, connectorCapabilityResolver, connectorTrustLevels, mcpManifestPreview, fileFabricSummary } from "../../lib/adapters/connector-fabric";

export async function ConnectorFabricShell() {
  const [connectorsRaw, capabilitiesRaw, trustRaw, manifest, fileFabric] = await Promise.all([
    connectorRegistry(),
    connectorCapabilityResolver(),
    connectorTrustLevels(),
    mcpManifestPreview(),
    fileFabricSummary(),
  ]);

  const connectors  = (Array.isArray(connectorsRaw)  ? connectorsRaw  : []) as any[];
  const capabilities = (Array.isArray(capabilitiesRaw) ? capabilitiesRaw : []) as any[];
  const trustData   = trustRaw as any;
  const trustItems  = Array.isArray(trustData?.items) ? trustData.items as any[] : [];

  return (
    <main>
      <h1>Connector Fabric & MCP</h1>
      <section>
        <h2>Connector Registry</h2>
        <ul>{connectors.map((c) => <li key={c.id}>{c.name} · {c.category} · {c.status}</li>)}</ul>
      </section>
      <section>
        <h2>Capabilities</h2>
        <ul>{capabilities.map((c) => <li key={c.connectorId}>{c.connectorId}: {Array.isArray(c.capabilities) ? c.capabilities.join(", ") : ""}</li>)}</ul>
      </section>
      <section>
        <h2>Trust Levels</h2>
        <ul>{trustItems.map((t: any) => <li key={t.connectorId}>{t.connectorId}: {t.level}</li>)}</ul>
      </section>
      <section>
        <h2>MCP Manifest</h2>
        <pre>{JSON.stringify(manifest, null, 2)}</pre>
      </section>
      <section>
        <h2>File Fabric</h2>
        <pre>{JSON.stringify(fileFabric, null, 2)}</pre>
      </section>
    </main>
  );
}
