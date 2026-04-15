/**
 * (c) 2026 KI-OS.org (v6.0) by Ingo Schaffer und Kimba
 * Datei: pki.integration.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 */

'use strict';
const { PKICore } = require('./pki/pki.core');
const logger = require('./core/logger.service');
const pkiCore = new PKICore();

class PKIIntegration {
    async extractAuth(event) {
        const headers = event.headers || {};
        
        // Identity comes from Header (Gateway should validate this ideally)
        const userId = headers['x-user-id'] || 'guest';
        const tenantId = headers['x-tenant-id'] || 'default';
        
        // FIX RISK 2: Server-Side Authority
        // Wir glauben den Headern 'x-role' und 'x-plan' NICHT.
        // Wir laden das Profil aus der DB.
        
        let role = userId === 'guest' ? 'guest' : 'user';
        let plan = 'free';

        if (userId !== 'guest') {
            try {
                // Load Real Profile (with auto-create)
                const profile = await pkiCore.getUserProfile(userId, tenantId);
                
                // Authoritative Values from DB
                role = (profile.roles && profile.roles.includes('admin')) ? 'admin' : 'user';
                plan = profile.plan || 'free';
                
            } catch (e) {
                logger.error('pki.auth.lookup.failed', { message: 'PKI Auth Lookup Failed', error: e?.message || String(e) });
                // Fallback to safe defaults
            }
        }

        return {
            authenticated: userId !== 'guest',
            userId,
            tenantId,
            role, // Trusted
            subscription: { plan } // Trusted
        };
    }
}
module.exports = { PKIIntegration };