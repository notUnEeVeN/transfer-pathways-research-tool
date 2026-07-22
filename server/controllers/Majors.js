/**
 * The onboarded majors and their per-major metadata, for the frontend.
 *
 * Read-only projection of config/majors.js. The frontend fetches this once and
 * builds its major pickers from it, so there is no mirrored client-side copy of
 * the program pins, categories, or capability flags.
 */
const { asyncHandler } = require('../middleware/asyncHandler');
const { serializeMajors, defaultMajor } = require('../config/majors');

exports.listMajorsEndpoint = asyncHandler(async (req, res) => {
  res.json({ majors: serializeMajors(), default: defaultMajor().slug });
});
