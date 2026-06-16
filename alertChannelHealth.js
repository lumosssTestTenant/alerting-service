'use strict';
/**
 * RD-17: Notification Channel Health Monitor
 * Circuit breaker for unhealthy notification channels.
 * Relates to: RD-17
 */
const channelStats = new Map();
const HEALTH_WINDOW = 20;       // last N deliveries
const FAILURE_THRESHOLD = 0.5;  // disable if >50% failures
const COOLDOWN_MS = 60 * 1000;  // 60s before re-enabling

function recordSuccess(channelId) {
  const s = getStats(channelId);
  s.history.push(1);
  if (s.history.length > HEALTH_WINDOW) s.history.shift();
  s.consecutiveFailures = 0;
  channelStats.set(channelId, s);
}

function recordFailure(channelId) {
  const s = getStats(channelId);
  s.history.push(0);
  if (s.history.length > HEALTH_WINDOW) s.history.shift();
  s.consecutiveFailures++;
  s.lastFailureAt = Date.now();
  if (failureRate(s) > FAILURE_THRESHOLD) {
    s.disabled = true;
    s.disabledAt = Date.now();
  }
  channelStats.set(channelId, s);
}

function isHealthy(channelId) {
  const s = getStats(channelId);
  if (s.disabled) {
    if (Date.now() - s.disabledAt > COOLDOWN_MS) {
      s.disabled = false;
      s.history = [];
      channelStats.set(channelId, s);
      return true;
    }
    return false;
  }
  return failureRate(s) <= FAILURE_THRESHOLD;
}

function failureRate(s) {
  if (!s.history.length) return 0;
  return s.history.filter(v => v === 0).length / s.history.length;
}

function getStats(channelId) {
  return channelStats.get(channelId) || { history: [], consecutiveFailures: 0, disabled: false, disabledAt: null, lastFailureAt: null };
}

module.exports = { recordSuccess, recordFailure, isHealthy, getStats };
