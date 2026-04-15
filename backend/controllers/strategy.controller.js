/**
 * Capability Map Controller
 * 
 * HTTP-Handler für Capability Map API.
 * 
 * @module controllers/strategy.controller
 */

const capabilityMapService = require('../services/strategy/capability-map.service');

/**
 * GET /api/strategy/capability-map
 * 
 * Holt die vollständige Capability Map mit Gap-Analyse.
 */
async function getCapabilityMap(req, res) {
  try {
    const map = capabilityMapService.getCapabilityMap();
    
    res.json({
      success: true,
      data: map,
      meta: {
        requestedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[StrategyController.getCapabilityMap] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * GET /api/strategy/capability-map/investments
 * 
 * Holt Investment-Empfehlungen basierend auf Gap-Analyse.
 */
async function getInvestmentRecommendations(req, res) {
  try {
    const recommendations = capabilityMapService.getInvestmentRecommendations();
    
    res.json({
      success: true,
      data: recommendations,
      meta: {
        requestedAt: new Date().toISOString(),
        count: recommendations.length,
      },
    });
  } catch (error) {
    console.error('[StrategyController.getInvestmentRecommendations] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * GET /api/strategy/capability-map/categories
 * 
 * Holt Capability-Kategorien mit Counts.
 */
async function getCapabilityCategories(req, res) {
  try {
    const map = capabilityMapService.getCapabilityMap();
    
    res.json({
      success: true,
      data: {
        categories: Object.keys(map.stats.byCategory).map(category => ({
          name: category,
          count: map.stats.byCategory[category],
          capabilities: map.byCategory[category] || [],
        })),
        stats: map.stats,
      },
      meta: {
        requestedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[StrategyController.getCapabilityCategories] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

/**
 * GET /api/strategy/capability-map/gaps
 * 
 * Holt Gap-Analyse.
 */
async function getGaps(req, res) {
  try {
    const map = capabilityMapService.getCapabilityMap();
    
    res.json({
      success: true,
      data: {
        gaps: map.gaps,
        stats: {
          total: map.gaps.length,
          high: map.gaps.filter(g => g.severity === 'high').length,
          medium: map.gaps.filter(g => g.severity === 'medium').length,
          low: map.gaps.filter(g => g.severity === 'low').length,
        },
      },
      meta: {
        requestedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[StrategyController.getGaps] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message,
    });
  }
}

module.exports = {
  getCapabilityMap,
  getInvestmentRecommendations,
  getCapabilityCategories,
  getGaps,
};
