const { User, District, Constituency, Station } = require('../../../infrastructure/orm/database');
const { verifyApiToken } = require('../../../infrastructure/security/tokens');
const { hasPermission, userAllowedFromIp } = require('../../../infrastructure/security/policies');

async function findByPrimaryKey(model, id, options) {
  if (typeof model.findByPk === 'function') return model.findByPk(id, options);
  return model.findById(id, options);
}

async function loadUser(id) {
  if (!id) return null;
  return findByPrimaryKey(User, id, { include: [District, Constituency, Station] });
}

async function attachIdentity(req, res, next) {
  try {
    req.user = null;
    if (req.session && req.session.userId) {
      req.user = await loadUser(req.session.userId);
    }

    const auth = req.get('authorization') || '';
    if (!req.user && auth.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length);
      const claims = verifyApiToken(token);
      req.user = await loadUser(claims.sub);
    }

    if (req.user && !userAllowedFromIp(req.user, req.originatingIp || req.ip)) {
      req.user = null;
      return res.status(403).render('error', { title: 'Access blocked', message: 'This account cannot be used from the current network.' });
    }

    res.locals.user = req.user;
    next();
  } catch (error) {
    next(error);
  }
}

function wantsJson(req) {
  return req.path.startsWith('/api') || (req.get('accept') || '').includes('application/json');
}

function requireAuth(req, res, next) {
  if (req.user && req.user.active) return next();
  if (wantsJson(req)) return res.status(401).json({ error: 'Authentication required.' });
  return res.redirect('/login');
}

function requirePermission(permission) {
  return (req, res, next) => {
    if (hasPermission(req.user, permission)) return next();
    if (wantsJson(req)) return res.status(403).json({ error: 'Permission denied.' });
    return res.status(403).render('error', { title: 'Permission denied', message: 'You do not have access to this action.' });
  };
}

module.exports = { attachIdentity, requireAuth, requirePermission };
