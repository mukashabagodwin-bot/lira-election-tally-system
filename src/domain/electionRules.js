const crypto = require('crypto');

class ElectionRuleError extends Error {
  constructor(message, statusCode = 422) {
    super(message);
    this.name = 'ElectionRuleError';
    this.statusCode = statusCode;
  }
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeRejectedBallots(rejectedBallots) {
  if (!Array.isArray(rejectedBallots)) return [];
  return rejectedBallots.map((ballot, index) => ({
    sequenceNumber: index + 1,
    reason: String(ballot.reason || '').trim(),
    note: String(ballot.note || '').trim()
  }));
}

function summarizeRejectedByReason(rejectedBallots) {
  return rejectedBallots.reduce((summary, ballot) => {
    summary[ballot.reason] = (summary[ballot.reason] || 0) + 1;
    return summary;
  }, {});
}

function validateTallyPayload({ station, candidates, lines, invalidVotes, rejectedBallots }) {
  if (!station) throw new ElectionRuleError('Station does not exist.', 404);
  if (station.status !== 'open') throw new ElectionRuleError('Station is not open for tally entry.', 409);
  if (!Array.isArray(lines) || lines.length === 0) throw new ElectionRuleError('At least one candidate tally line is required.');

  const candidateIds = new Set(candidates.map((candidate) => Number(candidate.id)));
  const seen = new Set();
  let totalValidVotes = 0;

  for (const line of lines) {
    const candidateId = Number(line.candidateId);
    const votes = Number(line.votes);
    if (!candidateIds.has(candidateId)) throw new ElectionRuleError('Candidate is not configured for this election.');
    if (seen.has(candidateId)) throw new ElectionRuleError('Duplicate candidate line detected.');
    if (!Number.isInteger(votes) || votes < 0) throw new ElectionRuleError('Votes must be non-negative whole numbers.');
    seen.add(candidateId);
    totalValidVotes += votes;
  }

  const rejectedBallotRows = normalizeRejectedBallots(rejectedBallots);
  const legacyRejectedCount = Number(invalidVotes || 0);
  if (legacyRejectedCount > 0 && rejectedBallotRows.length === 0) {
    throw new ElectionRuleError('Add a reason for each rejected ballot.');
  }

  for (const ballot of rejectedBallotRows) {
    if (!ballot.reason) throw new ElectionRuleError('Every rejected ballot must have a reason.');
    if (ballot.reason.length > 80) throw new ElectionRuleError('Rejected ballot reasons must be 80 characters or fewer.');
    if (ballot.note.length > 180) throw new ElectionRuleError('Rejected ballot notes must be 180 characters or fewer.');
  }

  const rejected = rejectedBallotRows.length;
  const totalVotes = totalValidVotes + rejected;
  if (totalVotes > station.registeredVoters) {
    throw new ElectionRuleError('Total votes cannot exceed registered voters for the station.');
  }

  return {
    totalValidVotes,
    invalidVotes: rejected,
    rejectedBallots: rejectedBallotRows,
    rejectedByReason: summarizeRejectedByReason(rejectedBallotRows),
    totalVotes,
    turnoutPercent: Number(((totalVotes / station.registeredVoters) * 100).toFixed(2))
  };
}

module.exports = { ElectionRuleError, stableHash, validateTallyPayload };
