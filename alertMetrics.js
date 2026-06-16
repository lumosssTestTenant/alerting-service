'use strict';
/**
 * RD-15 RD-17 RD-19: Alert Metrics & Observability
 *
 * Tracks key alerting system metrics for observability dashboards.
 * Helps detect degradation in the alerting pipeline before it impacts
 * incident response times.
 *
 * Relates to: RD-15, RD-17, RD-19
 */
const metrics = {
  alertsReceived: 0,
  alertsThrottled: 0,
  alertsAggregated: 0,
  alertsDelivered: 0,
  alertsFailed: 0,
  dlqSize: 0,
  avgDeliveryMs: 0,
  p99DeliveryMs: 0,
  deliveryTimes: [],
};

const MAX_DELIVERY_TIMES = 1000;

function recordReceived() { metrics.alertsReceived++; }
function recordThrottled() { metrics.alertsThrottled++; }
function recordAggregated() { metrics.alertsAggregated++; }
function recordDelivered(durationMs) {
  metrics.alertsDelivered++;
  metrics.deliveryTimes.push(durationMs);
  if (metrics.deliveryTimes.length > MAX_DELIVERY_TIMES) metrics.deliveryTimes.shift();
  const sorted = [...metrics.deliveryTimes].sort((a, b) => a - b);
  metrics.avgDeliveryMs = sorted.reduce((s, v) => s + v, 0) / sorted.length;
  metrics.p99DeliveryMs = sorted[Math.floor(sorted.length * 0.99)] || 0;
}
function recordFailed() { metrics.alertsFailed++; }
function setDlqSize(size) { metrics.dlqSize = size; }

function getMetrics() {
  return {
    ...metrics,
    deliverySuccessRate: metrics.alertsDelivered / Math.max(metrics.alertsReceived, 1),
    throttleRate: metrics.alertsThrottled / Math.max(metrics.alertsReceived, 1),
    timestamp: new Date().toISOString(),
  };
}

function resetMetrics() {
  Object.keys(metrics).forEach(k => {
    metrics[k] = Array.isArray(metrics[k]) ? [] : 0;
  });
}

module.exports = {
  recordReceived, recordThrottled, recordAggregated,
  recordDelivered, recordFailed, setDlqSize,
  getMetrics, resetMetrics
};
