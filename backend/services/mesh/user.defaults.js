/**
 * KI-OS Community Edition — Core Infrastructure
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: Apache License 2.0
 * SPDX-License-Identifier: Apache-2.0
 */
/**
 * (c) 2026 KI-OS.org (v1.6.0) by Ingo Schaffer und Kimba
 * Datei: user.defaults.js
 * Diese Datei enthält JavaScript-Logik für Runtime, Services, Tools oder Tests innerhalb des KI-OS AgentMesh.
 * @license AGPL-3.0-only
 */

'use strict';

function getUserDefaults(context = {}) {
  return {
    quality: context.userDefaults?.quality || process.env.AGENT_AUTO_ASSUME_QUALITY || 'high',
    detail_level: context.userDefaults?.detail_level || 'high',
    deliverable_ready: context.userDefaults?.deliverable_ready !== false,
    autonomy: context.userDefaults?.autonomy || 'guided',
    style_preference: context.userDefaults?.style_preference || 'executive',
    language: context.language || context.userDefaults?.language || 'de'
  };
}

module.exports = { getUserDefaults };
