'use strict';
/**
 * RD-15: Alert Throttling & Rate Limiting
 *
 * Prevents alert storms by throttling repeated alerts from the same source
 * within a configurable time window. Without throttling, a single flapping
 * service can generate thousands of alerts per minute.
 *
 * Relates to: RD-15
 */
const alertCounts = new Map(); // key -> { count, windowStart }
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX_ALERTS = 10;

function shouldThrottle(alertKey, maxAlerts = DEFAULT_MAX_ALERTS, windowMs = DEFAULT_WINDOW_MS) {
  const now = Date.now();
  const entry = alertCounts.get(alertKey) || { count: 0, windowStart: now };
  if (now - entry.windowStart > windowMs) {
    alertCounts.set(alertKey, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  alertCounts.set(alertKey, entry);
  return entry.count > maxAlerts;
}

function resetThrottle(alertKey) {
  alertCounts.delete(alertKey);
}

function getThrottleStats(alertKey) {
  return alertCounts.get(alertKey) || { count: 0, windowStart: null };
}

module.exports = { shouldThrottle, resetThrottle, getThrottleStats };
