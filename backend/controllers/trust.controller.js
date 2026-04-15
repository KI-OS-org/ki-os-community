/**
 * Trust Center Controller
 * 
 * HTTP-Handler für Trust Center API-Endpoints.
 * Verarbeitet Requests für Approvals (Genehmigen/Ablehnen).
 * 
 * @module controllers/trust.controller
 */

const trustService = require('../services/trust/trust.service');

/**
 * GET /api/trust/approvals
 * 
 * Holt alle pending Approvals für das Trust Center.
 * 
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 */
async function getPendingApprovals(req, res) {
  try {
    const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
    
    // Role check - nur admin/operator können Approvals sehen
    const userRole = req.user?.role || req.headers['x-user-role'] || 'viewer';
    if (!['admin', 'operator', 'viewer'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'You need at least viewer role to see approvals',
      });
    }
    
    const approvals = await trustService.getPendingApprovals();
    const stats = await trustService.getApprovalStats();
    
    res.json({
      success: true,
      items: approvals,
      stats,
      meta: {
        requestedAt: new Date().toISOString(),
        requestedBy: userId,
      },
    });
  } catch (error) {
    console.error('[TrustController.getPendingApprovals] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * POST /api/trust/approve/:id
 * 
 * Genehmigt ein Approval.
 * 
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 */
async function approveApproval(req, res) {
  try {
    const { id: approvalId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
    
    // Role check - nur admin/operator können genehmigen
    const userRole = req.user?.role || req.headers['x-user-role'] || 'viewer';
    if (!['admin', 'operator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'You need admin or operator role to approve items',
      });
    }
    
    if (!approvalId) {
      return res.status(400).json({
        success: false,
        error: 'Missing approval ID',
        message: 'Approval ID is required',
      });
    }
    
    const approval = await trustService.approveApproval(approvalId, userId, reason);
    
    res.json({
      success: true,
      message: 'Approval approved successfully',
      approval,
      meta: {
        approvedAt: approval.approvedAt,
        approvedBy: userId,
      },
    });
  } catch (error) {
    console.error('[TrustController.approveApproval] Error:', error);
    
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: 'Approval not found',
        message: error.message,
      });
    }
    
    if (error.code === 'ALREADY_PROCESSED') {
      return res.status(409).json({
        success: false,
        error: 'Approval already processed',
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * POST /api/trust/reject/:id
 * 
 * Lehnt ein Approval ab.
 * 
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 */
async function rejectApproval(req, res) {
  try {
    const { id: approvalId } = req.params;
    const { reason } = req.body;
    const userId = req.user?.id || req.headers['x-user-id'] || 'anonymous';
    
    // Role check - nur admin/operator können ablehnen
    const userRole = req.user?.role || req.headers['x-user-role'] || 'viewer';
    if (!['admin', 'operator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        message: 'You need admin or operator role to reject items',
      });
    }
    
    if (!approvalId) {
      return res.status(400).json({
        success: false,
        error: 'Missing approval ID',
        message: 'Approval ID is required',
      });
    }
    
    const approval = await trustService.rejectApproval(approvalId, userId, reason);
    
    res.json({
      success: true,
      message: 'Approval rejected successfully',
      approval,
      meta: {
        rejectedAt: approval.rejectedAt,
        rejectedBy: userId,
      },
    });
  } catch (error) {
    console.error('[TrustController.rejectApproval] Error:', error);
    
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: 'Approval not found',
        message: error.message,
      });
    }
    
    if (error.code === 'ALREADY_PROCESSED') {
      return res.status(409).json({
        success: false,
        error: 'Approval already processed',
        message: error.message,
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * GET /api/trust/approvals/stats
 * 
 * Holt Statistik über Approvals.
 * 
 * @param {Object} req - Express Request
 * @param {Object} res - Express Response
 */
async function getApprovalStats(req, res) {
  try {
    const stats = await trustService.getApprovalStats();
    
    res.json({
      success: true,
      stats,
      meta: {
        requestedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[TrustController.getApprovalStats] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

module.exports = {
  getPendingApprovals,
  approveApproval,
  rejectApproval,
  getApprovalStats,
};
