# User Manual: Lira Election Tally System

## 1. Sign In

Open http://localhost:3000 and sign in with one of the demo accounts.

| Role | Email | Password |
| --- | --- | --- |
| National Admin | admin@lira-tally.test | Password123! |
| District Returning Officer | dro@lira-tally.test | Password123! |
| Constituency Supervisor | supervisor@lira-tally.test | Password123! |
| Polling Officer | officer@lira-tally.test | Password123! |
| Observer | observer@lira-tally.test | Password123! |
| Auditor | auditor@lira-tally.test | Password123! |

## 2. Dashboard

After sign-in, the dashboard shows stations, registered voters, verified votes, turnout, pending batches, rejected batches, candidate totals, constituency turnout, and recent tally batches.

Use the Metrics API button to inspect the JSON endpoint used by the chart layer.

## 3. Enter a Tally

Role required: polling_officer or national_admin.

1. Open Enter tally.
2. Select the polling station.
3. Enter invalid or rejected ballots.
4. Enter votes for each candidate.
5. Submit tally.

The system blocks totals that exceed registered voters and records a duplicate-safe request ID.

## 4. Verify a Tally

Role required: constituency_supervisor, district_returning_officer, or national_admin.

1. Open Verify.
2. Review pending station batches.
3. Select Verify for correct results.
4. Enter a reason and select Reject for incorrect results.

Verified batches feed the public dashboard totals. Rejected batches remain in the audit trail.

## 5. Review Audit Logs

Role required: auditor or national_admin.

Open Audit to see event time, actor, role, action, entity, source IP, and trace ID.

## 6. Submission Screenshots

For coursework evidence, capture these screens after running the app:

- Dashboard with chart metrics.
- Enter tally form.
- Verification queue.
- Audit trail.
- Architecture screen for national_admin.
