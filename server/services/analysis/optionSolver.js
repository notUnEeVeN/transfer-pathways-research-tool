/**
 * Option-tree solver — the combinatorial core of the pathway analyses.
 *
 * A Receiver carries `options` (alternative CC paths) with two conjunction
 * layers (see DATABASE_DOCUMENTATION.md):
 *   option.course_conjunction  'and' → ALL course_ids in the option
 *                              'or'  → ANY ONE course_id
 *   options_conjunction        'and' → ALL options       'or' → ANY ONE option
 *
 * The analyses need, per agreement, the MINIMAL set of CC courses that
 * satisfies the required receivers ("what would a transfer-bound student
 * actually take") — the same best-case-scenario framing both transfer-pathway
 * papers use. Exact minimization over shared courses is set-cover (NP-hard),
 * so we use an overlap-aware greedy: receivers are processed smallest-first,
 * and each picks the alternative with the fewest courses NOT already chosen.
 * At ASSIST scale (a handful of alternatives per receiver) this matches the
 * exact answer in practice and is deterministic.
 *
 * Advisements: `section_advisement` = "satisfy N receivers of this section",
 * `group_advisement` = "N receivers across the group"; a group_conjunction of
 * 'Or' means one section suffices. We satisfy the cheapest N (by marginal
 * cost) — the optimal-pathway assumption. Unit advisements are ignored here
 * (course-count analyses); unit accounting happens in the callers that join
 * against `courses.units`.
 */

// Alternative course sets (arrays of course_id strings) that satisfy ONE
// option row, honoring course_conjunction.
function optionAlternatives(option) {
  const ids = (option.course_ids || []).map(String);
  if (!ids.length) return [];
  if (option.course_conjunction === 'or') return ids.map((id) => [id]);
  return [ids]; // 'and' (default): the whole list, together
}

// Alternative course sets satisfying a RECEIVER, honoring options_conjunction.
// Returns [] when the receiver is not articulated (no path exists).
function receiverAlternatives(receiver) {
  if (receiver.articulation_status !== 'articulated') return [];
  const options = receiver.options || [];
  if (!options.length) return [];
  const perOption = options.map(optionAlternatives).filter((alts) => alts.length);
  if (!perOption.length) return [];

  if (receiver.options_conjunction === 'and' && perOption.length > 1) {
    // Every option must be satisfied: combine one alternative from each.
    // Cap the cartesian product; beyond the cap collapse each option to its
    // smallest alternative (a safe upper-bound choice).
    const CAP = 64;
    let combos = [[]];
    for (const alts of perOption) {
      const next = [];
      for (const combo of combos) {
        for (const alt of alts) {
          next.push([...combo, ...alt]);
          if (next.length > CAP) break;
        }
        if (next.length > CAP) break;
      }
      combos = next.length > CAP
        ? [perOption.map((a) => a.reduce((m, x) => (x.length < m.length ? x : m))).flat()]
        : next;
    }
    return combos.map((c) => [...new Set(c)]);
  }

  // 'or' (default): any one option's alternatives, flattened.
  return perOption.flat().map((alt) => [...new Set(alt)]);
}

// Marginal cost of an alternative given already-chosen courses.
const marginal = (alt, chosen) => alt.filter((id) => !chosen.has(id)).length;

// Pick the cheapest alternative for a receiver given `chosen`; returns
// { alt, cost } or null when unsatisfiable.
function cheapestAlternative(receiver, chosen) {
  const alts = receiverAlternatives(receiver);
  if (!alts.length) return null;
  let best = null;
  for (const alt of alts) {
    const cost = marginal(alt, chosen);
    if (!best || cost < best.cost || (cost === best.cost && alt.length < best.alt.length)) {
      best = { alt, cost };
    }
  }
  return best;
}

// Satisfy `need` receivers out of `receivers` (cheapest-first), mutating
// `chosen` and appending {r, alt} picks to `picks`. Returns the number
// satisfied; receivers with no articulated path are appended to `blocked`.
function satisfyN(receivers, need, chosen, blocked, picks) {
  const candidates = receivers
    .map((r) => ({ r, best: cheapestAlternative(r, chosen) }))
    .filter((c) => {
      if (!c.best) { blocked.push(c.r); return false; }
      return true;
    })
    .sort((a, b) => a.best.cost - b.best.cost);

  let satisfied = 0;
  for (const c of candidates) {
    if (satisfied >= need) break;
    // Re-evaluate: earlier picks may have made this receiver cheaper/free.
    const best = cheapestAlternative(c.r, chosen);
    if (!best) continue;
    best.alt.forEach((id) => chosen.add(id));
    picks.push({ r: c.r, alt: best.alt });
    satisfied += 1;
  }
  return satisfied;
}

// Local-improvement pass over the greedy solution: re-pick each receiver's
// alternative against everyone ELSE's final choices, until stable. Fixes the
// classic greedy trap where a standalone-cheap alternative is taken before
// the shared multi-course alternative it should have piggybacked on.
function improvePicks(picks) {
  for (let pass = 0; pass < 4; pass++) {
    let changed = false;
    for (const p of picks) {
      const others = new Set(picks.filter((x) => x !== p).flatMap((x) => x.alt));
      const best = cheapestAlternative(p.r, others);
      if (best && marginal(best.alt, others) < marginal(p.alt, others)) {
        p.alt = best.alt;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return new Set(picks.flatMap((p) => p.alt));
}

/**
 * Minimal CC course set satisfying an agreement's requirements.
 *
 * opts.requiredOnly (default true) — only groups with is_required.
 * opts.isExcluded(receiver)        — curation hook: skip a receiver entirely
 *                                    (e.g. judged "recommended, not required").
 *
 * Returns {
 *   courses:            string[] (course_ids, sorted),
 *   receiversConsidered, receiversSatisfied,
 *   blockedReceivers:   [{ hash_id, receiving }] with NO articulated path —
 *                       the agreement cannot be fully completed at this CC,
 * }
 */
function agreementMinSet(agreement, opts = {}) {
  const { requiredOnly = true, isExcluded = () => false } = opts;
  let chosen = new Set();
  const blocked = [];
  const picks = [];
  let considered = 0;
  let satisfied = 0;

  for (const group of agreement.requirement_groups || []) {
    if (requiredOnly && group.is_required === false) continue;
    const sections = group.sections || [];

    // Collect per-section receiver lists (minus curation-excluded ones).
    const sectionReceivers = sections.map((s) =>
      (s.receivers || []).filter((r) => !isExcluded(r))
    );
    const flat = sectionReceivers.flat();
    considered += flat.length;

    if (group.group_advisement != null) {
      // N receivers across the whole group.
      satisfied += satisfyN(flat, group.group_advisement, chosen, blocked, picks);
      continue;
    }

    if (group.group_conjunction === 'Or' && sections.length > 1) {
      // One section suffices: cost each section fully (against the current
      // chosen set), take the cheapest satisfiable one.
      let best = null;
      for (let i = 0; i < sections.length; i++) {
        const trial = new Set(chosen);
        const trialBlocked = [];
        const trialPicks = [];
        const receivers = sectionReceivers[i];
        const need = sections[i].section_advisement ?? receivers.length;
        const got = satisfyN(receivers, need, trial, trialBlocked, trialPicks);
        if (got < Math.min(need, receivers.length)) continue; // not fully satisfiable
        const cost = trial.size - chosen.size;
        if (!best || cost < best.cost) best = { cost, trial, got, picks: trialPicks };
      }
      if (best) {
        best.trial.forEach((id) => chosen.add(id));
        picks.push(...best.picks);
        satisfied += best.got;
      } else {
        // No section fully satisfiable — count the cheapest section's blocks.
        const receivers = sectionReceivers[0] || [];
        const need = sections[0]?.section_advisement ?? receivers.length;
        satisfied += satisfyN(receivers, need, chosen, blocked, picks);
      }
      continue;
    }

    // Default: every section, each honoring its own advisement.
    for (let i = 0; i < sections.length; i++) {
      const receivers = sectionReceivers[i];
      const need = sections[i].section_advisement ?? receivers.length;
      satisfied += satisfyN(receivers, need, chosen, blocked, picks);
    }
  }

  chosen = improvePicks(picks);

  return {
    courses: [...chosen].sort(),
    receiversConsidered: considered,
    receiversSatisfied: satisfied,
    blockedReceivers: blocked.map((r) => ({ hash_id: r.hash_id, receiving: r.receiving })),
  };
}

// Count receivers whose CHEAPEST standalone path still takes >1 CC course —
// the papers' "many-to-one credit loss" (several CC courses for one
// university requirement).
function manyToOneCount(agreement, opts = {}) {
  const { requiredOnly = true, isExcluded = () => false } = opts;
  let count = 0;
  for (const group of agreement.requirement_groups || []) {
    if (requiredOnly && group.is_required === false) continue;
    for (const section of group.sections || []) {
      for (const r of section.receivers || []) {
        if (isExcluded(r)) continue;
        const best = cheapestAlternative(r, new Set());
        if (best && best.alt.length > 1) count += 1;
      }
    }
  }
  return count;
}

module.exports = {
  optionAlternatives,
  receiverAlternatives,
  agreementMinSet,
  manyToOneCount,
};
