'use strict';
/**
 * Alert Severity Escalation
 *
 * If an alert remains OPEN or ACKNOWLEDGED for too long without resolution,
 * it gets escalated to a higher severity level to ensure it gets attention.
 *
 * Escalation thresholds:
 *   LOW     -> MEDIUM  after 30 minutes
 *   MEDIUM  -> HIGH    after 20 minutes
 *   HIGH    -> CRITICAL after 10 minutes
 */

const ESCALATION_THRESHOLDS_MS = {
  LOW: 30 * 60 * 1000,
  MEDIUM: 20 * 60 * 1000,
  HIGH: 10 * 60 * 1000,
};

const SEVERITY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function getNextSeverity(current) {
  const idx = SEVERITY_ORDER.indexOf(current);
  if (idx === -1 || idx >= SEVERITY_ORDER.length - 1) return null;
  return SEVERITY_ORDER[idx + 1];
}

function checkAndEscalate(alerts, deliverNotifications, log) {
  const now = Date.now();
  let escalated = 0;

  for (const [, alert] of alerts) {
    if (alert.status === 'RESOLVED' || alert.severity === 'CRITICAL') continue;

    const threshold = ESCALATION_THRESHOLDS_MS[alert.severity];
    if (!threshold) continue;

    const elapsed = now - new Date(alert.firedAt).getTime();
    if (elapsed >= threshold) {
      const nextSeverity = getNextSeverity(alert.severity);
      if (!nextSeverity) continue;

      const oldSeverity = alert.severity;
      alert.severity = nextSeverity;
      alert.escalatedAt = new Date().toISOString();
      alert.escalationHistory = alert.escalationHistory || [];
      alert.escalationHistory.push({
        from: oldSeverity,
        to: nextSeverity,
        at: alert.escalatedAt,
        elapsedMs: elapsed,
      });

      log('warn', , {
        alertId: alert.id,
        from: oldSeverity,
        to: nextSeverity,
        elapsedMs: elapsed,
      });

      // Re-notify with escalated severity
      deliverNotifications(alert);
      escalated++;
    }
  }

  return escalated;
}

/**
 * Start the escalation check loop (runs every minute)
 */
function startEscalationLoop(alerts, deliverNotifications, log, intervalMs = 60000) {
  const interval = setInterval(() => {
    const count = checkAndEscalate(alerts, deliverNotifications, log);
    if (count > 0) log('info', );
  }, intervalMs);

  interval.unref(); // Don't block process exit
  log('info', 'Alert escalation loop started', { intervalMs });
  return interval;
}

module.exports = { checkAndEscalate, startEscalationLoop, ESCALATION_THRESHOLDS_MS };
