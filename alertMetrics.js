'use strict';
/**
 * RD-15 RD-17 RD-19: Alert Metrics and Observability
 * Tracks alerting pipeline metrics for dashboards.
 * Relates to: RD-15, RD-17, RD-19
 */
const metrics = {
  alertsReceived: 0, alertsThrottled: 0, alertsAggregated: 0,
  alertsDelivered: 0, alertsFailed: 0, dlqSize: 0,
  avgDeliveryMs: 0, p99DeliveryMs: 0, deliveryTimes: [],
};
const MAX_SAMPLES = 1000;
function recordReceived() { metrics.alertsReceived++; }
function recordThrottled() { metrics.alertsThrottled++; }
function recordAggregated() { metrics.alertsAggregated++; }
function recordDelivered(ms) {
  metrics.alertsDelivered++;
  metrics.deliveryTimes.push(ms);
  if (metrics.deliveryTimes.length > MAX_SAMPLES) metrics.deliveryTimes.shift();
  const s = [...metrics.deliveryTimes].sort((a,b)=>a-b);
  metrics.avgDeliveryMs = s.reduce((a,v)=>a+v,0)/s.length;
  metrics.p99DeliveryMs = s[Math.floor(s.length*0.99)]||0;
}
function recordFailed() { metrics.alertsFailed++; }
function setDlqSize(n) { metrics.dlqSize = n; }
function getMetrics() {
  return { ...metrics, deliverySuccessRate: metrics.alertsDelivered/Math.max(metrics.alertsReceived,1),
    throttleRate: metrics.alertsThrottled/Math.max(metrics.alertsReceived,1), timestamp: new Date().toISOString() };
}
module.exports = { recordReceived, recordThrottled, recordAggregated, recordDelivered, recordFailed, setDlqSize, getMetrics };
