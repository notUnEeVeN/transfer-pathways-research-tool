const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Per-IP global limiter applied to every request. Catches unauthenticated
// abuse and bad-token DoS attempts that don't reach the per-UID limiter.
const globalIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP. Please slow down.' },
});

// Per-UID limiter for authenticated routes. Falls back to a normalized IP key
// (IPv6-safe) if no user is attached.
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  keyGenerator: (req) => req.user?.uid || ipKeyGenerator(req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { globalIpLimiter, userLimiter };
