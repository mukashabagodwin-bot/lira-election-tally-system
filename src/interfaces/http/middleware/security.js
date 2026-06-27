const crypto = require('crypto');
const env = require('../../../config/env');
const { ipAllowed } = require('../../../infrastructure/security/ip');

function gatewayFilter(req, res, next) {
  const gatewayIp = req.ip;
  if (!ipAllowed(gatewayIp, env.gatewayAllowedCidrs)) {
    return res.status(403).json({ error: 'Gateway IP is not trusted.' });
  }
  next();
}

function requireIdempotencyKey(req, res, next) {
  if (req.method !== 'POST' || !req.path.startsWith('/tallies')) return next();
  req.idempotencyKey = req.get('idempotency-key') || req.body.requestId || crypto.randomUUID();
  next();
}

function exposeLocals(req, res, next) {
  res.locals.path = req.path;
  res.locals.csrfToken = typeof req.csrfToken === 'function' ? req.csrfToken() : '';
  res.locals.flash = req.session ? req.session.flash : null;
  if (req.session) delete req.session.flash;
  next();
}

module.exports = { gatewayFilter, requireIdempotencyKey, exposeLocals };
