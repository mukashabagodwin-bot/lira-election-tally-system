const { User } = require('../../../infrastructure/orm/database');
const { verifyPassword } = require('../../../infrastructure/security/passwords');
const { signApiToken } = require('../../../infrastructure/security/tokens');
const { audit } = require('../../../infrastructure/observability/logger');

function loginPage(req, res) {
  res.render('auth/login', { title: 'Sign in' });
}

async function login(req, res, next) {
  try {
    const user = await User.findOne({ where: { email: String(req.body.email || '').toLowerCase().trim(), active: true } });
    const valid = user ? await verifyPassword(req.body.password || '', user.passwordHash) : false;
    if (!valid) {
      req.session.flash = { type: 'danger', message: 'Invalid email or password.' };
      return res.redirect('/login');
    }
    req.session.userId = user.id;
    await audit({ actor: user, action: 'identity.login', entity: 'User', entityId: user.id, sourceIp: req.originatingIp, traceId: req.traceId });
    return res.redirect('/');
  } catch (error) {
    next(error);
  }
}

function logout(req, res) {
  req.session.destroy(() => res.redirect('/login'));
}

function issueToken(req, res) {
  res.json({ token: signApiToken(req.user), algorithm: 'RS256', expiresIn: '15m' });
}

module.exports = { loginPage, login, logout, issueToken };
