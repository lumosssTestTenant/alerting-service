'use strict';
/**
 * RD-19: Fix subscription grace period state machine
 *
 * Subscriptions were being immediately cancelled on payment failure instead of
 * transitioning to PAST_DUE and entering the 7-day grace period (RD-19).
 *
 * Root cause: The billing job was calling cancelSubscription() directly instead
 * of transitionToPastDue() on first payment failure.
 *
 * This module provides a correct state machine with explicit transition guards.
 */

const VALID_TRANSITIONS = {
  ACTIVE: ['PAST_DUE', 'CANCELLED'],
  PAST_DUE: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [], // terminal state
};

const GRACE_PERIOD_DAYS = 7;
const RETRY_SCHEDULE_DAYS = [1, 3, 7];

function canTransition(fromStatus, toStatus) {
  return (VALID_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

function transition(subscription, toStatus, reason, log) {
  const from = subscription.status;
  if (!canTransition(from, toStatus)) {
    const err = `Invalid transition: ${from} -> ${toStatus}`;
    log('error', err, { subscriptionId: subscription.id });
    throw new Error(err);
  }

  subscription.status = toStatus;
  subscription.updatedAt = new Date().toISOString();
  subscription.statusHistory = subscription.statusHistory || [];
  subscription.statusHistory.push({ from, to: toStatus, reason, at: subscription.updatedAt });

  log('info', `Subscription transitioned`, {
    subscriptionId: subscription.id, from, to: toStatus, reason
  });
  return subscription;
}

/**
 * Called on first payment failure — moves to PAST_DUE (grace period)
 * NOT cancelled. This was the bug in RD-19.
 */
function onPaymentFailed(subscription, attempt, log) {
  if (subscription.status === 'ACTIVE') {
    // First failure: enter grace period
    transition(subscription, 'PAST_DUE', `payment_failed_attempt_${attempt}`, log);
    subscription.pastDueAt = new Date().toISOString();
    subscription.gracePeriodEndsAt = new Date(
      Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    subscription.renewalAttempts = 1;
    const nextRetryDays = RETRY_SCHEDULE_DAYS[0] || GRACE_PERIOD_DAYS;
    subscription.nextRetryAt = new Date(
      Date.now() + nextRetryDays * 24 * 60 * 60 * 1000
    ).toISOString();
  } else if (subscription.status === 'PAST_DUE') {
    subscription.renewalAttempts = (subscription.renewalAttempts || 0) + 1;
    const retryIdx = Math.min(subscription.renewalAttempts - 1, RETRY_SCHEDULE_DAYS.length - 1);
    const nextRetryDays = RETRY_SCHEDULE_DAYS[retryIdx];

    // Check if grace period exhausted
    if (new Date() > new Date(subscription.gracePeriodEndsAt)) {
      transition(subscription, 'SUSPENDED', 'grace_period_expired', log);
    } else {
      subscription.nextRetryAt = new Date(
        Date.now() + nextRetryDays * 24 * 60 * 60 * 1000
      ).toISOString();
      subscription.updatedAt = new Date().toISOString();
    }
  }
  return subscription;
}

function onPaymentSucceeded(subscription, log) {
  transition(subscription, 'ACTIVE', 'payment_succeeded', log);
  subscription.pastDueAt = null;
  subscription.gracePeriodEndsAt = null;
  subscription.renewalAttempts = 0;
  subscription.nextRetryAt = null;
  subscription.lastRenewalAt = new Date().toISOString();
  return subscription;
}

module.exports = {
  transition, onPaymentFailed, onPaymentSucceeded, canTransition,
  VALID_TRANSITIONS, GRACE_PERIOD_DAYS, RETRY_SCHEDULE_DAYS
};
