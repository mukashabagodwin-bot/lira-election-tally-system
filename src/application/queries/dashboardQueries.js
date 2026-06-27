const {
  sequelize,
  District,
  Constituency,
  Station,
  Candidate,
  TallyBatch,
  TallyLine,
  RejectedBallot,
  User
} = require('../../infrastructure/orm/database');
const { canAccessStation } = require('../../infrastructure/security/policies');
const { defaultElectionCode, getElectionScheme } = require('../../config/electionSchemes');

function stationScopeWhere(user) {
  if (!user) return { id: -1 };
  if (user.role === 'national_admin' || user.role === 'observer' || user.role === 'auditor') return {};
  if (user.role === 'constituency_supervisor') return { ConstituencyId: user.ConstituencyId };
  if (user.role === 'polling_officer') return { ConstituencyId: user.ConstituencyId };
  return {};
}

function filterByScope(user, batches) {
  return batches.filter((batch) => canAccessStation(user, batch.Station));
}

function addRejectedMetric(reasonMap, stationMap, batch, count, reason) {
  if (!count) return;
  const label = reason || 'Reason not captured';
  reasonMap.set(label, (reasonMap.get(label) || 0) + count);
  const stationKey = batch.Station.id;
  const existing = stationMap.get(stationKey) || {
    station: batch.Station.name,
    code: batch.Station.code,
    constituency: batch.Station.Constituency.name,
    count: 0
  };
  existing.count += count;
  stationMap.set(stationKey, existing);
}

async function getDashboardMetrics(user, electionCode = defaultElectionCode) {
  const selectedElection = getElectionScheme(electionCode);
  const stationWhere = stationScopeWhere(user);
  const stations = (await Station.findAll({
    where: stationWhere,
    include: [{ model: Constituency, include: [District] }],
    order: [[Constituency, 'name', 'ASC'], ['name', 'ASC']]
  })).filter((station) => canAccessStation(user, station));

  const batches = filterByScope(user, await TallyBatch.findAll({
    where: { electionCode: selectedElection.code },
    include: [
      { model: Station, include: [{ model: Constituency, include: [District] }] },
      { model: TallyLine, include: [Candidate] },
      { model: RejectedBallot },
      { model: User, as: 'submittedBy', attributes: ['id', 'name', 'role'] },
      { model: User, as: 'verifiedBy', attributes: ['id', 'name', 'role'] }
    ],
    order: [['submittedAt', 'DESC']]
  }));

  const verified = batches.filter((batch) => batch.status === 'verified');
  const candidateTotals = new Map();
  const turnoutByStation = new Map();
  const rejectedByReason = new Map();
  const rejectedByStation = new Map();
  const batchStatus = new Map([
    ['verified', 0],
    ['pending', 0],
    ['rejected', 0],
    ['superseded', 0]
  ]);
  const stationStatus = { open: 0, closed: 0, quarantined: 0, noSubmission: 0, pending: 0, verified: 0, rejected: 0 };

  for (const station of stations) {
    stationStatus[station.status] = (stationStatus[station.status] || 0) + 1;
    turnoutByStation.set(station.id, {
      station: station.code + ' - ' + station.name,
      constituency: station.Constituency.name,
      votes: 0,
      registered: station.registeredVoters
    });
  }

  for (const batch of batches) {
    stationStatus[batch.status] = (stationStatus[batch.status] || 0) + 1;
    batchStatus.set(batch.status, (batchStatus.get(batch.status) || 0) + 1);
  }

  const stationIdsWithBatch = new Set(batches.map((batch) => batch.StationId));
  stationStatus.noSubmission = stations.filter((station) => !stationIdsWithBatch.has(station.id)).length;

  for (const batch of verified) {
    const existing = turnoutByStation.get(batch.Station.id) || {
      station: batch.Station.code + ' - ' + batch.Station.name,
      constituency: batch.Station.Constituency.name,
      votes: 0,
      registered: batch.Station.registeredVoters || batch.registeredVotersSnapshot
    };
    existing.votes += batch.totalVotes;
    turnoutByStation.set(batch.Station.id, existing);

    for (const line of batch.TallyLines) {
      const candidateName = line.Candidate.name + ' (' + line.Candidate.party + ')';
      candidateTotals.set(candidateName, (candidateTotals.get(candidateName) || 0) + line.votes);
    }

    const rejectedRows = batch.RejectedBallots || [];
    if (rejectedRows.length) {
      for (const ballot of rejectedRows) addRejectedMetric(rejectedByReason, rejectedByStation, batch, 1, ballot.reason);
    } else if (batch.invalidVotes > 0) {
      addRejectedMetric(rejectedByReason, rejectedByStation, batch, batch.invalidVotes, 'Reason not captured');
    }
  }

  const registeredVoters = stations.reduce((sum, station) => sum + station.registeredVoters, 0);
  const verifiedVotes = verified.reduce((sum, batch) => sum + batch.totalVotes, 0);
  const rejectedBallots = Array.from(rejectedByReason.values()).reduce((sum, value) => sum + value, 0);
  const turnoutPercent = registeredVoters ? Number(((verifiedVotes / registeredVoters) * 100).toFixed(2)) : 0;

  return {
    election: selectedElection,
    cards: {
      stations: stations.length,
      registeredVoters,
      verifiedVotes,
      turnoutPercent,
      rejectedBallots,
      pendingBatches: batches.filter((batch) => batch.status === 'pending').length,
      rejectedBatches: batches.filter((batch) => batch.status === 'rejected').length
    },
    candidateTotals: Array.from(candidateTotals.entries()).map(([name, votes]) => ({ name, votes })),
    turnoutByStation: Array.from(turnoutByStation.values()).map((row) => ({
      station: row.station,
      constituency: row.constituency,
      votes: row.votes,
      registered: row.registered,
      turnout: row.registered ? Number(((row.votes / row.registered) * 100).toFixed(2)) : 0
    })),
    rejectedByReason: Array.from(rejectedByReason.entries()).map(([reason, count]) => ({ reason, count })),
    rejectedByStation: Array.from(rejectedByStation.values()).sort((left, right) => right.count - left.count),
    batchStatusTotals: Array.from(batchStatus.entries()).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count
    })),
    stationStatus,
    recentBatches: batches.slice(0, 8).map((batch) => ({
      id: batch.id,
      station: batch.Station.name,
      constituency: batch.Station.Constituency.name,
      status: batch.status,
      election: selectedElection.label,
      totalVotes: batch.totalVotes,
      rejectedVotes: batch.invalidVotes,
      submittedBy: batch.submittedBy ? batch.submittedBy.name : 'Unknown',
      verifiedBy: batch.verifiedBy ? batch.verifiedBy.name : '',
      submittedAt: batch.submittedAt
    }))
  };
}

async function getVerificationQueue(user) {
  return filterByScope(user, await TallyBatch.findAll({
    where: { status: 'pending' },
    include: [
      { model: Station, include: [{ model: Constituency, include: [District] }] },
      { model: TallyLine, include: [Candidate] },
      { model: RejectedBallot },
      { model: User, as: 'submittedBy', attributes: ['id', 'name', 'role'] }
    ],
    order: [['submittedAt', 'ASC']]
  }));
}

async function getAuditTrail(limit = 50) {
  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const rows = await sequelize.query([
    'SELECT',
    '  a.created_at AS createdAt,',
    '  a.action AS action,',
    '  a.entity AS entity,',
    '  a.entity_id AS entityId,',
    '  a.role AS role,',
    '  a.source_ip AS sourceIp,',
    '  a.trace_id AS traceId,',
    '  u.name AS actorName,',
    '  u.role AS actorRole',
    'FROM AuditLogs a',
    'LEFT JOIN Users u ON u.id = a.actor_id',
    'ORDER BY a.created_at DESC',
    'LIMIT ' + safeLimit
  ].join(' '), {
    type: sequelize.QueryTypes.SELECT
  });

  return rows.map((row) => ({
    createdAt: row.createdAt,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    role: row.role,
    sourceIp: row.sourceIp,
    traceId: row.traceId,
    actor: row.actorName ? { name: row.actorName, role: row.actorRole } : null
  }));
}

module.exports = { getDashboardMetrics, getVerificationQueue, getAuditTrail, stationScopeWhere };
