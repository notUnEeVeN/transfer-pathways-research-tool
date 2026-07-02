// Central Express error middleware. Logs the real error server-side (with the
// request method + path for context) and returns a generic message to the
// client so driver/internal details never leak. Handlers that
// want a specific client-facing status can throw an error carrying `statusCode`
// (and an explicit `expose: true` to surface its message for 4xx).

function errorHandler(err, req, res, next) {
  // Delegate to Express's default handler if the response has already started.
  if (res.headersSent) return next(err);

  const status = err.statusCode || err.status || 500;
  console.error(`[${req.method} ${req.originalUrl}]`, err);

  // Only expose messages for deliberate client errors; never for 5xx.
  const message = status < 500 && (err.expose || err.statusCode) ? err.message : 'Something went wrong. Please try again.';

  res.status(status).json({ error: message });
}

module.exports = { errorHandler };
