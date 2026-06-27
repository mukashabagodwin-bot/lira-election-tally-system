const env = require('../../config/env');

const buckets = new Map();
const inFlight = new Map();

function refill(bucket, now, capacity, perMinute) {
  const elapsedMs = now - bucket.updatedAt;
  const refillTokens = (elapsedMs / 60000) * perMinute;
  bucket.tokens = Math.min(capacity, bucket.tokens + refillTokens);
  bucket.updatedAt = now;
}

function tokenBucketAllowed(key, capacity, perMinute) {
  const now = Date.now();
  const bucket = buckets.get(key) || { tokens: capacity, updatedAt: now };
  refill(bucket, now, capacity, perMinute);
  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

function trafficSmoothing() {
  return (req, res, next) => {
    const actor = req.user ? req.user.id : 'anonymous';
    const key = [req.ip, actor, req.path].join(':');
    const capacity = env.rateLimitTokensPerMinute;
    if (!tokenBucketAllowed(key, capacity, capacity)) {
      return res.status(429).json({ error: 'Too many requests. Token bucket limit exceeded.' });
    }

    const current = inFlight.get(key) || 0;
    if (current >= env.leakyBucketQueue) {
      return res.status(429).json({ error: 'Too many in-flight requests. Leaky bucket queue is full.' });
    }
    inFlight.set(key, current + 1);
    res.on('finish', () => {
      inFlight.set(key, Math.max(0, (inFlight.get(key) || 1) - 1));
    });
    next();
  };
}

module.exports = { trafficSmoothing, tokenBucketAllowed };
