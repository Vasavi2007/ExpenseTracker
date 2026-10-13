# SpendWise AI — Smart Expense Tracker + DevOps

A full-stack starter project for a student DevOps portfolio. Includes a React dashboard, Node.js REST API, Spring Boot analytics service, PostgreSQL, optional Python ML service, Docker Compose, Kubernetes manifests, Jenkins pipeline, Karate API tests, and Spring Boot tests.

> This is a learning/demo project, not a banking application. Use synthetic data only. AI/forecasting outputs are estimates, not financial advice. Before public deployment, add production-grade secrets management, HTTPS, rate limiting, backups, stronger auth/session handling, security review, and privacy/legal review.

## Feature map

- Dashboard: income, expenses, balance, savings rate, recent transactions, category totals.
- Transactions: create/list/delete, category, payment method, notes, date, CSV export/import.
- Budgets: category budgets and 80% / 100% alerts.
- Reports: monthly category summary and monthly comparison endpoint.
- AI-style insights: deterministic, explainable insights from the user's own transaction records (no external AI key required).
- Unusual-spend detection: rule-based flagging against a configurable threshold.
- Expense forecasting: average daily spend extrapolated to month-end.
- Savings goals: create/list goals and calculate progress.
- Receipt OCR: upload endpoint scaffold; returns instructions/metadata. Plug in Tesseract or a hosted OCR provider to enable real extraction.
- Reminders/subscriptions: recurring payment records and upcoming-payment endpoint.
- Family/shared budgets, multi-currency, financial health score, audit logs, and notifications are represented as extension points / API notes; see `docs/EXTENSIONS.md`.
- Authentication: demo JWT login/register. Change demo secrets before any use beyond local learning.
- DevOps: Dockerfiles, Compose, Kubernetes Deployment/Service, Jenkinsfile, health checks, Karate tests, Spring Boot JUnit/MockMvc tests.

## Architecture

React/Vite -> Node.js/Express API -> PostgreSQL
                         -> Spring Boot analytics service
Optional Python ML service can be added for model-based anomaly detection.

## Quick start (Docker Desktop required)

1. Copy `.env.example` to `.env` and change `JWT_SECRET`.
2. From this directory run:

   ```bash
   docker compose up --build
   ```

3. Open:
   - Frontend: http://localhost:5173
   - Node API health: http://localhost:5000/health
   - API docs summary: http://localhost:5000/api
   - Spring Boot health: http://localhost:8080/actuator/health

4. Register a user in the app. For a quick API test, use:
   ```json
   POST http://localhost:5000/api/auth/register
   {"name":"Demo User","email":"demo@example.com","password":"ChangeMe123!"}
   ```
   Then sign in and add transactions.

## Local development without Docker

### Node API
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
The API uses PostgreSQL. Start the database with `docker compose up -d db`, then run Node.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Spring Boot
Requires Java 17+ and Maven:
```bash
cd spring-analytics
mvn test
mvn spring-boot:run
```

## Testing

### Node API + Karate
```bash
cd tests/karate
mvn test
```
The Karate suite expects Node API at `http://localhost:5000`. Register/login tests use unique emails.

### Spring Boot
```bash
cd spring-analytics
mvn test
```

### Full local verification
```bash
docker compose up --build -d
curl http://localhost:5000/health
curl http://localhost:8080/actuator/health
```

## Kubernetes (local Minikube)

The manifests in `k8s/` assume images are available to the cluster and PostgreSQL is provisioned separately. For a local demo:
1. Build/load images into Minikube:
   ```bash
   minikube image build -t spendwise-api:local ./backend
   minikube image build -t spendwise-web:local ./frontend
   minikube image build -t spendwise-analytics:local ./spring-analytics
   ```
2. Apply manifests:
   ```bash
   kubectl apply -f k8s/
   kubectl get pods,svc
   ```
3. The API manifest uses environment placeholders. Update `k8s/config-secret.example.yaml` with local demo values and apply it as `k8s/config-secret.yaml` (do not commit real secrets).
4. In another terminal:
   ```bash
   kubectl port-forward svc/spendwise-web 5173:80
   kubectl port-forward svc/spendwise-api 5000:5000
   ```

Kubernetes manifests are a learning baseline; for production, use managed PostgreSQL, proper Secret management, Ingress/TLS, resource limits, autoscaling, probes, and a migration job.

## Important limitations
- OCR is a scaffold, not a complete OCR engine.
- Email/SMS/push delivery needs a provider and credentials; reminders are stored/queried in-app.
- The “AI assistant” is explainable rules-based analysis, not a connected LLM.
- Multi-currency conversion requires a trusted exchange-rate provider.
- Shared/family budgets and full subscription detection need additional UI and access-control work.
- For real deployment, implement password reset, email verification, refresh-token rotation, CSRF/CORS review, audit retention policies, and secure cookie/session strategy.
