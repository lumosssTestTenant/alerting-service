'use strict';
/**
 * RD-19: Alert Deduplication
 * Suppresses duplicate alerts within a configurable time window.
 * Relates to: RD-19
 */
const crypto = require('crypto');
const seen = new Map(); // fingerprint -> { firstSeen, count }
const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function fingerprint(alert) {
  const key = JSON.stringify({
    serviceId: alert.serviceId,
    errorCode: alert.errorCode,
    severity: alert.severity,
    category: alert.category,
  });
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

function isDuplicate(alert) {
  const fp = fingerprint(alert);
  const now = Date.now();
  const entry = seen.get(fp);
  if (entry && now - entry.firstSeen < DEDUP_WINDOW_MS) {
    entry.count++;
    seen.set(fp, entry);
    return { duplicate: true, count: entry.count, firstSeen: new Date(entry.firstSeen).toISOString() };
  }
  seen.set(fp, { firstSeen: now, count: 1 });
  return { duplicate: false, count: 1 };
}

function clearExpired() {
  const now = Date.now();
  let cleared = 0;
  for (const [fp, entry] of seen.entries()) {
    if (now - entry.firstSeen >= DEDUP_WINDOW_MS) { seen.delete(fp); cleared++; }
  }
  return cleared;
}

function getStats() { return { trackedAlerts: seen.size }; }

module.exports = { isDuplicate, fingerprint, clearExpired, getStats };
