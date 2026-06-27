require('dotenv').config();
const path = require('path');

function bool(value, fallback) {
  if (value === undefined) return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function csv(value, fallback) {
  const raw = value || fallback || '';
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || 'sqlite:./data/lira-election.sqlite',
  sessionSecret: process.env.SESSION_SECRET || 'development-only-change-this-secret',
  cookieSecure: bool(process.env.COOKIE_SECURE, false),
  jwtIssuer: process.env.JWT_ISSUER || 'lira-election-tally',
  jwtAudience: process.env.JWT_AUDIENCE || 'lira-election-api',
  jwtPrivateKeyPath: path.resolve(process.cwd(), process.env.JWT_PRIVATE_KEY_PATH || './keys/dev-rs256-private.pem'),
  jwtPublicKeyPath: path.resolve(process.cwd(), process.env.JWT_PUBLIC_KEY_PATH || './keys/dev-rs256-public.pem'),
  trustedProxyHops: Number(process.env.TRUSTED_PROXY_HOPS || 1),
  gatewayAllowedCidrs: csv(process.env.GATEWAY_ALLOWED_CIDRS, '127.0.0.1/32,::1/128'),
  rateLimitTokensPerMinute: Number(process.env.RATE_LIMIT_TOKENS_PER_MINUTE || 120),
  leakyBucketQueue: Number(process.env.LEAKY_BUCKET_QUEUE || 40),
  idempotencyTtlSeconds: Number(process.env.IDEMPOTENCY_TTL_SECONDS || 86400),
  enableFederatedIdentity: bool(process.env.ENABLE_FEDERATED_IDENTITY, false)
};
