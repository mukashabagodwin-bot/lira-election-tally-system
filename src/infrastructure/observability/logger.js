const { AuditLog } = require('../orm/database');
const { normalizeIp } = require('../security/ip');

function jsonLog(level, event, fields = {}) {
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields
  };
  console.log(JSON.stringify(line));
}

async function audit({ actor, action, entity, entityId, sourceIp, traceId, details, transaction }) {
  const row = {
    actor_id: actor ? actor.id : null,
    role: actor ? actor.role : 'system',
    action,
    entity,
    entityId: entityId ? String(entityId) : null,
    sourceIp: normalizeIp(sourceIp || 'unknown'),
    traceId: traceId || 'missing-trace',
    details: details || {}
  };
  jsonLog('info', 'audit.' + action, row);
  return AuditLog.create(row, { transaction });
}

module.exports = { jsonLog, audit };
