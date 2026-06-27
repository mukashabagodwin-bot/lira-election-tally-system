const { Station, Constituency, District, Candidate, TallyBatch, TallyLine, RejectedBallot } = require('../../../infrastructure/orm/database');
const { canAccessStation, hasPermission } = require('../../../infrastructure/security/policies');
const { electionSchemes, defaultElectionCode, getElectionScheme } = require('../../../config/electionSchemes');
const { submitTallyCommand } = require('../../../application/commands/submitTallyCommand');
const { reviewTallyCommand } = require('../../../application/commands/reviewTallyCommand');
const { getVerificationQueue } = require('../../../application/queries/dashboardQueries');

const rejectedReasonOptions = [
  'Unclear voter mark',
  'Multiple candidates marked',
  'Spoilt ballot paper',
  'Missing official stamp',
  'Voter identity challenge',
  'Other'
];

async function findByPrimaryKey(model, id, options) {
  if (typeof model.findByPk === 'function') return model.findByPk(id, options);
  return model.findById(id, options);
}

async function scopedStations(user) {
  const stations = await Station.findAll({
    include: [{ model: Constituency, include: [District] }],
    order: [[Constituency, 'name', 'ASC'], ['name', 'ASC']]
  });
  return stations.filter((station) => canAccessStation(user, station));
}

async function newTally(req, res, next) {
  try {
    const selectedElection = getElectionScheme(req.query.electionCode || defaultElectionCode);
    const [stations, candidates] = await Promise.all([
      scopedStations(req.user),
      Candidate.findAll({ where: { electionCode: selectedElection.code }, order: [['ballotNumber', 'ASC']] })
    ]);
    const candidateRows = candidates.map((candidate) => ({
      id: Number(candidate.id || (candidate.getDataValue && candidate.getDataValue('id'))),
      ballotNumber: candidate.ballotNumber,
      name: candidate.name,
      party: candidate.party
    }));

    res.render('tallies/new', {
      title: 'Enter tally',
      stations,
      candidates: candidateRows,
      electionSchemes,
      selectedElection,
      rejectedReasonOptions
    });
  } catch (error) {
    next(error);
  }
}

function orderedValues(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort((left, right) => Number(left) - Number(right))
      .map((key) => value[key]);
  }
  return [];
}

function linesFromBody(body) {
  const submittedLines = orderedValues(body.lines);
  if (submittedLines.length) {
    return submittedLines.map((line) => ({
      candidateId: Number(line.candidateId),
      votes: Number(line.votes || 0)
    }));
  }

  const votes = body.votes || {};
  if (Array.isArray(votes)) {
    const candidateIds = orderedValues(body.candidateIds);
    return votes.map((voteCount, index) => ({
      candidateId: Number(candidateIds[index]),
      votes: Number(voteCount || 0)
    }));
  }

  return Object.keys(votes).map((candidateId) => ({
    candidateId: Number(candidateId),
    votes: Number(votes[candidateId] || 0)
  }));
}

function rejectedBallotsFromBody(body) {
  return orderedValues(body.rejectedBallots)
    .map((ballot) => ({
      reason: String(ballot.reason || '').trim(),
      note: String(ballot.note || '').trim()
    }))
    .filter((ballot) => ballot.reason || ballot.note);
}

async function createTally(req, res, next) {
  try {
    const selectedElection = getElectionScheme(req.body.electionCode || defaultElectionCode);
    const rejectedBallots = rejectedBallotsFromBody(req.body);
    const payload = {
      stationId: Number(req.body.stationId),
      electionCode: selectedElection.code,
      invalidVotes: rejectedBallots.length,
      rejectedBallots,
      deviceFingerprint: req.get('user-agent') || 'browser',
      lines: linesFromBody(req.body)
    };

    const result = await submitTallyCommand({
      actor: req.user,
      payload,
      requestId: req.idempotencyKey,
      sourceIp: req.originatingIp,
      traceId: req.traceId
    });

    req.session.flash = { type: 'success', message: selectedElection.label + ' batch #' + result.batchId + ' submitted for verification.' };
    if (hasPermission(req.user, 'tally:verify')) return res.redirect('/tallies/queue');
    return res.redirect('/tallies/' + result.batchId);
  } catch (error) {
    next(error);
  }
}

function electionLabelForView(code) {
  return getElectionScheme(code).label;
}

async function verificationQueue(req, res, next) {
  try {
    const batches = await getVerificationQueue(req.user);
    res.render('tallies/queue', { title: 'Verification queue', batches, electionLabel: electionLabelForView });
  } catch (error) {
    next(error);
  }
}

async function reviewTally(req, res, next) {
  try {
    const result = await reviewTallyCommand({
      actor: req.user,
      payload: {
        batchId: Number(req.params.id),
        decision: req.body.decision,
        reason: req.body.reason
      },
      sourceIp: req.originatingIp,
      traceId: req.traceId
    });

    req.session.flash = { type: 'success', message: 'Batch #' + result.batchId + ' is now ' + result.status + '.' };
    res.redirect('/tallies/queue');
  } catch (error) {
    next(error);
  }
}

async function batchDetails(req, res, next) {
  try {
    const batch = await findByPrimaryKey(TallyBatch, req.params.id, {
      include: [
        { model: Station, include: [{ model: Constituency, include: [District] }] },
        { model: TallyLine, include: [Candidate] },
        { model: RejectedBallot }
      ]
    });

    if (!batch || !canAccessStation(req.user, batch.Station)) return res.status(404).render('error', { title: 'Not found', message: 'Batch not found.' });
    res.render('tallies/show', { title: 'Tally batch', batch, electionLabel: getElectionScheme(batch.electionCode).label });
  } catch (error) {
    next(error);
  }
}

module.exports = { newTally, createTally, verificationQueue, reviewTally, batchDetails };
