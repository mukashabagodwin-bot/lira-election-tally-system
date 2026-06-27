const Joi = require('joi');
const {
  sequelize,
  TallyBatch,
  TallyLine,
  Candidate,
  Station,
  Constituency,
  District,
  EventOutbox
} = require('../../infrastructure/orm/database');
const { audit } = require('../../infrastructure/observability/logger');
const { canVerifyBatch } = require('../../infrastructure/security/policies');

async function findByPrimaryKey(model, id, options) {
  if (typeof model.findByPk === 'function') return model.findByPk(id, options);
  return model.findById(id, options);
}

const schema = Joi.object({
  batchId: Joi.number().integer().positive().required(),
  decision: Joi.string().valid('verify', 'reject').required(),
  reason: Joi.string().max(500).allow('', null)
});

async function reviewTallyCommand({ actor, payload, sourceIp, traceId }) {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    const validationError = new Error(error.details.map((detail) => detail.message).join('; '));
    validationError.statusCode = 400;
    throw validationError;
  }

  const batch = await findByPrimaryKey(TallyBatch, value.batchId, {
    include: [
      { model: Station, include: [{ model: Constituency, include: [District] }] },
      { model: TallyLine, include: [Candidate] }
    ]
  });

  if (!batch) {
    const missing = new Error('Tally batch was not found.');
    missing.statusCode = 404;
    throw missing;
  }
  if (!canVerifyBatch(actor, batch)) {
    const forbidden = new Error('You are not allowed to review this tally batch.');
    forbidden.statusCode = 403;
    throw forbidden;
  }
  if (batch.status !== 'pending') {
    const invalid = new Error('Only pending tally batches can be reviewed.');
    invalid.statusCode = 409;
    throw invalid;
  }

  return sequelize.transaction(async (transaction) => {
    if (value.decision === 'verify') {
      await TallyBatch.update({ status: 'superseded' }, {
        where: {
          id: { $ne: batch.id },
          StationId: batch.StationId,
          electionCode: batch.electionCode,
          status: 'verified'
        },
        transaction
      });
      batch.status = 'verified';
      batch.verified_by_id = actor.id;
      batch.verifiedAt = new Date();
      batch.rejectionReason = null;
    } else {
      batch.status = 'rejected';
      batch.verified_by_id = actor.id;
      batch.verifiedAt = new Date();
      batch.rejectionReason = value.reason || 'Rejected by supervisor.';
    }

    await batch.save({ transaction });

    await EventOutbox.create({
      type: value.decision === 'verify' ? 'tally.verified' : 'tally.rejected',
      aggregateType: 'TallyBatch',
      aggregateId: String(batch.id),
      payload: { batchId: batch.id, decision: value.decision, reviewerId: actor.id }
    }, { transaction });

    await audit({
      actor,
      action: value.decision === 'verify' ? 'tally.verified' : 'tally.rejected',
      entity: 'TallyBatch',
      entityId: batch.id,
      sourceIp,
      traceId,
      details: { decision: value.decision, reason: value.reason || null },
      transaction
    });

    return { batchId: batch.id, status: batch.status };
  });
}

module.exports = { reviewTallyCommand };
