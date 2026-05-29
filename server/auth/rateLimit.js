/**
 * In-memory rate limiter for auth endpoints (single-instance; use Redis for multi-instance scale-out).
 */
const buckets = new Map();

function pruneBucket(bucket, windowMs, now) {
  while (bucket.length && now - bucket[0] > windowMs) {
    bucket.shift();
  }
}

function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  maxAttempts = 10,
  keyFn = (req) => req.ip || req.socket?.remoteAddress || 'unknown',
} = {}) {
  return function rateLimit(req, res, next) {
    const key = keyFn(req);
    const now = Date.now();
    if (!buckets.has(key)) buckets.set(key, []);
    const bucket = buckets.get(key);
    pruneBucket(bucket, windowMs, now);

    if (bucket.length >= maxAttempts) {
      const retryAfterSec = Math.ceil((windowMs - (now - bucket[0])) / 1000);
      res.setHeader('Retry-After', String(Math.max(retryAfterSec, 1)));
      return res.status(429).json({ ok: false, error: 'rate_limit_exceeded' });
    }

    bucket.push(now);
    next();
  };
}

const pinLoginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
});

function checkRateLimit(req, limiter = pinLoginRateLimit) {
  let blocked = false;
  let statusCode = 429;
  let body = { ok: false, error: 'rate_limit_exceeded' };
  limiter(req, {
    status(code) { statusCode = code; return this; },
    setHeader() { return this; },
    json(payload) { blocked = true; body = payload; return this; },
  }, () => {});
  return blocked ? { blocked: true, statusCode, body } : { blocked: false };
}

module.exports = {
  createRateLimiter,
  pinLoginRateLimit,
  checkRateLimit,
};
