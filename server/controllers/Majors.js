/**
 * The onboarded majors and their per-major metadata, for the frontend.
 *
 * Read-only projection of config/majors.js. The frontend fetches this once and
 * builds its major pickers from it, so there is no mirrored client-side copy of
 * the program pins, categories, or capability flags.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { serializeMajors, defaultMajor, listMajors } = require('../config/majors');
const {
  VA_ANALYSIS_PUBLICATION_CONTRACT,
  virginiaAnalysisPublicationStatus,
} = require('../services/virginia/analysisPublicationGate');

// Every state that has a configured major, derived rather than listed, so a
// new state corpus serves its registry the moment it lands in config.
// California is the unstamped default registry and carries no `state`.
// 'all' is not a corpus: it is the cross-state registry the compare tab's pane
// picker reads, and it has to be listed here because this gate runs before
// serializeMajors ever sees the value.
const configuredStates = () => new Set([
  'ca', 'all',
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
  const configured = serializeMajors(state && state !== 'ca' ? { state } : {});
  const majors = await Promise.all(configured.map(async (major) => {
    const gate = major?.publicationGate;
    if (!gate) return major;
    const analysisPublication = gate.contract === VA_ANALYSIS_PUBLICATION_CONTRACT
      ? await virginiaAnalysisPublicationStatus(req?.app?.locals?.db)
      : {
        ready: false,
        blocker: 'analysis_publication_gate_configuration_error',
        contract: gate.contract || null,
        major_slug: major.slug,
        generation_id: null,
        issues: [{ code: 'unsupported_publication_gate_contract' }],
      };
    return { ...major, analysisPublication };
  }));
  const fallback = majors[0]?.slug || defaultMajor().slug;
  res.json({ majors, default: state && state !== 'ca' ? fallback : defaultMajor().slug });
});
