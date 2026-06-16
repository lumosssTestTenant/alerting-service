'use strict';
/**
 * Alert Correlation & Grouping
 *
 * When multiple alerts fire for related metrics within a short time window,
 * they are grouped into an alert group to reduce noise and provide context.
 *
 * Grouping strategy:
 * - Alerts with the same severity fired within 2 minutes are candidates
 * - Alerts sharing a common metric prefix (e.g. "payment_*") are grouped
 * - Each group has one parent alert and N child alerts
 */

const alertGroups = new Map(); // groupId -> { id, parentAlertId, childAlertIds, severity, createdAt, resolvedAt }
const GROUP_WINDOW_MS = 2 * 60 * 1000; // 2-minute correlation window
const METRIC_PREFIX_GROUPS = {
  payment: ['payment_failure_rate', 'payment_latency_ms', 'payment_success_rate'],
  subscription: ['subscription_churn_rate', 'subscription_renewal_rate'],
  webhook: ['webhook_failure_rate', 'webhook_latency_ms', 'webhook_delivery_rate'],
  fraud: ['fraud_block_rate', 'fraud_detection_rate'],
};

function getMetricGroup(metric) {
  for (const [group, metrics] of Object.entries(METRIC_PREFIX_GROUPS)) {
    if (metrics.includes(metric) || metric.startsWith(group + '_')) return group;
  }
  return null;
}

function correlateAlert(newAlert, allAlerts) {
  const now = Date.now();
  const newGroup = getMetricGroup(newAlert.metric);

  for (const [groupId, group] of alertGroups) {
    if (group.resolvedAt) continue;
    // Check if within correlation window
    if (now - new Date(group.createdAt).getTime() > GROUP_WINDOW_MS) continue;
    // Check severity match
    if (group.severity !== newAlert.severity) continue;
    // Check metric group match
    const parentAlert = allAlerts.get(group.parentAlertId);
    if (!parentAlert) continue;
    const parentGroup = getMetricGroup(parentAlert.metric);
    if (parentGroup && parentGroup === newGroup) {
      group.childAlertIds.push(newAlert.id);
      newAlert.groupId = groupId;
      newAlert.groupRole = 'child';
      return { grouped: true, groupId, role: 'child' };
    }
  }

  // No existing group — create new one
  const { v4: uuidv4 } = require('uuid');
  const groupId = uuidv4();
  alertGroups.set(groupId, {
    id: groupId,
    parentAlertId: newAlert.id,
    childAlertIds: [],
    severity: newAlert.severity,
    metricGroup: newGroup,
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  });
  newAlert.groupId = groupId;
  newAlert.groupRole = 'parent';
  return { grouped: true, groupId, role: 'parent' };
}

function resolveGroup(groupId) {
  const group = alertGroups.get(groupId);
  if (!group) return false;
  group.resolvedAt = new Date().toISOString();
  return true;
}

function listGroups() {
  return Array.from(alertGroups.values());
}

module.exports = { correlateAlert, resolveGroup, listGroups, alertGroups, METRIC_PREFIX_GROUPS };
