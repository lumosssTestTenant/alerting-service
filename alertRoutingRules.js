'use strict';
/**
 * RD-15 RD-17: Dynamic Alert Routing Rules Engine
 * Routes alerts to correct teams based on configurable rules.
 * Relates to: RD-15, RD-17
 */
const rules = [];

function addRule(rule) {
  rules.push({ ...rule, id: rule.id || `rule_${rules.length + 1}`, priority: rule.priority || 50 });
  rules.sort((a, b) => b.priority - a.priority);
}

function matchRule(alert) {
  const now = new Date();
  const hour = now.getUTCHours();
  const isBusinessHours = hour >= 9 && hour < 17;

  for (const rule of rules) {
    if (rule.serviceId && rule.serviceId !== alert.serviceId) continue;
    if (rule.severity && rule.severity !== alert.severity) continue;
    if (rule.category && rule.category !== alert.category) continue;
    if (rule.businessHoursOnly && !isBusinessHours) continue;
    if (rule.afterHoursOnly && isBusinessHours) continue;
    return { matched: true, rule, team: rule.team, channel: rule.channel };
  }
  return { matched: false, rule: null, team: 'default-oncall', channel: 'general-alerts' };
}

function route(alert) {
  const result = matchRule(alert);
  return {
    alertId: alert.id,
    team: result.team,
    channel: result.channel,
    matchedRule: result.rule?.id || 'default',
    routedAt: new Date().toISOString(),
  };
}

// Default rules
addRule({ id: 'critical-payments', severity: 'CRITICAL', category: 'payment_failure', team: 'payments-oncall', channel: 'payments-critical', priority: 100 });
addRule({ id: 'subscription-ah', category: 'subscription_failure', afterHoursOnly: true, team: 'sre-oncall', channel: 'sre-alerts', priority: 80 });
addRule({ id: 'webhook-bh', category: 'webhook_failure', businessHoursOnly: true, team: 'platform-team', channel: 'platform-alerts', priority: 70 });

module.exports = { addRule, matchRule, route, rules };
