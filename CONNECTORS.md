# KI-OS — Connector Directory

> [Back to README](README.md) · [Enterprise Connectors](mailto:enterprise@ki-os.org)

KI-OS verbindet sich mit Systemen als Execution-Endpoints — nicht als Integrationen.
Agenten lesen, schreiben, triggern und reagieren auf externe Systeme autonom.

---

## Integration Matrix — Quick Reference

| System Category | Community | Business | Enterprise |
|---|:---:|:---:|:---:|
| Generic HTTP & Webhooks | ✅ | ✅ | ✅ |
| File & Document Processing | ✅ | ✅ | ✅ |
| MCP Protocol Bridge | ✅ | ✅ | ✅ |
| Ghost Control (Browser Automation) | ✅ Basic | ✅ Full | ✅ + Vision |
| Automation Hubs (n8n, Zapier, Make) | ✅ | ✅ | ✅ |
| E-Commerce Systems | 🔒 | ✅ | ✅ |
| Social Media Platforms | 🔒 | ✅ | ✅ |
| Developer & Tech Stack | 🔒 | ✅ | ✅ |
| Marketing & Campaigns | 🔒 | ✅ | ✅ |
| CRM Systems (HubSpot, Salesforce) | 🔒 | ✅ | ✅ |
| Support & Kommunikation | 🔒 | ✅ | ✅ |
| Finance & Controlling (Stripe, PayPal) | 🔒 | ✅ | ✅ |
| ERP Systems (SAP, Dynamics) | 🔒 | 🔒 | ✅ |
| BI-Tools & Analytics | 🔒 | 🔒 | ✅ |
| Cloud Storage & Data Warehouses | 🔒 | 🔒 | ✅ |
| Finance Enterprise (SAP FI, DATEV) | 🔒 | 🔒 | ✅ |

✅ Included · 🔒 Upgrade required · Basic/Full = Feature-Level

---

## Connector Categories

<table>
<tr>
<td width="33%" valign="top">

### ⚙️ Automation Hubs
**Community · Business · Enterprise**

n8n, Zapier, Make, Pipedream, Power Automate

KI-OS als HTTP-Node ansprechen. Trigger-basiert oder on-demand. Jede Automation-Plattform wird zum Executor.

</td>
<td width="33%" valign="top">

### 👥 CRM
**Business · Enterprise**

HubSpot, Salesforce, Pipedrive, Zoho, Dynamics

Kontakte anreichern, Leads bewerten, Follow-ups automatisieren. Agenten schreiben direkt ins CRM.

</td>
<td width="33%" valign="top">

### 🛒 E-Commerce
**Business · Enterprise**

Shopify, WooCommerce, Shopware, Magento, Amazon, eBay

Produktdaten, Preis-Monitoring, Bestands-Alerts, Review-Analyse — vollautomatisch.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 📊 ERP & BI
**Enterprise**

SAP S/4HANA, Business Central, Lexoffice, DATEV

Daten ins KI-OS, intelligente Auswertung raus. Controlling, Reporting, Anomalie-Erkennung.

</td>
<td width="33%" valign="top">

### 📧 Marketing
**Business · Enterprise**

Mailchimp, ActiveCampaign, Brevo, Klaviyo

Kampagnen analysieren, Content generieren, Segmente bewerten. Agent-gesteuerte Personalisierung.

</td>
<td width="33%" valign="top">

### 💬 Support & Kommunikation
**Business · Enterprise**

Zendesk, Freshdesk, Intercom, Slack, WhatsApp

Tickets priorisieren, Antworten vorschlagen, Eskalation erkennen. 24/7 ohne Mehraufwand.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🛠️ Developer & Tech
**Business · Enterprise**

GitHub, GitLab, Jira, PagerDuty, Datadog, Kubernetes

CI/CD-Events, Incident-Triage, PR-Reviews, Alert-Auswertung — Agenten im Dev-Loop.

</td>
<td width="33%" valign="top">

### 📱 Social Media
**Business · Enterprise**

Instagram, LinkedIn, TikTok, YouTube, X/Twitter

Publishing, Engagement-Monitoring, Sentiment-Analyse, automatische Antwort-Drafts.

</td>
<td width="33%" valign="top">

### 💰 Finance & Controlling
**Enterprise**

Stripe, PayPal, SAP FI, DATEV, Lexoffice

Rechnungsverarbeitung, Zahlungsabgleich, Forecast-Analyse, Anomalie-Alerts.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 📄 File & Documents
**Community · Business · Enterprise**

PDF, Excel, CSV, Images, Google Drive, SharePoint, S3

Upload → Analyse → Extraktion → Weiterverarbeitung. Kein manuelles Parsing.

</td>
<td width="33%" valign="top">

### 🌐 MCP Protocol
**Community · Business · Enterprise**

Jedes MCP-kompatible Tool

Offener Standard. KI-OS als MCP-Host oder Client. Maximale Interoperabilität.

</td>
<td width="33%" valign="top">

### 🖥️ Ghost Control
**Community (Basic) · Business · Enterprise**

Jede Web-UI

Browser-Automatisierung ohne Selenium. Goal-based. Vision-verifiziert. Re-planning bei Fehler.

</td>
</tr>
</table>

---

## Use-Case Matrix

| Use Case | Community | Business | Enterprise |
|---|:---:|:---:|:---:|
| **E-Commerce & Retail** | | | |
| Online shop automation | 🔒 | ✅ | ✅ |
| Inventory management | 🔒 | ✅ | ✅ |
| Order processing agents | 🔒 | ✅ | ✅ |
| ERP/SAP integration | 🔒 | 🔒 | ✅ |
| **Marketing & Campaigns** | | | |
| Content pipelines | ✅ | ✅ | ✅ |
| Social media publishing | 🔒 | ✅ | ✅ |
| Ad platform automation | 🔒 | ✅ | ✅ |
| CRM campaign sync | 🔒 | 🔒 | ✅ |
| **Developer & IT Operations** | | | |
| CI/CD pipeline agents | 🔒 | ✅ | ✅ |
| Incident triage automation | 🔒 | ✅ | ✅ |
| Monitoring & alerting | 🔒 | ✅ | ✅ |
| Enterprise ticketing (ServiceNow) | 🔒 | 🔒 | ✅ |
| **Finance & Controlling** | | | |
| Invoice processing | ✅ File | ✅ | ✅ |
| Expense management | 🔒 | ✅ | ✅ |
| ERP financial sync | 🔒 | 🔒 | ✅ |
| **HR & People Ops** | | | |
| Document processing | ✅ | ✅ | ✅ |
| Onboarding workflows | 🔒 | ✅ | ✅ |
| HCM system integration | 🔒 | 🔒 | ✅ |
| **Enterprise Governance** | | | |
| Audit logging | ✅ | ✅ | ✅ |
| EU AI Act compliance | 🔒 | 🔒 | ✅ |
| SSO / SAML / Azure AD | 🔒 | 🔒 | ✅ |
| Multi-tenant isolation | 🔒 | 🔒 | ✅ |

---

## Agent & Memory Matrix

| Capability | Community | Business | Enterprise |
|---|:---:|:---:|:---:|
| Concurrent Agents | 3 | 15 | Unlimited |
| AgentMesh Runs | ✅ | ✅ | ✅ |
| Swarm Memory | ✅ JSON | ✅ LanceDB | ✅ LanceDB + Domain |
| Semantic Memory | ✅ | ✅ | ✅ |
| Domain Memory (Finance/HR/Legal) | 🔒 | 🔒 | ✅ |
| Anti-Pattern Memory | ✅ | ✅ | ✅ |
| Multi-Tenant Memory Isolation | 🔒 | 🔒 | ✅ |

---

## Get Access

| Edition | License Key | How to Start |
|---|:---:|:---:|
| Community | None required | `git clone` + `npm start` |
| Business | `KIOS_BUSINESS_KEY` | [ki-os.org/business](https://ki-os.org/business) |
| Enterprise | `KIOS_ENTERPRISE_KEY` | [enterprise@ki-os.org](mailto:enterprise@ki-os.org) |
