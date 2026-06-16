'use strict';
/**
 * RD-17: Alert Aggregation for High-Value Payment Failures
 *
 * Aggregates multiple related payment failure alerts into a single
 * incident alert to reduce noise for on-call engineers.
 *
 * Relates to: RD-17
 */
const buckets = new Map();
const BUCKET_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function aggregate(alert) {
  const key = `${alert.serviceId}:${alert.errorCode}`;
  const now = Date.now();
  const bucket = buckets.get(key) || { alerts: [], firstSeen: now, lastSeen: now };

  if (now - bucket.firstSeen > BUCKET_WINDOW_MS) {
    // Start new bucket
    buckets.set(key, { alerts: [alert], firstSeen: now, lastSeen: now });
    return { aggregated: false, alert };
  }

  bucket.alerts.push(alert);
  bucket.lastSeen = now;
  buckets.set(key, bucket);

  if (bucket.alerts.length === 1) {
    return { aggregated: false, alert };
  }

  // Return aggregated summary
  return {
    aggregated: true,
    count: bucket.alerts.length,
    summary: {
      serviceId: alert.serviceId,
      errorCode: alert.errorCode,
      severity: bucket.alerts.reduce((max, a) => a.severity > max ? a.severity : max, 0),
      firstSeen: new Date(bucket.firstSeen).toISOString(),
      lastSeen: new Date(bucket.lastSeen).toISOString(),
      affectedTransactions: bucket.alerts.map(a => a.transactionId).filter(Boolean),
    }
  };
}

function flushBucket(key) { buckets.delete(key); }
function getBuckets() { return new Map(buckets); }

module.exports = { aggregate, flushBucket, getBuckets };
