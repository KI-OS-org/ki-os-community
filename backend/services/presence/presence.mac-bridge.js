/**
 * KI-OS Community Edition — Strategic Component
 * Autor: Ingo Schaffer — https://ki-os.org
 * Lizenz: GNU Affero General Public License v3.0 (AGPL-3.0)
 * SPDX-License-Identifier: AGPL-3.0-only
 */
// (c) 2026 KI-OS.org by Ingo Schaffer und Kimba — AGPL-3.0-only
'use strict';

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const sanitize = (str) => String(str || '').trim().replace(/"/g, '').replace(/'/g, '').slice(0, 100);

const getActiveApp = async () => {
  try {
    const { stdout: rawName } = await execPromise('osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\'', { timeout: 3000 });
    const appName = rawName.trim();
    const safeName = sanitize(appName);
    const { stdout: bundleId } = await execPromise(`osascript -e 'id of app "${safeName}"'`, { timeout: 3000 });
    return { appName, bundleId: bundleId.trim() || null, timestamp: new Date().toISOString() };
  } catch (error) {
    return { appName: null, bundleId: null, timestamp: new Date().toISOString() };
  }
};

const getMeetingState = async () => {
  const meetingApps = ['Microsoft Teams', 'zoom.us', 'Google Meet', 'Webex', 'FaceTime'];
  try {
    const { stdout: activeApp } = await execPromise('osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\'', { timeout: 3000 });
    const { stdout: runningApps } = await execPromise('osascript -e \'tell application "System Events" to get name of every process\'', { timeout: 3000 });

    const activeAppName = activeApp.trim();
    const runningAppNames = runningApps.split('\n').map(app => app.trim());

    if (meetingApps.includes(activeAppName)) {
      const { stdout: windowTitle } = await execPromise(`osascript -e 'tell application "System Events" to get name of front window of application "${activeAppName}"'`, { timeout: 3000 });
      return { inMeeting: true, appName: activeAppName, windowTitle: windowTitle.trim() || null };
    }

    return { inMeeting: false, appName: null, windowTitle: null };
  } catch (error) {
    return { inMeeting: false, appName: null, windowTitle: null };
  }
};

const getActiveSpeaker = async () => {
  const meetingState = await getMeetingState();
  if (!meetingState.inMeeting) {
    return { speakerName: null, confidence: 0 };
  }

  try {
    const { stdout: speakerName } = await execPromise(`osascript -e 'tell application "System Events" to get name of first UI element of application "${meetingState.appName}" whose role is "AXTextField"'`, { timeout: 3000 });
    return { speakerName: speakerName.trim() || null, confidence: 1 };
  } catch (error) {
    return { speakerName: null, confidence: 0 };
  }
};

const getCalendarEvents = async (lookaheadMinutes = 120) => {
  try {
    const { stdout: events } = await execPromise(`osascript -e 'tell application "Calendar" to get name of every event whose start date is greater than (current date) and start date is less than (current date + ${lookaheadMinutes} * minutes)'`, { timeout: 3000 });
    const eventList = events.split('\n').map(event => event.trim()).filter(event => event);

    const formattedEvents = await Promise.all(eventList.map(async (event) => {
      const safeEvent = sanitize(event);
      const { stdout: startDate } = await execPromise(`osascript -e 'tell application "Calendar" to get start date of event "${safeEvent}"'`, { timeout: 3000 });
      const { stdout: endDate } = await execPromise(`osascript -e 'tell application "Calendar" to get end date of event "${safeEvent}"'`, { timeout: 3000 });
      const isOnline = ['Teams', 'Zoom', 'Meet', 'Webex'].some(platform => event.includes(platform));
      return { title: event, startDate: startDate.trim(), endDate: endDate.trim(), isOnline };
    }));

    return formattedEvents;
  } catch (error) {
    return [];
  }
};

const getFocusMode = async () => {
  try {
    const { stdout: focusMode } = await execPromise('defaults read com.apple.universalaccess "com.apple.universalaccess"', { timeout: 3000 });
    const focusModeData = JSON.parse(focusMode);
    return { enabled: focusModeData.focusModeEnabled, mode: focusModeData.focusMode || null };
  } catch (error) {
    return { enabled: false, mode: null };
  }
};

module.exports = { getActiveApp, getMeetingState, getActiveSpeaker, getCalendarEvents, getFocusMode };
