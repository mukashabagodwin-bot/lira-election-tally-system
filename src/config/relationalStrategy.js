module.exports = {
  indexes: [
    'users.email unique for identity lookup',
    'stations.code unique for official station references',
    'tally_batches.request_id unique for duplicate network request tracking',
    'tally_batches.station_id/election_code/status for verification queues',
    'tally_lines.batch_id/candidate_id unique for vote integrity',
    'audit_logs.trace_id and created_at for investigation timelines'
  ],
  eagerLoadProfiles: {
    dashboard: ['Station', 'Constituency', 'District', 'TallyLine', 'Candidate'],
    verificationQueue: ['Station', 'submittedBy', 'verifiedBy'],
    auditTrail: ['actor']
  },
  dataIntegrity: {
    rootBoundary: 'one station tally batch is the aggregate root for ACID vote submission',
    corruptionControl: 'validated totals, unique request IDs, append-only audit rows, and superseding corrections instead of destructive edits',
    obsoleteData: 'older batches are superseded, never overwritten, so audit history remains reconstructable'
  }
};
