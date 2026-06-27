const crypto = require('crypto');
const { normalizeIp } = require('../security/ip');

function traceMiddleware(req, res, next) {
  const inbound = req.get('traceparent') || req.get('x-request-id');
  req.traceId = inbound || crypto.randomUUID();
  const forwardedIp = req.get('x-forwarded-for') ? req.get('x-forwarded-for').split(',')[0].trim() : null;
  req.originatingIp = normalizeIp(forwardedIp || req.ip);
  res.setHeader('x-trace-id', req.traceId);
  next();
}

module.exports = { traceMiddleware };
