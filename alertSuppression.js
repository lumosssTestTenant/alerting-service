'use strict';
/**
 * Alert Suppression / Maintenance Windows
 *
 * During scheduled maintenance or known incidents, operators can create
 * suppression windows to prevent alert noise. Any alert fired during
 * a suppression window is automatically suppressed (not notified).
 */

const suppressionWindows = new Map(); // id -> { id, name, startsAt, endsAt, ruleIds, createdBy }

function isAlertSuppressed(alert) {
  const now = new Date();
  for (const [, win] of suppressionWindows) {
    const start = new Date(win.startsAt);
    const end = new Date(win.endsAt);
    if (now < start || now > end) continue;
    // If ruleIds is empty, suppress all; otherwise check specific rules
    if (win.ruleIds.length === 0 || win.ruleIds.includes(alert.ruleId)) {
      return { suppressed: true, windowId: win.id, windowName: win.name };
    }
  }
  return { suppressed: false };
}

function createWindow({ name, startsAt, endsAt, ruleIds = [], createdBy }) {
  if (!name || !startsAt || !endsAt) throw new Error('name, startsAt, endsAt required');
  if (new Date(endsAt) <= new Date(startsAt)) throw new Error('endsAt must be after startsAt');
  const { v4: uuidv4 } = require('uuid');
  const win = { id: uuidv4(), name, startsAt, endsAt, ruleIds, createdBy: createdBy || 'system', createdAt: new Date().toISOString() };
  suppressionWindows.set(win.id, win);
  return win;
}

function deleteWindow(id) {
  return suppressionWindows.delete(id);
}

function listWindows() {
  return Array.from(suppressionWindows.values());
}

function purgeExpiredWindows() {
  const now = new Date();
  let purged = 0;
  for (const [id, win] of suppressionWindows) {
    if (new Date(win.endsAt) < now) { suppressionWindows.delete(id); purged++; }
  }
  return purged;
}

module.exports = { isAlertSuppressed, createWindow, deleteWindow, listWindows, purgeExpiredWindows, suppressionWindows };
