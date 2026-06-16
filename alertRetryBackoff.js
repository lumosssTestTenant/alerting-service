'use strict';
/**
 * RD-15: Exponential Backoff Retry for Alert Delivery
 * Retries failed alert notifications with exponential backoff + jitter.
 * Relates to: RD-15
 */
const BASE_DELAY_MS = 1000;
const MAX_RETRIES = 5;
const MAX_DELAY_MS = 30000;

function calcBackoff(attempt) {
  const exp = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
  const jitter = Math.random() * exp * 0.2; // 20% jitter
  return Math.floor(exp + jitter);
}

async function retryWithBackoff(fn, alertId, log) {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) log('info', `Alert delivered after ${attempt} retries`, { alertId, attempt });
      return { success: true, result, attempts: attempt + 1 };
    } catch (err) {
      lastError = err;
      const delay = calcBackoff(attempt);
      log('warn', `Alert delivery failed, retrying`, { alertId, attempt, delay, error: err.message });
      await new Promise(r => setTimeout(r, delay));
    }
  }
  log('error', `Alert delivery exhausted retries`, { alertId, attempts: MAX_RETRIES, error: lastError?.message });
  return { success: false, attempts: MAX_RETRIES, error: lastError?.message };
}

module.exports = { retryWithBackoff, calcBackoff, MAX_RETRIES };
