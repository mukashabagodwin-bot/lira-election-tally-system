const Joi = require('joi');
const env = require('../../config/env');
const {
  sequelize,
  Station,
  Constituency,
  District,
  Candidate,
  TallyBatch,
  TallyLine,
  RejectedBallot,
  IdempotencyKey,
  EventOutbox
} = require('../../infrastructure/orm/database');
const { audit } = require('../../infrastructure/observability/logger');
const { canSubmitForStation } = require('../../infrastructure/security/policies');
const { stableHash, validateTallyPayload } = require('../../domain/electionRules');
const { electionCodeAllowed } = require('../../config/electionSchemes');

async function findByPrimaryKey(model, id, options) {
  if (typeof model.findByPk === 'function') return model.findByPk(id, options);
  return model.findById(id, options);
}

const schema = Joi.object({
  stationId: Joi.number().integer().positive().required(),
  electionCode: Joi.string().max(64).default('LIRA_MAYOR_2026'),
  invalidVotes: Joi.number().integer().min(0).default(0),
  deviceFingerprint: Joi.string().max(128).allow('', null),
  lines: Joi.array().items(Joi.object({
    candidateId: Joi.number().integer().positive().required(),
    votes: Joi.number().integer().min(0).required()
  })).min(1).required(),
  rejectedBallots: Joi.array().items(Joi.object({
    reason: Joi.string().trim().max(80).required(),
    note: Joi.string().trim().max(180).allow('', null).default('')
  })).default([])
});

async function submitTallyCommand({ actor, payload, requestId, sourceIp, traceId }) {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    const validationError = new Error(error.details.map((detail) => detail.message).join('; '));
    validationError.statusCode = 400;
    throw validationError;
  }

  if (!electionCodeAllowed(value.electionCode)) {
    const invalidElection = new Error('Election scheme is not configured.');
    invalidElection.statusCode = 400;
    throw invalidElection;
  }

  const station = await findByPrimaryKey(Station, value.stationId, {
    include: [{ model: Constituency, include: [District] }]
  });

  if (!canSubmitForStation(actor, station)) {
    const forbidden = new Error('You are not allowed to submit a tally for this station.');
    forbidden.statusCode = 403;
    throw forbidden;
  }

  const candidates = await Candidate.findAll({ where: { electionCode: value.electionCode }, order: [['ballotNumber', 'ASC']] });
  if (!candidates.length) {
    const noCandidates = new Error('No candidates are configured for this election scheme.');
    noCandidates.statusCode = 400;
    throw noCandidates;
  }
  const summary = validateTallyPayload({
    station,
    candidates,
    lines: value.lines,
    invalidVotes: value.invalidVotes,
    rejectedBallots: value.rejectedBallots
  });
  const bodyHash = stableHash(value);

  return sequelize.transaction(async (transaction) => {
    const existingKey = await IdempotencyKey.findOne({ where: { key: requestId }, transaction, lock: transaction.LOCK.UPDATE });
    if (existingKey && existingKey.bodyHash !== bodyHash) {
      const conflict = new Error('Idempotency key was reused with a different request body.');
      conflict.statusCode = 409;
      throw conflict;
    }
    if (existingKey && existingKey.responseJson) return { replayed: true, ...existingKey.responseJson };

    const expiresAt = new Date(Date.now() + env.idempotencyTtlSeconds * 1000);
    await IdempotencyKey.create({
      key: requestId,
      method: 'POST',
      path: '/tallies',
      bodyHash,
      expiresAt
    }, { transaction });

    await TallyBatch.update({ status: 'superseded' }, {
      where: {
        StationId: station.id,
        electionCode: value.electionCode,
        status: { $in: ['pending', 'rejected'] }
      },
      transaction
    });

    const latestVersion = await TallyBatch.max('batchVersion', {
      where: { StationId: station.id, electionCode: value.electionCode },
      transaction
    });

    const batch = await TallyBatch.create({
      StationId: station.id,
      submitted_by_id: actor.id,
      electionCode: value.electionCode,
      status: 'pending',
      requestId,
      bodyHash,
      registeredVotersSnapshot: station.registeredVoters,
      invalidVotes: summary.invalidVotes,
      totalValidVotes: summary.totalValidVotes,
      totalVotes: summary.totalVotes,
      batchVersion: Number(latestVersion || 0) + 1,
      sourceIp,
      deviceFingerprint: value.deviceFingerprint || null
    }, { transaction });

    await TallyLine.bulkCreate(value.lines.map((line) => ({
      TallyBatchId: batch.id,
      CandidateId: line.candidateId,
      votes: line.votes
    })), { transaction });

    if (summary.rejectedBallots.length) {
      await RejectedBallot.bulkCreate(summary.rejectedBallots.map((ballot) => ({
        TallyBatchId: batch.id,
        sequenceNumber: ballot.sequenceNumber,
        reason: ballot.reason,
        note: ballot.note || null
      })), { transaction });
    }

    await EventOutbox.create({
      type: 'tally.submitted',
      aggregateType: 'TallyBatch',
      aggregateId: String(batch.id),
      payload: {
        batchId: batch.id,
        stationId: station.id,
        requestId,
        totalVotes: summary.totalVotes,
        rejectedVotes: summary.invalidVotes,
        rejectedByReason: summary.rejectedByReason
      }
    }, { transaction });

    await audit({
      actor,
      action: 'tally.submitted',
      entity: 'TallyBatch',
      entityId: batch.id,
      sourceIp,
      traceId,
      details: { stationCode: station.code, summary, requestId },
      transaction
    });

    const response = { batchId: batch.id, status: batch.status, summary };
    await IdempotencyKey.update({ statusCode: 201, responseJson: response }, { where: { key: requestId }, transaction });
    return response;
  });
}

module.exports = { submitTallyCommand };
