# Technical Report: Lira Election Tally System

## 1. Problem Statement

Lira election officials need a secure decentralized web application for polling-station result entry, validation, verification, and tally metrics. The system must prevent accidental data corruption, track duplicate network requests, protect role boundaries, and provide a dashboard that can scale beyond a single local deployment.

Project 32 brief: Lira Election Tally System - decentralized entry system with data validation and tally metrics.

## 2. Functional Requirements

| Area | Requirement | Implementation |
| --- | --- | --- |
| Tally entry | Polling officers submit station-level candidate votes | Tally form and submitTallyCommand |
| Validation | Votes must be non-negative and cannot exceed registered voters | domain/electionRules.js |
| Verification | Supervisors verify or reject pending batches | reviewTallyCommand |
| Metrics | Candidate totals, turnout, status, recent batches | dashboardQueries.js and canvas charts |
| Audit | Track actor, action, role, IP, trace ID | AuditLog model and logger.js |
| Duplicate tracking | Replayed requests must not double-count | IdempotencyKey model and requestId |

## 3. Architecture Diagram

~~~mermaid
flowchart LR
  Officer[Polling officer browser] --> Gateway[Kong or Envoy API gateway]
  Supervisor[Supervisor browser] --> Gateway
  Observer[Observer dashboard] --> Gateway
  Gateway --> Smooth[Token bucket and leaky bucket]
  Smooth --> MVC[Express MVC controllers]
  MVC --> Auth[Zero trust auth filters]
  Auth --> Commands[Command use cases]
  Auth --> Queries[Query use cases]
  Commands --> Domain[Domain rules]
  Domain --> ORM[Sequelize repositories]
  Queries --> ORM
  ORM --> SQL[(SQLite local or PostgreSQL cloud)]
  Commands --> Outbox[(Event outbox)]
  Commands --> Audit[(JSON audit log)]
  Gateway --> Trace[Traceparent and source IP]
  Outbox --> Bus[Future message bus]
  Bus --> Reports[Analytics, HDFS archive, notifications]
~~~

## 4. Hexagonal and MVC Structure

The interface layer is MVC: routes and controllers handle HTTP, EJS renders views, and the frontend uses vanilla JavaScript for charts. Inside the app, the business core follows a hexagonal style:

| Layer | Folder | Purpose |
| --- | --- | --- |
| Domain | src/domain | Election rules and abstract ports |
| Application | src/application | Commands and queries |
| Infrastructure | src/infrastructure | ORM, security, tokens, rate limiting, logs |
| Interface | src/interfaces/http | Middleware, routes, controllers |
| Presentation | src/views and public | EJS pages, CSS, chart code |

This lets a future team replace SQLite with PostgreSQL, sessions with identity federation, or in-memory rate counters with Redis without rewriting the domain rules.

## 5. Domain-Driven Boundaries

The operational boundaries are:

| Bounded context | Main ownership |
| --- | --- |
| Identity and Access | users, roles, RS256 API tokens, sessions, subnet policy |
| Election Configuration | districts, constituencies, polling stations, candidates |
| Tally Submission | station aggregate root, vote lines, validation, idempotency |
| Verification Workflow | verify, reject, supersede old batches |
| Analytics and Audit | dashboard metrics, event outbox, JSON logs |

The station tally batch is the aggregate root. A submission command writes the batch header, candidate lines, idempotency key, audit entry, and event outbox row inside one ACID transaction.

## 6. ERD and Schema

~~~mermaid
erDiagram
  DISTRICTS ||--o{ CONSTITUENCIES : contains
  CONSTITUENCIES ||--o{ STATIONS : contains
  STATIONS ||--o{ TALLY_BATCHES : receives
  USERS ||--o{ TALLY_BATCHES : submits
  USERS ||--o{ AUDIT_LOGS : creates
  TALLY_BATCHES ||--o{ TALLY_LINES : includes
  CANDIDATES ||--o{ TALLY_LINES : receives
  TALLY_BATCHES ||--o{ EVENT_OUTBOX : emits
  IDEMPOTENCY_KEYS ||--o{ TALLY_BATCHES : protects
~~~

Important indexes:

| Index | Reason |
| --- | --- |
| users.email unique | fast login and clean identity |
| stations.code unique | official station lookup |
| tally_batches.request_id unique | duplicate request prevention |
| tally_batches.station_id/election_code/status | verification queue and station history |
| tally_lines.batch_id/candidate_id unique | prevents duplicate candidate lines |
| audit_logs.trace_id and created_at | investigation timeline |

## 7. Command Query Responsibility Split

Commands perform writes:

- submitTallyCommand validates station scope, checks totals, records idempotency, writes batch lines, emits an outbox event, and logs audit evidence.
- reviewTallyCommand verifies or rejects a pending batch. Verification supersedes older verified batches for the same station and election instead of deleting them.

Queries perform reads:

- dashboardQueries.js eagerly loads Station, Constituency, District, TallyLine, Candidate, submittedBy, and verifiedBy in bounded queries. This avoids the N+1 pattern where every row triggers more database calls.

## 8. Data Integrity and ACID Transactions

The system protects election data by using:

- ACID transactions around tally submission and review.
- Unique request IDs to safely identify duplicate network requests.
- Hashes of request bodies to detect idempotency-key misuse.
- Append-only audit records.
- Superseded status for obsolete tally batches instead of destructive edits.
- Registered-voter snapshots on batches to preserve the context at submission time.

If database corruption is suspected, the root boundary is the station batch. The audit trail and event outbox can reconstruct what actor submitted or reviewed each batch.

## 9. High Concurrency Optimization

Concurrency risks and controls:

| Risk | Control |
| --- | --- |
| Double form submit | IdempotencyKey unique index and request body hash |
| Simultaneous station corrections | batchVersion unique by station and election |
| Dashboard load | eager loading and aggregate read side |
| Abusive traffic | token bucket plus leaky bucket middleware |
| Slow external exports | event outbox decouples HTTP from downstream workers |
| Database pressure | indexes for status queues, candidates, station/election lookups |

For production, replace the local idempotency store and in-memory traffic buckets with Redis SETNX, INCR, EXPIRE, and Lua-backed atomic updates. Immutable exported tally snapshots can be archived to HDFS or object storage from the outbox worker.

## 10. Fault Isolation

The HTTP request path validates and commits the election transaction only. It does not synchronously call SMS, email, central reporting, HDFS, or analytics services. Those integrations are event-driven through EventOutbox. If a downstream subscriber blocks, the tally write remains safe and the outbox row can retry or be marked blocked.

This avoids HTTP synchronous loops between microservices and keeps the polling officer workflow low-latency.

## 11. Zero Trust Security

The system assumes no request is trusted by default:

- Identity: session login for browsers and RS256 JWT support for APIs.
- Authentication: passwords are hashed with bcrypt.
- Authorization: RBAC grants permissions and ABAC checks district, constituency, station, and subnet boundaries.
- Network: API routes pass through gateway IP filtering.
- CSRF: browser forms include CSRF tokens.
- Input validation: Joi schemas and domain validation block unsafe values.
- Audit: JSON logs include actor, role, source IP, trace ID, entity, and action.
- OWASP API: rate limits, least privilege, object-level authorization, secure sessions, and input validation address common API risks.

RBAC examples:

| Role | Permissions |
| --- | --- |
| national_admin | dashboard, submit, verify, reject, audit, architecture |
| district_returning_officer | dashboard, verify, reject for district |
| constituency_supervisor | dashboard, verify, reject for constituency |
| polling_officer | dashboard and submit only for assigned station |
| observer | read-only dashboard |
| auditor | dashboard and audit logs |

ABAC examples:

- A polling officer can only submit for their assigned station.
- A constituency supervisor can only review batches in their constituency.
- A district returning officer can only review batches in their district.
- allowedSubnets restrict account use to approved originating IPs or subnets.

## 12. Proxy Pattern and API Deployment

Recommended deployment path:

1. Browser or API client sends requests to Kong or Envoy.
2. Gateway terminates TLS, validates trusted routes, forwards traceparent and x-forwarded-for.
3. Node.js app validates session or RS256 bearer token.
4. App writes to PostgreSQL and Redis in production.
5. Outbox worker publishes to analytics and archive sinks.

Safety for first deployment:

- Start with one read-write API instance and one database primary.
- Enable daily backups before public testing.
- Keep write endpoints behind stricter rate limits than dashboard reads.
- Turn on gateway access logs and application JSON logs.
- Seed production with real station and candidate data only after dry-run validation.

## 13. Scalability Layers

| Layer | Scale strategy |
| --- | --- |
| Gateway | Kong or Envoy horizontal replicas, WAF rules, TLS, IP policies |
| App | stateless Node.js workers behind load balancer |
| Session | move from Sequelize session table to Redis for multi-node scale |
| Idempotency | Redis atomic keys with TTL |
| Database | PostgreSQL primary with read replicas for analytics |
| Events | outbox worker to queue, Kafka, RabbitMQ, or cloud pub/sub |
| Archive | HDFS or object storage for immutable tally snapshots |
| Observability | OpenTelemetry traces and JSON logs shipped centrally |

## 14. Visualization Pipeline

The dashboard reads verified batches, groups candidate totals and turnout by constituency, then renders canvas bar charts. The read query eager-loads related records to avoid lazy-loading loops and to keep dashboard latency predictable.

## 15. Legacy to Modular Transition

A legacy election spreadsheet or monolithic tally tool can transition through a strangler approach:

1. Import official districts, constituencies, stations, and candidates into the Election Configuration context.
2. Keep old reporting read-only while new tally submissions enter through the Submission context.
3. Add adapters that map legacy station codes to new Station records.
4. Move verification into the new workflow while exporting verified results back to legacy reports.
5. Replace legacy dashboards with the query API after parallel-run reconciliation.
6. Retire old write paths once audit logs and backups prove consistency.

The abstract ports under src/domain/ports define the contracts that keep the domain independent from ORM and identity provider choices.

## 16. OpenTelemetry and Traceability

The app accepts traceparent or x-request-id and returns x-trace-id. Logs include traceId and source IP. In production, add OpenTelemetry SDK instrumentation to create spans for HTTP requests, database commands, outbox publishing, and gateway propagation.

## 17. Local Execution

Run:

~~~bash
npm install
copy .env.example .env
npm run seed
npm start
~~~

Then open http://localhost:3000 and sign in with the demo users in README.md.
