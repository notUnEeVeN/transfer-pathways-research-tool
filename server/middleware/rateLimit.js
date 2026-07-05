const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Loopback = the figure runner's sandboxed scripts calling back into this
// same server (external clients arrive through the platform proxy and carry
// their real IP via trust-proxy). Runner traffic is already bounded by the
// run queue + timeouts; sharing the limiter buckets with it would let a
// refresh sweep 429 real users — or fail scripts into the auto-disable
// breaker.
const isLoopback = (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1';

// Per-IP global limiter applied to every request. Catches unauthenticated
// abuse and bad-token DoS attempts that don't reach the per-UID limiter.
const globalIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isLoopback,
  message: { error: 'Too many requests from this IP. Please slow down.' },
});

// Per-UID limiter for authenticated routes. Falls back to a normalized IP key
// (IPv6-safe) if no user is attached. Ephemeral runner tokens are exempt so a
// data-hungry live script can't burn its author's own budget.
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!req.user?.ephemeral_token,
  message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { globalIpLimiter, userLimiter };
