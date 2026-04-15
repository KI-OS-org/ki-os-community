/**
 * Trust Service Tests
 * 
 * Tests für den Trust Center Service (Approvals Management).
 * Native Node.js Tests (node --test)
 * 
 * Hinweis: Diese Tests verwenden die echte .ki-os-approvals.json
 * und schreiben/reinigen sie während der Tests.
 * 
 * @module tests/trust.service.test
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const trustService = require('../backend/services/trust/trust.service');

// Pfad zur echten Approvals-Datei
const APPROVALS_FILE = path.join(__dirname, '..', '.ki-os-approvals.json');
const AUDIT_FILE = path.join(__dirname, '..', '.ki-os-audit.ndjson');

// Backup der originalen Datei
let originalContent = null;

describe('Trust Service', () => {
  
  beforeEach(async () => {
    // Backup der originalen Datei erstellen
    try {
      originalContent = await fs.readFile(APPROVALS_FILE, 'utf-8');
    } catch (e) {
      originalContent = null;
    }
    // Leere Datei für Tests
    await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: [] }), 'utf-8');
  });

  afterEach(async () => {
    // Originale Datei wiederherstellen
    if (originalContent !== null) {
      await fs.writeFile(APPROVALS_FILE, originalContent, 'utf-8');
    } else {
      // Aufräumen wenn keine originale Datei da war
      try {
        await fs.unlink(APPROVALS_FILE);
      } catch (e) {
        // Ignorieren
      }
    }
    originalContent = null;
  });

  describe('loadApprovals', () => {
    it('sollte leeres Array zurückgeben wenn Datei nicht existiert', async () => {
      await fs.unlink(APPROVALS_FILE).catch(() => {});
      const approvals = await trustService.loadApprovals();
      assert(Array.isArray(approvals));
      assert.strictEqual(approvals.length, 0);
    });

    it('sollte Approvals aus Datei laden', async () => {
      const testApprovals = [
        { approvalId: '1', status: 'pending', title: 'Test 1' },
        { approvalId: '2', status: 'approved', title: 'Test 2' },
      ];
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: testApprovals }), 'utf-8');
      
      const loaded = await trustService.loadApprovals();
      assert.deepStrictEqual(loaded, testApprovals);
    });

    it('sollte bei korrupter JSON ein leeres Array zurückgeben', async () => {
      await fs.writeFile(APPROVALS_FILE, 'invalid json{', 'utf-8');
      
      const loaded = await trustService.loadApprovals();
      assert(Array.isArray(loaded));
      assert.strictEqual(loaded.length, 0);
    });
  });

  describe('getPendingApprovals', () => {
    it('sollte nur pending Approvals zurückgeben', async () => {
      const testApprovals = [
        { approvalId: '1', status: 'pending', title: 'Pending 1' },
        { approvalId: '2', status: 'approved', title: 'Approved 1' },
        { approvalId: '3', status: 'pending', title: 'Pending 2' },
        { approvalId: '4', status: 'rejected', title: 'Rejected 1' },
      ];
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: testApprovals }), 'utf-8');
      
      const pending = await trustService.getPendingApprovals();
      assert.strictEqual(pending.length, 2);
      assert(pending.every(a => a.status === 'pending'));
    });
  });

  describe('approveApproval', () => {
    it('sollte ein Approval genehmigen', async () => {
      const testApprovals = [
        { approvalId: 'test-1', status: 'pending', title: 'Test Approval', action: 'test_action' },
      ];
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: testApprovals }), 'utf-8');
      
      const result = await trustService.approveApproval('test-1', 'user123', 'Test reason');
      
      assert.strictEqual(result.status, 'approved');
      assert.strictEqual(result.approvedBy, 'user123');
      assert(result.approvedAt);
      assert.strictEqual(result.approvalReason, 'Test reason');
      
      // Überprüfen dass Datei aktualisiert wurde
      const updated = await trustService.loadApprovals();
      assert.strictEqual(updated[0].status, 'approved');
    });

    it('sollte Fehler werfen wenn Approval nicht existiert', async () => {
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: [] }), 'utf-8');
      
      await assert.rejects(
        async () => trustService.approveApproval('nonexistent', 'user123'),
        /not found/
      );
    });

    it('sollte Fehler werfen wenn Approval bereits bearbeitet', async () => {
      const testApprovals = [
        { approvalId: 'test-1', status: 'approved', title: 'Already Done' },
      ];
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: testApprovals }), 'utf-8');
      
      await assert.rejects(
        async () => trustService.approveApproval('test-1', 'user123'),
        /already/
      );
    });
  });

  describe('rejectApproval', () => {
    it('sollte ein Approval ablehnen', async () => {
      const testApprovals = [
        { approvalId: 'test-1', status: 'pending', title: 'Test Approval', action: 'test_action' },
      ];
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: testApprovals }), 'utf-8');
      
      const result = await trustService.rejectApproval('test-1', 'user123', 'Rejection reason');
      
      assert.strictEqual(result.status, 'rejected');
      assert.strictEqual(result.rejectedBy, 'user123');
      assert(result.rejectedAt);
      assert.strictEqual(result.rejectionReason, 'Rejection reason');
    });

    it('sollte Fehler werfen wenn Approval nicht existiert', async () => {
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: [] }), 'utf-8');
      
      await assert.rejects(
        async () => trustService.rejectApproval('nonexistent', 'user123'),
        /not found/
      );
    });
  });

  describe('getApprovalById', () => {
    it('sollte Approval by ID finden', async () => {
      const testApprovals = [
        { approvalId: 'test-1', status: 'pending', title: 'Test 1' },
        { approvalId: 'test-2', status: 'approved', title: 'Test 2' },
      ];
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: testApprovals }), 'utf-8');
      
      const found = await trustService.getApprovalById('test-1');
      assert(found);
      assert.strictEqual(found.approvalId, 'test-1');
    });

    it('sollte null zurückgeben wenn nicht gefunden', async () => {
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: [] }), 'utf-8');
      
      const found = await trustService.getApprovalById('nonexistent');
      assert.strictEqual(found, null);
    });
  });

  describe('getApprovalStats', () => {
    it('sollte korrekte Statistik berechnen', async () => {
      const testApprovals = [
        { approvalId: '1', status: 'pending' },
        { approvalId: '2', status: 'pending' },
        { approvalId: '3', status: 'approved' },
        { approvalId: '4', status: 'rejected' },
        { approvalId: '5', status: 'approved' },
      ];
      await fs.writeFile(APPROVALS_FILE, JSON.stringify({ approvals: testApprovals }), 'utf-8');
      
      const stats = await trustService.getApprovalStats();
      
      assert.strictEqual(stats.total, 5);
      assert.strictEqual(stats.pending, 2);
      assert.strictEqual(stats.approved, 2);
      assert.strictEqual(stats.rejected, 1);
    });
  });
});
