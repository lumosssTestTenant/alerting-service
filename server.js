'use strict';
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const app = express();
const PORT = process.env.PORT || 4000;
const SERVICE_NAME = 'alerting-service';
const SERVICE_VERSION = '1.0.0';

app.use(express.json());

const alerts = new Map();
const alertRules = new Map();
const notificationChannels = new Map();

function log(level, msg, extra = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: SERVICE_NAME, msg, ...extra }));
}

const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const DEFAULT_RULES = [
  { id: 'rule-payment-failure-rate', name: 'High Payment Failure Rate', metric: 'payment_failure_rate', threshold: 0.05, operator: 'gt', severity: 'HIGH', cooldownMs: 300000 },
  { id: 'rule-webhook-delivery-failure', name: 'Webhook Delivery Failure Rate', metric: 'webhook_failure_rate', threshold: 0.1, operator: 'gt', severity: 'CRITICAL', cooldownMs: 60000 },
  { id: 'rule-subscription-churn', name: 'Elevated Subscription Churn', metric: 'subscription_churn_rate', threshold: 0.02, operator: 'gt', severity: 'MEDIUM', cooldownMs: 600000 },
  { id: 'rule-p99-latency', name: 'High P99 Latency', metric: 'p99_latency_ms', threshold: 2000, operator: 'gt', severity: 'HIGH', cooldownMs: 120000 },
  { id: 'rule-fraud-block-rate', name: 'High Fraud Block Rate', metric: 'fraud_block_rate', threshold: 0.03, operator: 'gt', severity: 'MEDIUM', cooldownMs: 300000 },
];
DEFAULT_RULES.forEach(r => alertRules.set(r.id, { ...r, lastFiredAt: null, enabled: true }));

function evaluateRule(rule, metricValue) {
  if (!rule.enabled) return false;
  const now = Date.now();
  if (rule.lastFiredAt && now - rule.lastFiredAt < rule.cooldownMs) return false;
  switch (rule.operator) {
    case 'gt': return metricValue > rule.threshold;
    case 'lt': return metricValue < rule.threshold;
    case 'gte': return metricValue >= rule.threshold;
    case 'lte': return metricValue <= rule.threshold;
    case 'eq': return metricValue === rule.threshold;
    default: return false;
  }
}

function fireAlert(rule, metricValue, metadata = {}) {
  const alert = {
    id: uuidv4(), ruleId: rule.id, ruleName: rule.name, severity: rule.severity,
    metric: rule.metric, value: metricValue, threshold: rule.threshold, operator: rule.operator,
    status: 'OPEN', metadata, firedAt: new Date().toISOString(),
    resolvedAt: null, acknowledgedAt: null, acknowledgedBy: null, notificationsSent: [],
  };
  alerts.set(alert.id, alert);
  rule.lastFiredAt = Date.now();
  deliverNotifications(alert);
  log('warn', `Alert fired: ${rule.name}`, { alertId: alert.id, severity: rule.severity, value: metricValue });
  return alert;
}

function deliverNotifications(alert) {
  for (const [, channel] of notificationChannels) {
    if (!channel.enabled) continue;
    if (channel.minSeverity && SEVERITY_LEVELS.indexOf(alert.severity) < SEVERITY_LEVELS.indexOf(channel.minSeverity)) continue;
    alert.notificationsSent.push({ channelId: channel.id, channelType: channel.type, sentAt: new Date().toISOString(), status: 'SENT' });
    log('info', `Notification sent via ${channel.type}`, { alertId: alert.id, channelId: channel.id });
  }
}

app.get('/health', (req, res) => res.json({ status: 'UP', service: SERVICE_NAME, version: SERVICE_VERSION }));
app.get('/ready', (req, res) => res.json({ status: 'READY', service: SERVICE_NAME, rulesLoaded: alertRules.size }));

app.post('/metrics/ingest', (req, res) => {
  const { metrics = {}, source, timestamp } = req.body;
  if (!metrics || typeof metrics !== 'object') return res.status(400).json({ error: 'metrics object required' });
  const fired = [];
  for (const [, rule] of alertRules) {
    if (rule.metric in metrics && evaluateRule(rule, metrics[rule.metric])) {
      const alert = fireAlert(rule, metrics[rule.metric], { source, timestamp });
      fired.push({ alertId: alert.id, rule: rule.name, severity: rule.severity });
    }
  }
  log('info', 'Metrics ingested', { metricsCount: Object.keys(metrics).length, alertsFired: fired.length, source });
  res.json({ evaluated: alertRules.size, alertsFired: fired.length, alerts: fired });
});

app.get('/alerts', (req, res) => {
  const { status, severity, limit = '50', offset = '0' } = req.query;
  let results = Array.from(alerts.values()).sort((a, b) => new Date(b.firedAt) - new Date(a.firedAt));
  if (status) results = results.filter(a => a.status === status.toUpperCase());
  if (severity) results = results.filter(a => a.severity === severity.toUpperCase());
  res.json({ data: results.slice(parseInt(offset), parseInt(offset) + parseInt(limit)), total: results.length });
});

app.get('/alerts/:id', (req, res) => {
  const alert = alerts.get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  res.json(alert);
});

app.post('/alerts/:id/acknowledge', (req, res) => {
  const alert = alerts.get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  if (alert.status !== 'OPEN') return res.status(422).json({ error: 'Only OPEN alerts can be acknowledged' });
  alert.status = 'ACKNOWLEDGED';
  alert.acknowledgedAt = new Date().toISOString();
  alert.acknowledgedBy = req.body.acknowledgedBy || 'unknown';
  log('info', 'Alert acknowledged', { alertId: alert.id });
  res.json(alert);
});

app.post('/alerts/:id/resolve', (req, res) => {
  const alert = alerts.get(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  if (alert.status === 'RESOLVED') return res.status(422).json({ error: 'Alert already resolved' });
  alert.status = 'RESOLVED';
  alert.resolvedAt = new Date().toISOString();
  log('info', 'Alert resolved', { alertId: alert.id });
  res.json(alert);
});

app.get('/rules', (req, res) => res.json({ data: Array.from(alertRules.values()), total: alertRules.size }));

app.post('/rules', (req, res) => {
  const { name, metric, threshold, operator, severity, cooldownMs = 300000 } = req.body;
  if (!name || !metric || threshold === undefined || !operator || !severity) return res.status(400).json({ error: 'name, metric, threshold, operator, severity required' });
  if (!SEVERITY_LEVELS.includes(severity)) return res.status(400).json({ error: `severity must be one of: ${SEVERITY_LEVELS.join(', ')}` });
  const rule = { id: uuidv4(), name, metric, threshold, operator, severity, cooldownMs, enabled: true, lastFiredAt: null };
  alertRules.set(rule.id, rule);
  res.status(201).json(rule);
});

app.patch('/rules/:id/toggle', (req, res) => {
  const rule = alertRules.get(req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  rule.enabled = !rule.enabled;
  res.json(rule);
});

app.delete('/rules/:id', (req, res) => {
  if (!alertRules.has(req.params.id)) return res.status(404).json({ error: 'Rule not found' });
  alertRules.delete(req.params.id);
  res.json({ deleted: true });
});

app.post('/channels', (req, res) => {
  const { type, config, minSeverity = 'LOW' } = req.body;
  const allowedTypes = ['email', 'slack', 'pagerduty', 'webhook'];
  if (!type || !allowedTypes.includes(type)) return res.status(400).json({ error: `type must be one of: ${allowedTypes.join(', ')}` });
  if (!config) return res.status(400).json({ error: 'config required' });
  const channel = { id: uuidv4(), type, config, minSeverity, enabled: true, createdAt: new Date().toISOString() };
  notificationChannels.set(channel.id, channel);
  res.status(201).json(channel);
});

app.get('/channels', (req, res) => res.json({ data: Array.from(notificationChannels.values()), total: notificationChannels.size }));
app.delete('/channels/:id', (req, res) => {
  if (!notificationChannels.has(req.params.id)) return res.status(404).json({ error: 'Channel not found' });
  notificationChannels.delete(req.params.id);
  res.json({ deleted: true });
});

app.get('/summary', (req, res) => {
  const all = Array.from(alerts.values());
  const summary = { total: all.length, byStatus: {}, bySeverity: {} };
  for (const a of all) {
    summary.byStatus[a.status] = (summary.byStatus[a.status] || 0) + 1;
    summary.bySeverity[a.severity] = (summary.bySeverity[a.severity] || 0) + 1;
  }
  res.json(summary);
});

app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path }));
app.use((err, req, res, next) => { log('error', 'Unhandled error', { error: err.message }); res.status(500).json({ error: 'Internal Server Error' }); });
app.listen(PORT, () => log('info', `${SERVICE_NAME} v${SERVICE_VERSION} listening on port ${PORT}`));
module.exports = app;
