# Lira Election Tally System

Project 32 from the coursework: a decentralized election tally entry system with data validation and tally metrics.

## What It Does

- Polling officers enter station-level results.
- Constituency supervisors verify or reject submitted batches.
- District returning officers and national admins monitor live metrics.
- Observers get read-only dashboards.
- Auditors inspect JSON audit logs, duplicate network requests, and trace IDs.

## Stack

- MVC web app: Node.js, Express, EJS views
- ORM and database: Sequelize with SQLite for local coursework execution
- Visualization: Vanilla JS canvas charts fed by aggregated API endpoints
- Security: hashed passwords, RBAC + ABAC, CSRF, RS256 JWT API option, IP/subnet filters, token bucket and leaky bucket traffic smoothing
- Observability: JSON audit events, request trace IDs, gateway IP capture, OpenTelemetry-ready headers

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment defaults:

```bash
copy .env.example .env
```

3. Run a quick structural check:

```bash
npm run check
```

4. Seed the database:

```bash
npm run seed
```

5. Start the app:

```bash
npm start
```

6. Open http://localhost:3000.

## Demo Logins

| Role | Email | Password |
| --- | --- | --- |
| National Admin | admin@lira-tally.test | Password123! |
| District Returning Officer | dro@lira-tally.test | Password123! |
| Constituency Supervisor | supervisor@lira-tally.test | Password123! |
| Polling Officer | officer@lira-tally.test | Password123! |
| Observer | observer@lira-tally.test | Password123! |
| Auditor | auditor@lira-tally.test | Password123! |

## Architecture Notes

The app uses a hexagonal layout:

- domain: election invariants and bounded-context rules
- application: command and query use cases
- infrastructure: Sequelize, audit logs, tokens, rate limiting, duplicate request tracking
- interfaces/http: MVC routes, controllers, middleware
- views and public: frontend screens and charts

See docs/TECHNICAL_REPORT.md for the architecture diagram, ERD, scalability plan, zero-trust design, legacy transition strategy, and deployment notes for Kong/Envoy.
