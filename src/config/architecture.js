module.exports = {
  project: 'Lira Election Tally System',
  architectureStyle: 'MVC at the interface layer, hexagonal boundaries inside the application core',
  boundedContexts: [
    'Identity and Access',
    'Election Configuration',
    'Tally Submission',
    'Verification Workflow',
    'Analytics and Audit'
  ],
  commandQuerySplit: {
    commands: 'submit, verify, reject, and supersede tally batches through ACID transactions',
    queries: 'dashboard reads use aggregate queries and eager loading to avoid N+1 loops'
  },
  zeroTrust: {
    identity: 'every request requires session or RS256 bearer token identity',
    network: 'gateway IP and originating subnet checks run before controllers',
    authorization: 'RBAC grants coarse permission; ABAC enforces district, constituency, and station boundaries',
    evidence: 'JSON audit logs include actor, role, source IP, and trace ID'
  },
  scalableLayers: [
    'Kong or Envoy API gateway for TLS, routing, and abuse controls',
    'stateless Node.js MVC/API layer behind a load balancer',
    'Redis-compatible atomic key-value layer for idempotency, token buckets, and hot counters',
    'SQL write model with ACID transactions and election integrity constraints',
    'read-optimized analytics endpoints and cacheable dashboard aggregates',
    'event outbox for asynchronous audit export, notifications, and downstream reporting'
  ]
};
