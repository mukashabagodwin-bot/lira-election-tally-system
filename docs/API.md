# API Notes

## Authentication

Browser pages use secure sessions. API clients can request an RS256 token from POST /api/token after session login, then call API endpoints with Authorization: Bearer token.

## Endpoints

| Method | Path | Purpose | Protection |
| --- | --- | --- | --- |
| GET | /api/metrics | Dashboard metrics | session or RS256 token, dashboard:view |
| POST | /api/token | Issue short-lived RS256 token | active session |

## Gateway Headers

The app reads traceparent, x-request-id, and x-forwarded-for. The response includes x-trace-id.

## Idempotency

Tally submission accepts an Idempotency-Key header or form requestId. The backend stores the body hash and response to prevent duplicate network retries from double-counting results.
