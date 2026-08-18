/**
 * A counter that advances whenever hand-curated research data is written.
 *
 * The analysis endpoints memoize their results for a minute, which is right for
 * a figure being read repeatedly and wrong the moment somebody edits the data
 * underneath it: the client dutifully invalidates and refetches, and the server
 * hands back the pre-edit rows from its own cache. The client then treats that
 * answer as fresh — so a save could be visibly ignored for a full minute, and
 * for a whole session once analyses started being held for one.
 *
 * Folding this counter into the cache key makes a curated write invalidate the
 * server's cache the same way it already invalidates the browser's. It is
 * process-local and deliberately not persisted: it only has to be monotonic
 * within the lifetime of the cache it guards, and a restart empties that cache
 * anyway.
 *
 * One counter rather than one per collection: curated edits are rare and
 * analyses are cheap to recompute, so the simpler invariant — any curated write
 * makes every analysis recompute once — is worth more than the extra hit rate.
 */
let epoch = 0;

/** Call after any write to hand-curated research data. */
function bumpCurationEpoch() {
  epoch += 1;
  return epoch;
}

function curationEpoch() {
  return epoch;
}

module.exports = { bumpCurationEpoch, curationEpoch };
