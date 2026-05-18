/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Trust Center Service
 * 
 * Verwaltet Approvals (Freigaben) im Trust Center.
 * Ermöglicht das Genehmigen und Ablehnen von pending Approvals.
 * 
 * @module services/trust/trust.service
 * (c) 2026 KI-OS.org by Ingo Schaffer und Kimba
 * @license AGPL-3.0-only
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Pfad zur Approvals-Datei
 * @type {string}
 */
const APPROVALS_FILE = path.join(__dirname, '..', '..', '..', '.ki-os-approvals.json');

/**
 * Pfad zur Audit-Log-Datei
 * @type {string}
 */
const AUDIT_LOG_FILE = path.join(__dirname, '..', '..', '..', '.ki-os-audit.ndjson');

/**
 * Lädt alle Approvals aus der JSON-Datei
 * 
 * @returns {Promise<Array<Object>>} Array von Approval-Objekten
 */
async function loadApprovals() {
  try {
    const data = await fs.readFile(APPROVALS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    // Format kann entweder { approvals: [...] } oder direkt [...] sein
    return Array.isArray(parsed) ? parsed : (parsed.approvals || []);
  } catch (error) {
    // Datei existiert nicht oder ist korrupt - leeres Array zurückgeben
    return [];
  }
}

/**
 * Speichert Approvals in die JSON-Datei
 * 
 * @param {Array<Object>} approvals - Array von Approval-Objekten
 * @returns {Promise<void>}
 */
async function saveApprovals(approvals) {
  // Im bestehenden Format speichern: { approvals: [...] }
  await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals }, null, 2), 'utf-8');
}

/**
 * Schreibt einen Eintrag ins Audit-Log (NDJSON Format)
 * 
 * @param {Object} entry - Audit-Log-Eintrag
 * @param {string} entry.timestamp - ISO-8601 Timestamp
 * @param {string} entry.action - Aktion (z.B. "approval_approved")
 * @param {string} entry.userId - User-ID die die Aktion ausgeführt hat
 * @param {string} entry.status - Status (ok, warning, error)
 * @param {string} entry.details - Details zur Aktion
 * @returns {Promise<void>}
 */
async function logAudit(entry) {
  const line = JSON.stringify({
    timestamp: entry.timestamp || new Date().toISOString(),
    action: entry.action,
    userId: entry.userId || 'system',
    status: entry.status || 'info',
    details: entry.details,
    ...entry,
  }) + '\n';
  
  await fs.appendFile(AUDIT_LOG_FILE, line, 'utf-8');
}

/**
 * Holt alle pending Approvals
 * 
 * @returns {Promise<Array<Object>>} Array von pending Approvals
 */
async function getPendingApprovals() {
  const approvals = await loadApprovals();
  return approvals.filter(a => a.status === 'pending');
}

/**
 * Genehmigt ein Approval
 * 
 * @param {string} approvalId - ID des Approvals
 * @param {string} userId - User-ID die genehmigt
 * @param {string} [reason] - Optionaler Grund für die Genehmigung
 * @returns {Promise<Object>} Das aktualisierte Approval
 * @throws {Error} Wenn Approval nicht gefunden oder bereits bearbeitet
 */
async function approveApproval(approvalId, userId, reason) {
  const approvals = await loadApprovals();
  const index = approvals.findIndex(a => a.id === approvalId || a.approvalId === approvalId);
  
  if (index === -1) {
    const error = new Error(`Approval ${approvalId} not found`);
    error.code = 'NOT_FOUND';
    throw error;
  }
  
  const approval = approvals[index];
  
  if (approval.status !== 'pending') {
    const error = new Error(`Approval ${approvalId} is already ${approval.status}`);
    error.code = 'ALREADY_PROCESSED';
    throw error;
  }
  
  // Approval aktualisieren
  approval.status = 'approved';
  approval.approvedBy = userId;
  approval.approvedAt = new Date().toISOString();
  approval.approvalReason = reason || 'Approved via Trust Center';
  
  // Speichern
  await saveApprovals(approvals);
  
  // Audit-Log Eintrag erstellen
  await logAudit({
    action: 'approval_approved',
    userId,
    status: 'ok',
    details: `Approval ${approvalId} approved by ${userId}. Reason: ${approval.approvalReason}`,
    approvalId,
    approvalTitle: approval.title,
    approvalAction: approval.action,
  });
  
  return approval;
}

/**
 * Lehnt ein Approval ab
 * 
 * @param {string} approvalId - ID des Approvals
 * @param {string} userId - User-ID die ablehnt
 * @param {string} [reason] - Optionaler Grund für die Ablehnung
 * @returns {Promise<Object>} Das aktualisierte Approval
 * @throws {Error} Wenn Approval nicht gefunden oder bereits bearbeitet
 */
async function rejectApproval(approvalId, userId, reason) {
  const approvals = await loadApprovals();
  const index = approvals.findIndex(a => a.id === approvalId || a.approvalId === approvalId);
  
  if (index === -1) {
    const error = new Error(`Approval ${approvalId} not found`);
    error.code = 'NOT_FOUND';
    throw error;
  }
  
  const approval = approvals[index];
  
  if (approval.status !== 'pending') {
    const error = new Error(`Approval ${approvalId} is already ${approval.status}`);
    error.code = 'ALREADY_PROCESSED';
    throw error;
  }
  
  // Approval aktualisieren
  approval.status = 'rejected';
  approval.rejectedBy = userId;
  approval.rejectedAt = new Date().toISOString();
  approval.rejectionReason = reason || 'Rejected via Trust Center';
  
  // Speichern
  await saveApprovals(approvals);
  
  // Audit-Log Eintrag erstellen
  await logAudit({
    action: 'approval_rejected',
    userId,
    status: 'warning',
    details: `Approval ${approvalId} rejected by ${userId}. Reason: ${approval.rejectionReason}`,
    approvalId,
    approvalTitle: approval.title,
    approvalAction: approval.action,
  });
  
  return approval;
}

/**
 * Holt ein einzelnes Approval by ID
 * 
 * @param {string} approvalId - ID des Approvals
 * @returns {Promise<Object|null>} Das Approval oder null
 */
async function getApprovalById(approvalId) {
  const approvals = await loadApprovals();
  return approvals.find(a => a.id === approvalId || a.approvalId === approvalId) || null;
}

/**
 * Statistiken für Approvals
 * 
 * @returns {Promise<Object>} Statistik-Objekt
 */
async function getApprovalStats() {
  const approvals = await loadApprovals();
  
  return {
    total: approvals.length,
    pending: approvals.filter(a => a.status === 'pending').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    rejected: approvals.filter(a => a.status === 'rejected').length,
  };
}

module.exports = {
  loadApprovals,
  saveApprovals,
  getPendingApprovals,
  approveApproval,
  rejectApproval,
  getApprovalById,
  getApprovalStats,
  logAudit,
};
