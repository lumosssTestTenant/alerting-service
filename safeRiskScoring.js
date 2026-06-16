'use strict';
/**
 * RD-17: Fix for high-value payment risk scoring 500 errors
 *
 * The fraud risk scoring module was throwing unhandled exceptions for
 * transactions above USD 5000 due to an integer overflow in the score
 * calculation for the high_value_transaction rule. This caused the
 * payment service to return 500 errors for all high-value payments.
 *
 * This module adds safe score computation with bounds checking and
 * graceful fallback when scoring fails.
 */

const MAX_RISK_SCORE = 100;
const MIN_RISK_SCORE = 0;

function safeComputeRiskScore(userId, amount, currency, ipCountry, log) {
  try {
    let score = 0;
    const reasons = [];

    // Safe integer bounds check for amount
    if (!Number.isFinite(amount) || amount < 0) {
      log('warn', 'Invalid amount in risk scoring — defaulting to MEDIUM risk', { userId, amount });
      return { score: 50, riskLevel: 'MEDIUM', reasons: ['invalid_amount'], safe: false };
    }

    // High-value transaction — capped to prevent overflow
    if (amount > 5000) {
      score = Math.min(score + 30, MAX_RISK_SCORE);
      reasons.push('high_value_transaction');
    } else if (amount > 1000) {
      score = Math.min(score + 10, MAX_RISK_SCORE);
      reasons.push('elevated_value_transaction');
    }

    // Country risk
    const HIGH_RISK_COUNTRIES = ['NG', 'RO', 'UA', 'VN'];
    if (ipCountry && HIGH_RISK_COUNTRIES.includes(String(ipCountry).toUpperCase())) {
      score = Math.min(score + 25, MAX_RISK_SCORE);
      reasons.push('high_risk_country');
    }

    // Currency risk
    const SAFE_CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD'];
    if (currency && !SAFE_CURRENCIES.includes(String(currency).toUpperCase())) {
      score = Math.min(score + 15, MAX_RISK_SCORE);
      reasons.push('unusual_currency');
    }

    // Clamp final score
    score = Math.max(MIN_RISK_SCORE, Math.min(score, MAX_RISK_SCORE));
    const riskLevel = score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';

    return { score, riskLevel, reasons, safe: true };
  } catch (err) {
    // Graceful fallback — never let scoring crash the payment flow
    log('error', 'Risk scoring threw exception — falling back to MEDIUM', { userId, error: err.message });
    return { score: 50, riskLevel: 'MEDIUM', reasons: ['scoring_error'], safe: false, error: err.message };
  }
}

function validateScoringInput(userId, amount) {
  const errors = [];
  if (!userId || typeof userId !== 'string') errors.push('userId must be a non-empty string');
  if (amount === undefined || amount === null) errors.push('amount is required');
  if (!Number.isFinite(Number(amount))) errors.push('amount must be a finite number');
  if (Number(amount) < 0) errors.push('amount must be non-negative');
  return errors;
}

module.exports = { safeComputeRiskScore, validateScoringInput, MAX_RISK_SCORE };
