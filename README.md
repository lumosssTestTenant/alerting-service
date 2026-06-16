# alerting-service

A demo alerting service that monitors payment and subscription metrics and fires alerts based on configurable thresholds.

## Features
- Rule-based alert engine (payment failure rate, webhook failures, subscription churn, latency, fraud blocks)
- Alert lifecycle: OPEN → ACKNOWLEDGED → RESOLVED
- Multi-channel notification dispatch (email, Slack, PagerDuty, webhook)
- Metric ingestion endpoint for real-time rule evaluation
- Alert cooldown to prevent notification storms

## Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Service health |
| POST | /metrics/ingest | Ingest metrics and evaluate rules |
| GET | /alerts | List all alerts |
| POST | /alerts/:id/acknowledge | Acknowledge an alert |
| POST | /alerts/:id/resolve | Resolve an alert |
| GET | /rules | List alert rules |
| POST | /rules | Create a custom alert rule |
| PATCH | /rules/:id/toggle | Enable/disable a rule |
| POST | /channels | Register notification channel |
| GET | /summary | Alert stats summary |

## Quick Start
```bash
npm install
npm start
```

## Default Alert Rules
| Rule | Metric | Threshold | Severity |
|------|--------|-----------|----------|
| High Payment Failure Rate | payment_failure_rate | > 5% | HIGH |
| Webhook Delivery Failure | webhook_failure_rate | > 10% | CRITICAL |
| Subscription Churn | subscription_churn_rate | > 2% | MEDIUM |
| High P99 Latency | p99_latency_ms | > 2000ms | HIGH |
| High Fraud Block Rate | fraud_block_rate | > 3% | MEDIUM |
