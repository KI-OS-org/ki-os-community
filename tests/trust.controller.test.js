/**
 * Trust Controller Tests
 * 
 * Tests für den Trust Center Controller (HTTP-Handler).
 * Native Node.js Tests mit Mocks
 * 
 * @module tests/trust.controller.test
 */

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');

// Mock den trustService BEFORE import
const mockService = {
  getPendingApprovals: async () => [],
  getApprovalStats: async () => ({ total: 0, pending: 0, approved: 0, rejected: 0 }),
  approveApproval: async () => ({}),
  rejectApproval: async () => ({}),
};

// Module mocken durch Ersetzen von require.cache
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(...args) {
  const moduleName = args[0];
  if (moduleName.includes('trust.service')) {
    return mockService;
  }
  return originalRequire.apply(this, args);
};

const trustController = require('../backend/controllers/trust.controller');

// Mock wieder herstellen
Module.prototype.require = originalRequire;

describe('Trust Controller', () => {
  
  beforeEach(() => {
    // Mocks zurücksetzen
    mockService.getPendingApprovals = async () => [];
    mockService.getApprovalStats = async () => ({ total: 0, pending: 0, approved: 0, rejected: 0 });
    mockService.approveApproval = async () => ({});
    mockService.rejectApproval = async () => ({});
  });

  describe('getPendingApprovals', () => {
    it('sollte pending Approvals zurückgeben', async () => {
      const mockApprovals = [
        { id: '1', status: 'pending', title: 'Test 1' },
        { id: '2', status: 'pending', title: 'Test 2' },
      ];
      const mockStats = { total: 10, pending: 2, approved: 5, rejected: 3 };
      
      mockService.getPendingApprovals = async () => mockApprovals;
      mockService.getApprovalStats = async () => mockStats;
      
      const req = {
        user: { id: 'user123', role: 'admin' },
        headers: {},
      };
      
      let capturedResponse = null;
      const res = {
        json: (data) => { capturedResponse = data; },
        status: function(code) { this.statusCode = code; return this; },
      };
      
      await trustController.getPendingApprovals(req, res);
      
      assert(capturedResponse);
      assert.strictEqual(capturedResponse.success, true);
      assert.deepStrictEqual(capturedResponse.items, mockApprovals);
      assert.deepStrictEqual(capturedResponse.stats, mockStats);
      assert(capturedResponse.meta);
      assert.strictEqual(capturedResponse.meta.requestedBy, 'user123');
    });

    it('sollte 403 zurückgeben bei unzureichenden Rechten', async () => {
      const req = {
        user: { id: 'user123', role: 'guest' },
        headers: {},
      };
      
      let capturedResponse = null;
      const res = {
        json: (data) => { capturedResponse = data; },
        status: function(code) { this.statusCode = code; return this; },
      };
      
      await trustController.getPendingApprovals(req, res);
      
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(capturedResponse.success, false);
      assert.strictEqual(capturedResponse.error, 'Insufficient permissions');
    });
  });

  describe('approveApproval', () => {
    it('sollte Approval genehmigen', async () => {
      const mockApproval = {
        id: 'test-1',
        status: 'approved',
        approvedBy: 'user123',
      };
      
      mockService.approveApproval = async () => mockApproval;
      
      const req = {
        params: { id: 'test-1' },
        body: { reason: 'Test reason' },
        user: { id: 'user123', role: 'admin' },
        headers: {},
      };
      
      let capturedResponse = null;
      const res = {
        json: (data) => { capturedResponse = data; },
        status: function(code) { this.statusCode = code; return this; },
      };
      
      await trustController.approveApproval(req, res);
      
      assert(capturedResponse);
      assert.strictEqual(capturedResponse.success, true);
      assert.strictEqual(capturedResponse.message, 'Approval approved successfully');
      assert.deepStrictEqual(capturedResponse.approval, mockApproval);
    });

    it('sollte 403 zurückgeben bei unzureichenden Rechten', async () => {
      const req = {
        params: { id: 'test-1' },
        body: { reason: 'Test' },
        user: { id: 'user123', role: 'guest' },
        headers: {},
      };
      
      let capturedResponse = null;
      const res = {
        json: (data) => { capturedResponse = data; },
        status: function(code) { this.statusCode = code; return this; },
      };
      
      await trustController.approveApproval(req, res);
      
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(capturedResponse.success, false);
    });

    it('sollte 400 zurückgeben wenn ID fehlt', async () => {
      const req = {
        params: {},
        body: {},
        user: { id: 'user123', role: 'admin' },
        headers: {},
      };
      
      let capturedResponse = null;
      const res = {
        json: (data) => { capturedResponse = data; },
        status: function(code) { this.statusCode = code; return this; },
      };
      
      await trustController.approveApproval(req, res);
      
      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(capturedResponse.success, false);
    });
  });

  describe('rejectApproval', () => {
    it('sollte Approval ablehnen', async () => {
      const mockApproval = {
        id: 'test-1',
        status: 'rejected',
        rejectedBy: 'user123',
      };
      
      mockService.rejectApproval = async () => mockApproval;
      
      const req = {
        params: { id: 'test-1' },
        body: { reason: 'Test reason' },
        user: { id: 'user123', role: 'admin' },
        headers: {},
      };
      
      let capturedResponse = null;
      const res = {
        json: (data) => { capturedResponse = data; },
        status: function(code) { this.statusCode = code; return this; },
      };
      
      await trustController.rejectApproval(req, res);
      
      assert(capturedResponse);
      assert.strictEqual(capturedResponse.success, true);
      assert.strictEqual(capturedResponse.message, 'Approval rejected successfully');
    });
  });

  describe('getApprovalStats', () => {
    it('sollte Statistik zurückgeben', async () => {
      const mockStats = { total: 10, pending: 2, approved: 5, rejected: 3 };
      mockService.getApprovalStats = async () => mockStats;
      
      const req = {};
      
      let capturedResponse = null;
      const res = {
        json: (data) => { capturedResponse = data; },
        status: function(code) { this.statusCode = code; return this; },
      };
      
      await trustController.getApprovalStats(req, res);
      
      assert(capturedResponse);
      assert.strictEqual(capturedResponse.success, true);
      assert.deepStrictEqual(capturedResponse.stats, mockStats);
    });
  });
});
