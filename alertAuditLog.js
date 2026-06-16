'use strict';
/**
 * RD-15 RD-17 RD-19: Alert Audit Log
 * Immutable append-only structured audit log for alert lifecycle events.
 * Relates to: RD-15, RD-17, RD-19
 */
const { v4: uuidv4 } = require('uuid');
const auditLog = [];
const MAX_ENTRIES = 10000;

const EVENT_TYPES = Object.freeze({
  RECEIVED: 'alert.received',
  THROTTLED: 'alert.throttled',
  DEDUPLICATED: 'alert.deduplicated',
  ROUTED: 'alert.routed',
  DELIVERED: 'alert.delivered',
  FAILED: 'alert.failed',
  DLQ_ENQUEUED: 'alert.dlq.enqueued',
  DLQ_RETRIED: 'alert.dlq.retried',
  RESOLVED: 'alert.resolved',
  ESCALATED: 'alert.escalated',
});

function log(eventType, alertId, data = {}) {
  if (!Object.values(EVENT_TYPES).includes(eventType)) {
    throw new Error(`Unknown event type: ${eventType}`);
  }
  const entry = Object.freeze({
    id: uuidv4(),
    eventType,
    alertId,
    timestamp: new Date().toISOString(),
    ...data,
  });
  if (auditLog.length >= MAX_ENTRIES) auditLog.shift();
  auditLog.push(entry);
  return entry;
}

function queryByAlertId(alertId) {
  return auditLog.filter(e => e.alertId === alertId);
}

function queryByEventType(eventType) {
  return auditLog.filter(e => e.eventType === eventType);
}

function queryByServiceId(serviceId) {
  return auditLog.filter(e => e.serviceId === serviceId);
}

function getRecent(n = 100) {
  return auditLog.slice(-n);
}

module.exports = { log, queryByAlertId, queryByEventType, queryByServiceId, getRecent, EVENT_TYPES };
