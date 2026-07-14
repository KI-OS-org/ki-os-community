/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
'use strict';
/* KI-OS Community Edition — Autor: Ingo Schaffer — AGPL-3.0-only */
const express = require('express');
const router = express.Router();
router.use((req, res) => res.status(403).json({ error: 'enterprise_only', feature: 'ghost', message: 'Ghost Control ist nur in der KI-OS Enterprise Edition verfügbar. Kontakt: enterprise@ki-os.org' }));
module.exports = router;
