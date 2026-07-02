// Wrap an async route handler so any rejection is forwarded to Express's error
// middleware instead of crashing the process or leaking a raw stack to the
// client. Lets handlers drop their boilerplate try/catch + 500 responses.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { asyncHandler };
