'use strict';
/**
 * RD-15: Alert Dead Letter Queue (DLQ)
 *
 * When notification delivery fails for an alert (webhook timeout, email bounce,
 * Slack API error), the failed notification is placed in a Dead Letter Queue
 * for manual inspection and retry.
 *
 * This was introduced to address the incident where webhook delivery failures
 * caused downstream systems to silently miss critical payment events (RD-15).
 */

const { v4: uuidv4 } = require('uuid');
const deadLetterQueue = []; // Array of failed notification entries
const MAX_DLQ_SIZE = 1000;
const MAX_RETRY_ATTEMPTS = 3;

function enqueue(alert, channel, error, attempt = 1) {
  if (deadLetterQueue.length >= MAX_DLQ_SIZE) deadLetterQueue.shift(); // evict oldest
  const entry = {
    id: uuidv4(),
    alertId: alert.id,
    alertSeverity: alert.severity,
    channelId: channel.id,
    channelType: channel.type,
    error: error.message || String(error),
    attempt,
    maxAttempts: MAX_RETRY_ATTEMPTS,
    enqueuedAt: new Date().toISOString(),
    retriedAt: null,
    status: 'PENDING', // PENDING | RETRIED | EXHAUSTED | RESOLVED
  };
  deadLetterQueue.push(entry);
  return entry;
}

function retryEntry(entryId, notifyFn, log) {
  const entry = deadLetterQueue.find(e => e.id === entryId);
  if (!entry) return { success: false, error: 'Entry not found' };
  if (entry.status === 'EXHAUSTED') return { success: false, error: 'Max retries exhausted' };
  if (entry.attempt >= entry.maxAttempts) {
    entry.status = 'EXHAUSTED';
    log('warn', 'DLQ entry exhausted', { entryId, channelType: entry.channelType });
    return { success: false, error: 'Max retries reached' };
  }
  entry.attempt++;
  entry.retriedAt = new Date().toISOString();
  entry.status = 'RETRIED';
  log('info', 'Retrying DLQ entry', { entryId, attempt: entry.attempt });
  return { success: true, entry };
}

function getDLQ(statusFilter) {
  if (statusFilter) return deadLetterQueue.filter(e => e.status === statusFilter);
  return [...deadLetterQueue];
}

function clearResolved() {
  const before = deadLetterQueue.length;
  deadLetterQueue.splice(0, deadLetterQueue.length, ...deadLetterQueue.filter(e => e.status !== 'RESOLVED'));
  return before - deadLetterQueue.length;
}

module.exports = { enqueue, retryEntry, getDLQ, clearResolved, deadLetterQueue };
