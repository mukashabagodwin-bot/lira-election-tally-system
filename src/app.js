const path = require('path');
const express = require('express');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const helmet = require('helmet');
const morgan = require('morgan');
const csrf = require('csurf');
const env = require('./config/env');
const { sequelize } = require('./infrastructure/orm/database');
const { trafficSmoothing } = require('./infrastructure/security/rateLimiter');
const { traceMiddleware } = require('./infrastructure/observability/tracing');
const { jsonLog } = require('./infrastructure/observability/logger');
const { attachIdentity } = require('./interfaces/http/middleware/auth');
const { requireIdempotencyKey, exposeLocals } = require('./interfaces/http/middleware/security');
const routes = require('./interfaces/http/routes');

const app = express();
const sessionStore = new SequelizeStore({ db: sequelize });

app.set('trust proxy', env.trustedProxyHops);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('combined'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));
app.use(session({
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    maxAge: 1000 * 60 * 60 * 8
  }
}));
app.use(traceMiddleware);
app.use(attachIdentity);
app.use(trafficSmoothing());
app.use(requireIdempotencyKey);
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return csrf()(req, res, next);
});
app.use(exposeLocals);
app.use(routes);

app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Not found',
    message: 'The requested page was not found.',
    user: res.locals.user || null,
    path: req.path,
    csrfToken: res.locals.csrfToken || '',
    flash: res.locals.flash || null
  });
});

app.use((error, req, res, next) => {
  const status = error.statusCode || error.status || 500;
  jsonLog(status >= 500 ? 'error' : 'warn', 'http.error', {
    traceId: req.traceId,
    path: req.path,
    status,
    message: error.message,
    stack: env.nodeEnv === 'development' ? error.stack : undefined
  });
  if (req.path.startsWith('/api')) return res.status(status).json({ error: error.message, traceId: req.traceId });
  return res.status(status).render('error', {
    title: 'Request failed',
    message: error.message,
    traceId: req.traceId,
    user: res.locals.user || null,
    path: req.path,
    csrfToken: res.locals.csrfToken || '',
    flash: res.locals.flash || null
  });
});

app.locals.sessionStore = sessionStore;
module.exports = app;
