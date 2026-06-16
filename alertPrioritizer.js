'use strict';
/**
 * RD-19: Alert Priority Scoring for Subscription Failures
 * Relates to: RD-19
 */
const PRIORITY_WEIGHTS = {
  severity: { CRITICAL: 40, HIGH: 30, MEDIUM: 15, LOW: 5 },
  category: { subscription_failure: 35, payment_failure: 30, webhook_failure: 25, general: 10 },
  customerTier: { enterprise: 20, business: 10, starter: 5, free: 0 },
};
function scoreAlert(alert) {
  const sevScore = PRIORITY_WEIGHTS.severity[alert.severity] || 5;
  const catScore = PRIORITY_WEIGHTS.category[alert.category] || 10;
  const tierScore = PRIORITY_WEIGHTS.customerTier[alert.customerTier] || 0;
  const gracePeriodBoost = alert.tags?.includes('grace_period_expiry') ? 15 : 0;
  const totalScore = sevScore + catScore + tierScore + gracePeriodBoost;
  return {
    score: Math.min(totalScore, 100),
    priority: totalScore >= 70 ? 'P1' : totalScore >= 50 ? 'P2' : totalScore >= 30 ? 'P3' : 'P4',
    breakdown: { sevScore, catScore, tierScore, gracePeriodBoost },
  };
}
function sortAlerts(alerts) {
  return alerts.map(a => ({ ...a, _priority: scoreAlert(a) }))
    .sort((a, b) => b._priority.score - a._priority.score);
}
module.exports = { scoreAlert, sortAlerts, PRIORITY_WEIGHTS };
