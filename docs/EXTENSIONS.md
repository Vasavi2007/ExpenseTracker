# Extension plan for the full high-level feature set

This starter implements core flows and several advanced endpoints. Use this guide to extend it into a fuller capstone.

## Implemented in the starter
- User register/login with JWT
- Transaction CRUD basics, search/filter, CSV export
- Category budgets and 80%/100% alert statuses
- Savings goals and progress
- Recurring payments and upcoming reminders API
- Monthly reports
- Explainable spending insights
- Threshold-based unusual-spend flags
- Month-end forecast using a simple run-rate
- Savings-rate indicator
- Audit log endpoint
- Receipt upload scaffold
- React dashboard
- Docker Compose, Kubernetes manifests, Jenkins pipeline, Karate API suite, Spring Boot tests

## Suggested extensions
1. **CSV import:** parse uploaded CSV with a strict schema, validate every row, preview before committing, and reject formula-injection cells on export.
2. **Real OCR:** use Tesseract locally or a trusted OCR API; show extracted fields for user confirmation before saving.
3. **ML anomaly detection:** train Isolation Forest or robust z-score models from enough history. Keep user-specific baselines, show reasons, and allow dismiss/confirm.
4. **Better forecasting:** aggregate daily and category-level data; evaluate with backtesting (MAE/MAPE) and show uncertainty ranges.
5. **Natural-language finance assistant:** use a tool-limited LLM that queries only authorized user's aggregates; never send credentials or raw transaction details unnecessarily.
6. **Notifications:** schedule reminders with a queue/worker; use email/push provider credentials via secret management.
7. **Family budgets:** add group and membership tables, permissions, invitation flow, and enforce group membership in every query.
8. **Multi-currency:** store original amount/currency plus normalized amount, conversion rate, provider, and rate timestamp.
9. **Subscriptions:** detect recurring merchant/amount patterns and let the user confirm a subscription.
10. **Security:** password reset, email verification, rate limits, refresh-token rotation, CSP, TLS, secure cookies, DB migrations, backups, audit policy, data export/deletion.
11. **Operations:** image registry, pinned image tags, Kubernetes Ingress/TLS, HPA, PodDisruptionBudget, resource limits, Prometheus metrics, Grafana dashboard, alerting, rolling deploy and rollback.

## API overview
- `POST /api/auth/register`, `POST /api/auth/login`
- `GET /api/dashboard`, `GET/POST /api/transactions`, `DELETE /api/transactions/:id`
- `GET/POST /api/budgets`, `GET/POST /api/goals`
- `GET/POST /api/recurring`
- `GET /api/reports/monthly`, `GET /api/insights`, `GET /api/forecast`, `GET /api/anomalies`
- `GET /api/health-score`, `GET /api/export.csv`, `POST /api/receipts/scan`, `GET /api/audit`
- Spring Boot: `POST /api/analytics/savings-rate`, `POST /api/analytics/budget-alert`, `POST /api/analytics/compare`, `GET /api/analytics/health`
