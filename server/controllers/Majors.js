/**
 * The onboarded majors and their per-major metadata, for the frontend.
 *
 * Read-only projection of config/majors.js. The frontend fetches this once and
 * builds its major pickers from it, so there is no mirrored client-side copy of
 * the program pins, categories, or capability flags.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { serializeMajors, defaultMajor, listMajors } = require('../config/majors');

// Every state that has a configured major, derived rather than listed, so a
// new state corpus serves its registry the moment it lands in config.
// California is the unstamped default registry and carries no `state`.
const configuredStates = () => new Set([
  'ca',
  ...listMajors({ includeStates: true }).map((major) => major.state).filter(Boolean),
]);

exports.listMajorsEndpoint = asyncHandler(async (req, res) => {
  // No state (the default) serves the unstamped California registry; a state
  // serves that corpus's majors so state pages read the same config the
  // analyses run on (no client-side mirror). The default slug is per-corpus.
  const state = String(req?.query?.state || '').trim().toLowerCase();
  const known = configuredStates();
  if (state && !known.has(state)) {
    return res.status(400).json({ error: `state must be one of: ${[...known].sort().join(', ')}` });
  }
  const majors = serializeMajors(state && state !== 'ca' ? { state } : {});
  const fallback = majors[0]?.slug || defaultMajor().slug;
  res.json({ majors, default: state && state !== 'ca' ? fallback : defaultMajor().slug });
});
