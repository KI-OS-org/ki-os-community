/**
 * KI-OS Community Edition — Enterprise Feature Stub
 * Gibt 403 zurück wenn ein Enterprise-Endpunkt aufgerufen wird.
 */
'use strict';
function enterpriseOnly(featureName) {
  return {
    handleRequest: () => ({
      statusCode: 403,
      body: {
        error: 'enterprise_only',
        feature: featureName,
        message: `"${featureName}" ist nur in der KI-OS Enterprise Edition verfügbar. Kontakt: enterprise@ki-os.org`,
      },
    }),
  };
}
module.exports = { enterpriseOnly };
