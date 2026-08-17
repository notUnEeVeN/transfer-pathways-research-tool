/**
 * Turn a stored (agreement-shaped) degree into a readable, grouped view for the
 * Data → Degree reqs template and the "4-year degree" evaluation.
 *
 * Coverage sources, in order:
 *   - major-prep course receivers → the college's real ASSIST articulation
 *     (parent_id in `articulated`), with the CC course(s) that satisfy it.
 *   - GE / breadth (R&C, H/SS) → the college's own course GE-area tags. ASSIST's
 *     major-prep agreements don't carry English/H/SS, but every CC course records
 *     its igetc_area, so R&C = a CC course in IGETC 1A/1B and H/SS = the CC's
 *     Area 3 (Arts & Humanities) + Area 4 (Social & Behavioral Sciences) courses.
 *   - `assume_satisfiable` (American History & Institutions) → counted satisfiable
 *     everywhere: it's UC-required and a qualifying course exists at every CC.
 *   - non-transferable (upper-division / residency) → never satisfiable.
 *
 * Counting mirrors the choose-N engine: a section asks for `section_advisement`
 * slots and a college covers min(available, ask) of them. Coverage is also
 * weighted by each section's authored unit total (or the documented four-unit
 * estimate), which is the primary graduation-coverage measure.
 */

const TIERS = ['transferable', 'breadth', 'nontransferable'];

const codeOf = (c) => `${c.prefix} ${c.number}`.trim();

// A receiver's university parent_ids: one for a course, several for a series
// ("A and B and C" taken in its entirety). A series is articulated only when
// EVERY course in it articulates.
const receiverPids = (rec) => (
  rec?.kind === 'series'
    ? (rec.parent_ids || []).map(Number)
    : rec?.parent_id != null ? [Number(rec.parent_id)] : []
);
const receiverArticulated = (rec, articulated) => {
  const pids = receiverPids(rec);
  return pids.length > 0 && pids.every((pid) => articulated.has(pid));
};

function ccCodes(options, coursesById) {
  const codes = [];
  for (const o of options || []) {
    for (const cid of o.course_ids || []) {
      const c = coursesById.get(Number(cid));
      codes.push(c ? codeOf(c) : `#${cid}`);
    }
  }
  return codes;
}

// The college's courses (as {course_id, prefix, number}) that carry any of the
// given IGETC areas, deduped.
function geCoverCourses(areas, ccGeAreas) {
  if (!ccGeAreas) return [];
  const seen = new Set();
  const out = [];
  for (const a of areas || []) {
    for (const c of ccGeAreas.get(a) || []) {
      if (seen.has(c.course_id)) continue;
      seen.add(c.course_id);
      out.push(c);
    }
  }
  return out;
}

/**
 * `overrides` — `{ [parent_id]: units }` supplied by a degree document.
 *
 * ASSIST mirrors what a campus reported to it, which is occasionally behind the
 * campus's own catalog. Berkeley publishes Chem 3A and 3B at 4 units; ASSIST
 * still records 3. Correcting the mirror would diverge from upstream and be
 * undone by the next import, so the document that noticed the discrepancy
 * carries the correction and states its source. Everything else still comes
 * from ASSIST.
 */
async function loadUniversityCourses(db, requirementGroups, overrides = null) {
  const parentIds = new Set();
  for (const g of requirementGroups || []) {
    for (const s of g.sections || []) {
      for (const r of s.receivers || []) {
        for (const pid of receiverPids(r.receiving)) parentIds.add(pid);
      }
    }
  }
  const out = {};
  if (parentIds.size) {
    const rows = await db.collection('assist_courses')
      .find({ side: 'receiving', parent_id: { $in: [...parentIds] } },
        { projection: { parent_id: 1, prefix: 1, number: 1, title: 1, min_units: 1, max_units: 1, _id: 0 } })
      .toArray();
    for (const c of rows) out[Number(c.parent_id)] = c;
  }
  for (const [pid, units] of Object.entries(overrides || {})) {
    const row = out[Number(pid)];
    if (!row || !Number.isFinite(Number(units))) continue;
    out[Number(pid)] = { ...row, min_units: Number(units), max_units: Number(units), units_overridden: true };
  }
  return out;
}

/**
 * ASSIST block names as a comparison key. Whitespace and case vary between a
 * curated template and the parsed agreement, and neither is meaningful.
 */
function normalizeRequirementName(value) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  return text || null;
}

/**
 * The Massachusetts paper's published measure (final SIGCSE submission,
 * Figure 1): required COURSES at every level — department, college, or campus
 * — with general education excluded, binary articulated-or-not per course.
 * Upper-division requirements rarely articulate, which is exactly why their
 * statewide average is 38.2%.
 *
 * Counting is per course, never per requirement slot: a "one complete series"
 * requirement of three courses is three, and an articulated series covers all
 * of them (series articulation is all-or-nothing). A choose-N pool prices the
 * N cheapest alternatives. Course counts come, in order, from: the choose-N
 * ask; the enumerated receivers with series expanded; a stated
 * section_advisement; the four-unit assumption over an authored unit total
 * (two Berkeley "coursework outside the major" blocks are the only such
 * sections in the corpus); the receiver count.
 *
 * Excluded as GE: the breadth tier, ge_area receivers, GE-area fallbacks on
 * course receivers (Berkeley's R&C), assumed-satisfiable overlays (AH&I,
 * elective capacity), and GE-titled blocks. A bare "GE" only marks a block as
 * general education when it NAMES the block ("GE: Crossroads…"), never when a
 * major group notes double-counting ("also satisfies GE…"); the loose
 * word-match applies only on the university-only tier, where annotations do
 * not occur but "Upper-division campus GE experiences" does. Excluded as
 * padding: free-elective blocks that exist only to reach the unit total —
 * room, not requirements.
 */
const NAMED_GE_TITLE = /^\s*GE\b|general education|american cultures|american history/i;
const NAMED_PADDING_TITLE = /unrestricted electives?|free electives?|elective capacity|elective units|elective credits|transfer cap reached|to reach the \d+/i;
// The loose word-match on the university-only tier reads only the title HEAD
// — the part before an em dash or parenthesis. Annotations routinely mention
// GE while describing major coursework ("Upper-division major coursework —
// 17 courses (incl. I&C SCI 139W = GE writing…)"), and matching the whole
// title GE-excluded Irvine's and Merced's entire upper divisions from the
// coverage denominator while every other campus counted theirs. A block that
// IS university GE names it in the head ("Upper-division campus GE
// experiences") and still matches.
const titleHead = (title) => String(title || '').split(/\s+[—–]\s+|\(/)[0];
const namedGeTitled = (g, s) => NAMED_GE_TITLE.test(String(g.title || ''))
  || (resolveSectionTier(g, s) === 'nontransferable' && /\bGE\b/.test(titleHead(g.title)));
const namedPadding = (g) => NAMED_PADDING_TITLE.test(String(g.title || ''));
const namedGeFlavored = (g, s) => namedGeTitled(g, s)
  || resolveSectionTier(g, s) === 'breadth'
  || s.assume_satisfiable
  || (Array.isArray(s.ge_areas) && s.ge_areas.length > 0)
  || (s.receivers || []).some((r) => r.receiving?.kind === 'ge_area'
    || r.assume_satisfiable
    || (Array.isArray(r.ge_areas) && r.ge_areas.length));
// A requirement the SOURCE itself says no community college can satisfy —
// senior residency work, capstones taken in the major department — is not an
// articulation failure; it is not an articulation question at all. Counting it
// in the denominator asks "can a community college teach the senior year",
// which caps the figure far below 100% for structural reasons and makes two
// corpora incomparable whenever they enumerate upper-division work to
// different depths. Virginia flags 238 of its 613 sections this way; the
// Massachusetts corpus flags none, so its figure is unchanged.
const notCollegeArticulable = (s) => s.cc_articulable === false;
const inNamedRequirementPopulation = (g, s) => !namedPadding(g)
  && !namedGeFlavored(g, s)
  && !notCollegeArticulable(s);

function namedRequirementCourses(requirementGroups, { articulated = null, articulatedRequirements = null } = {}) {
  const evaluated = articulated != null;
  const expansion = (r) => (r.receiving?.kind === 'series'
    ? (r.receiving.parent_ids || []).length || 1
    : 1);
  const blockSatisfied = (declared) => {
    const names = (Array.isArray(declared) ? declared : [declared])
      .map(normalizeRequirementName)
      .filter(Boolean);
    return names.length > 0 && names.every((name) => articulatedRequirements?.has(name));
  };

  const sectionCourses = (g, s) => {
    const recvs = s.receivers || [];
    const ask = s.section_advisement;
    const groupBlock = evaluated && blockSatisfied(g.assist_requirement);
    const recvCovered = (r) => groupBlock
      || (evaluated && (receiverArticulated(r.receiving, articulated)
        || (r.assist_requirement && blockSatisfied(r.assist_requirement))));

    if (ask != null && Number(ask) < recvs.length) {
      // Choose-N: the requirement costs the N cheapest alternatives; covered
      // by articulated picks, clamped so a longer articulated path cannot
      // exceed the priced ask.
      const n = Math.max(0, Number(ask));
      const cheapestFirst = [...recvs].sort((a, b) => expansion(a) - expansion(b));
      const total = cheapestFirst.slice(0, n).reduce((sum, r) => sum + expansion(r), 0);
      const covered = cheapestFirst.filter(recvCovered).slice(0, n)
        .reduce((sum, r) => sum + expansion(r), 0);
      return { total, covered: Math.min(total, covered) };
    }
    const enumerated = recvs.length > 0
      && recvs.every((r) => ['course', 'series'].includes(r.receiving?.kind));
    if (enumerated) {
      const total = recvs.reduce((sum, r) => sum + expansion(r), 0);
      const covered = recvs.reduce((sum, r) => sum + (recvCovered(r) ? expansion(r) : 0), 0);
      return { total, covered: Math.min(total, covered) };
    }
    // Unenumerated blocks (requirement/category receivers): a stated count,
    // else the documented four-unit assumption over an authored unit total,
    // else one per receiver. They cover only through a declared ASSIST block.
    const total = ask != null
      ? Number(ask)
      : s.unit_advisement != null
        ? Math.max(1, Math.round(Number(s.unit_advisement) / ASSUMED_UNITS_PER_COURSE))
        : (recvs.length || 1);
    const covered = groupBlock || recvs.some(recvCovered) ? total : 0;
    return { total, covered };
  };

  // A general-education section under the GE-on variant: counted at the same
  // course derivation, and articulable everywhere below the upper division —
  // IGETC/Cal-GETC certification clears lower-division GE by the modelling
  // standard, which also keeps the variant independent of how each document
  // happens to encode its GE blocks. Upper-division GE still counts against.
  const geSectionCourses = (g, s) => {
    const recvs = s.receivers || [];
    const ask = s.section_advisement;
    const total = ask != null
      ? Number(ask)
      : s.unit_advisement != null
        ? Math.max(1, Math.round(Number(s.unit_advisement) / ASSUMED_UNITS_PER_COURSE))
        : (recvs.length || 1);
    const covered = evaluated && resolveSectionTier(g, s) !== 'nontransferable' ? total : 0;
    return { total, covered };
  };

  const out = { total: 0, covered: 0, with_ge: { total: 0, covered: 0 } };
  const addBase = (c) => {
    out.total += c.total;
    out.covered += c.covered;
    out.with_ge.total += c.total;
    out.with_ge.covered += c.covered;
  };
  const addGe = (c) => {
    out.with_ge.total += c.total;
    out.with_ge.covered += c.covered;
  };

  for (const g of requirementGroups || []) {
    if (namedPadding(g)) continue;
    // Sections the source marks as work no community college can satisfy leave
    // the population entirely — see `notCollegeArticulable`.
    const sections = (g.sections || []).filter((s) => !notCollegeArticulable(s));
    if (!sections.length) continue;
    const isOr = String(g.group_conjunction || '').toLowerCase() === 'or' && sections.length > 1;
    if (!isOr) {
      for (const s of sections) {
        if (namedGeFlavored(g, s)) addGe(geSectionCourses(g, s));
        else addBase(sectionCourses(g, s));
      }
      continue;
    }
    // An Or group costs one path: best-covered ratio wins; ties go to the
    // cheapest path, so an unevaluated template prices the choice the same
    // way the unit budget does. (Every Or alternative in the corpus is a
    // named-requirement path; a hypothetical all-GE choice falls back to the
    // same rule over its GE pricing.)
    const base = sections.filter((s) => !namedGeFlavored(g, s));
    const pool = base.length ? base : sections;
    const stats = pool.map((s) => (base.length ? sectionCourses(g, s) : geSectionCourses(g, s)));
    const ratio = (x) => (x.total ? x.covered / x.total : 0);
    let pick = stats[0];
    for (const candidate of stats.slice(1)) {
      if (ratio(candidate) > ratio(pick)
        || (ratio(candidate) === ratio(pick) && candidate.total < pick.total)) {
        pick = candidate;
      }
    }
    if (base.length) addBase(pick);
    else addGe(pick);
  }
  return out;
}

function buildDegreeGroups(requirementGroups, ctx = {}) {
  const {
    articulated = null, optionsByParent = new Map(),
    universityCoursesById = {}, coursesById = new Map(), ccGeAreas = null,
    categoryOf = null, articulatedRequirements = null,
    excludeGeFromCategories = false,
  } = ctx;
  const evaluated = articulated != null;

  // Optional course-type rollup (Computing / Math / Science / Non-STEM) for the
  // MA paper's Figure 2. Off unless the caller supplies a categoryOf callback,
  // so every other consumer of this function is unaffected.
  const byCategory = categoryOf ? {} : null;
  // A receiver can belong to more than one category: a chemistry series
  // spanning general and organic courses is satisfied only when all of it
  // articulates, so it counts against both disciplines. `by_category` keeps the
  // PRIMARY (first) category only, so its slots still sum to the degree total
  // and a rollup into figure columns cannot double-count. `by_category_multi`
  // keeps every category, for figures that judge each category independently
  // and never sum across them (CA Figure 5's panels).
  const byCategoryMulti = categoryOf ? {} : null;
  let bumpTier = 'transferable';
  const addTo = (store, category, total, covered) => {
    if (!store[category]) {
      store[category] = {
        total: 0, covered: 0, lower_division_total: 0, lower_division_covered: 0,
      };
    }
    const bucket = store[category];
    bucket.total += total;
    bucket.covered += evaluated ? covered : 0;
    // Upper-division / residency work is separated out so a figure can choose
    // whether to hold a campus responsible for coursework a community college
    // could never offer.
    if (bumpTier !== 'nontransferable') {
      bucket.lower_division_total += total;
      bucket.lower_division_covered += evaluated ? covered : 0;
    }
  };
  const commitBump = (categories, total, covered) => {
    addTo(byCategory, categories[0], total, covered);
    for (const one of categories) addTo(byCategoryMulti, one, total, covered);
  };
  // Inside an Or group the course-type contributions buffer per alternative,
  // and only the picked path's are committed — the rollup must collapse the
  // same way the slot and unit totals do, or the typed slots sum every
  // alternative (Berkeley MCB: 94 typed slots against a 26-slot degree).
  let sectionBumps = null;
  // With `excludeGeFromCategories`, GE-titled and padding groups stay out of
  // the course-type rollup, matching the named-requirement population. The
  // Massachusetts corpus opts in (config `courseTypes.excludeGeGroups`): its
  // Figure 2 compares major coursework against the paper's matrix, which
  // carries no GE columns. California does NOT opt in — its verified course-
  // type figure counts GE blocks in Non-STEM, and that published semantic
  // stays untouched. The same predicates the named lens uses decide.
  let bumpExcluded = false;
  const bump = (category, total, covered) => {
    if (!byCategory || bumpExcluded) return;
    const categories = (Array.isArray(category) ? category : [category]).filter(Boolean);
    if (!categories.length) return;
    if (sectionBumps) { sectionBumps.push([categories, total, covered]); return; }
    commitBump(categories, total, covered);
  };

  const byTier = {};
  for (const t of TIERS) byTier[t] = { total: 0, covered: 0 };
  let total = 0;
  let covered = 0;
  // Unit-weighted coverage alongside the slot counts — "units completed /
  // units required" is the real graduation measure. Sections carry authored
  // unit_advisement (stated unit rules, series, GE blocks) or the flat
  // ~4u/course assumption; covered units scale by the slot fraction covered.
  let unitsTotal = 0;
  let unitsCovered = 0;

  const groups = (requirementGroups || []).map((g) => {
    const tier = g.tier || 'transferable';
    bumpTier = tier;
    let gTotal = 0;
    let gCovered = 0;
    const lines = [];
    // An `Or` group is a set of alternative paths — twelve MCB emphasis tracks,
    // two calculus sequences — and a student completes exactly ONE. Summing its
    // sections charges the degree once per alternative: Berkeley MCB's twelve
    // 24-unit tracks summed to 288 units and pushed the degree's denominator
    // from 120 to 392, collapsing its coverage to single digits. The group is
    // therefore collapsed to the single best-covered section, which is also the
    // honest answer to "how far can this college get a student" — a student
    // picks the sequence their college articulates. Berkeley MCB's math group
    // is exactly that case: Math 51/52 articulates widely, Math 10A/10B never
    // does, and the group is covered, not half-covered.
    const isOr = String(g.group_conjunction || '').toLowerCase() === 'or'
      && (g.sections || []).length > 1;
    const unitsBefore = unitsTotal;
    const coveredUnitsBefore = unitsCovered;
    // Per-section deltas, recorded at the TOP of the next iteration so the
    // several `continue` paths through the section body all get counted.
    const sectionStats = [];
    let mark = null;
    const closeSection = () => {
      if (!mark) return;
      sectionStats.push({
        total: gTotal - mark.gTotal,
        covered: gCovered - mark.gCovered,
        unitsTotal: unitsTotal - mark.unitsTotal,
        unitsCovered: unitsCovered - mark.unitsCovered,
        bumps: sectionBumps || [],
      });
      sectionBumps = null;
      mark = null;
    };

    // ASSIST does not always state a requirement as course rows. A campus may
    // publish one NAMED block instead — UC Irvine's biology "Mathematics
    // Requirement" is articulated at 114 of 115 colleges but carries no course
    // id, so matching template course ids against articulated ids reports 0%
    // for the whole discipline. A template group names the block that satisfies
    // it, and an articulated block covers the group's sections.
    //
    // The link is declared, never inferred: if ASSIST renames the block the
    // group returns to uncovered and the not-modelable check in the coverage
    // layer flags it, rather than the figure quietly showing a false zero.
    // A declared link may name SEVERAL blocks, and they are a combination: all
    // of them must be articulated. Berkeley's engineering physics alternative
    // is a community college's introductory physics sequence, which it accepts
    // only in its entirety and publishes as three separate Level blocks — a
    // college carrying two of the three has not completed the alternative.
    // A bare string is simply a combination of one.
    const blocksSatisfied = (declared) => {
      const names = (Array.isArray(declared) ? declared : [declared])
        .map(normalizeRequirementName)
        .filter(Boolean);
      return names.length > 0
        && names.every((name) => articulatedRequirements?.has(name));
    };

    const namedBlockSatisfied = Boolean(evaluated && blocksSatisfied(g.assist_requirement));

    // A block may also stand for ONE course rather than a whole group. UCLA
    // states its intro programming requirement as "Computer programming
    // courses: C++ preferred" inside a section that also lists three other
    // computer science courses by id; only the first is that block. Declaring
    // the link on the receiver keeps the other three counted on their own
    // articulation.
    const receiverBlockSatisfied = (r) => Boolean(
      evaluated && r?.assist_requirement && blocksSatisfied(r.assist_requirement)
    );

    for (const s of g.sections || []) {
      bumpExcluded = excludeGeFromCategories && (namedPadding(g) || namedGeTitled(g, s));
      if (isOr) {
        closeSection();
        mark = { gTotal, gCovered, unitsTotal, unitsCovered };
        sectionBumps = [];
      }
      const ask = s.section_advisement ?? 1;
      const recvs = s.receivers || [];
      const kind = recvs[0]?.receiving?.kind;
      gTotal += ask;
      const sectionCoveredBefore = gCovered;
      const sectionUnits = s.unit_advisement != null ? Number(s.unit_advisement) : ask * 4;
      unitsTotal += sectionUnits;

      // The group's named ASSIST block is articulated here, so every slot it
      // covers is met however the campus chose to enumerate the courses.
      if (namedBlockSatisfied) {
        gCovered += ask;
        bump(categoryOf && categoryOf({ section: s, group: g }), ask, ask);
        unitsCovered += sectionUnits;
        lines.push({
          title: recvs[0]?.receiving?.name || g.title,
          detail: `articulated as “${g.assist_requirement}” in ASSIST`,
          need: ask,
          covered: ask,
          status: 'covered',
        });
        continue;
      }

      // Assumed satisfiable at every college (AH&I, Cal-GETC, capped electives).
      if (recvs[0]?.assume_satisfiable) {
        const cov = evaluated ? ask : 0;
        gCovered += cov;
        bump(categoryOf && categoryOf({ section: s, group: g }), ask, cov);
        if (evaluated) unitsCovered += sectionUnits;
        lines.push({
          title: recvs[0].receiving?.name || g.title,
          detail: 'assumed — satisfiable at every CC',
          need: ask, covered: evaluated ? cov : null,
          status: !evaluated ? 'template' : 'covered',
        });
        continue;
      }

      // H/SS breadth — coverage from the college's IGETC Area 3 + 4 courses. The
      // list of qualifying courses is huge, so we report the count, not the codes.
      if (kind === 'ge_area' && Array.isArray(s.ge_areas) && s.ge_areas.length) {
        const hits = evaluated ? geCoverCourses(s.ge_areas, ccGeAreas) : [];
        const cov = Math.min(hits.length, ask);
        gCovered += cov;
        bump(categoryOf && categoryOf({ section: s, group: g }), ask, cov);
        if (evaluated) unitsCovered += sectionUnits * (cov / ask);
        lines.push({
          title: recvs[0].receiving?.name || g.title,
          detail: `${ask} from IGETC ${s.ge_areas.join(' / ')}`,
          need: ask, covered: evaluated ? cov : null,
          qualifying: evaluated ? hits.length : null,
          status: !evaluated ? 'template' : cov >= ask ? 'covered' : cov > 0 ? 'partial' : 'missing',
        });
        continue;
      }

      if (recvs.length === ask) {
        // Distinct required courses (or non-transferable slots) — one line each.
        for (const r of recvs) {
          if (r.receiving?.kind === 'course' || r.receiving?.kind === 'series') {
            const pids = receiverPids(r.receiving);
            let isCovered = evaluated
              && (receiverArticulated(r.receiving, articulated) || receiverBlockSatisfied(r));
            let cc = isCovered
              ? pids.flatMap((pid) => ccCodes(optionsByParent.get(pid) || r.options || [], coursesById))
              : [];
            // GE fallback (R&C R1A/R1B → IGETC 1A/1B) when major-prep articulation is absent.
            if (evaluated && !isCovered && Array.isArray(r.ge_areas) && r.ge_areas.length) {
              const geHits = geCoverCourses(r.ge_areas, ccGeAreas);
              if (geHits.length) { isCovered = true; cc = geHits.slice(0, 3).map(codeOf); }
            }
            if (isCovered) gCovered += 1;
            bump(categoryOf && categoryOf({ receiver: r, section: s, group: g }), 1, isCovered ? 1 : 0);
            const codes = pids.map((pid) => {
              const uc = universityCoursesById[pid];
              return uc ? codeOf(uc) : `#${pid}`;
            });
            lines.push({
              code: codes.join(' + '),
              title: pids.length === 1 ? (universityCoursesById[pids[0]]?.title || null) : null,
              covered: evaluated ? (isCovered ? 1 : 0) : null,
              cc,
              status: !evaluated ? 'template' : isCovered ? 'covered' : 'missing',
            });
          } else {
            bump(categoryOf && categoryOf({ receiver: r, section: s, group: g }), 1, 0);
            lines.push({
              title: r.receiving?.name || g.title,
              covered: evaluated ? 0 : null,
              status: tier === 'nontransferable' ? 'university' : !evaluated ? 'template' : 'missing',
            });
          }
        }
      } else {
        // Choose `ask` of many (e.g. the natural-science elective, 1 of 10;
        // or "pick one series in its entirety" where each option is a series).
        const artRecvs = evaluated
          ? recvs.filter((r) => receiverArticulated(r.receiving, articulated)
            || receiverBlockSatisfied(r))
          : [];
        let cov = Math.min(artRecvs.length, ask);
        // GE fallback, same semantic as the distinct-courses branch: an authored
        // ge_area on the requirement means a CC course in that IGETC area fills
        // the slot when major-prep articulation is absent (e.g. UCR's elective
        // slots — CHEM/MATH options never appear in the CS major agreement).
        if (evaluated && cov < ask) {
          const areas = s.ge_areas || recvs.find((r) => Array.isArray(r.ge_areas) && r.ge_areas.length)?.ge_areas;
          if (Array.isArray(areas) && areas.length) {
            const geHits = geCoverCourses(areas, ccGeAreas);
            cov = Math.min(ask, cov + geHits.length);
          }
        }
        gCovered += cov;
        bump(categoryOf && categoryOf({ section: s, group: g }), ask, cov);
        const cc = artRecvs.slice(0, ask).flatMap((r) =>
          receiverPids(r.receiving).flatMap((pid) =>
            ccCodes(optionsByParent.get(pid) || r.options || [], coursesById)));
        lines.push({
          title: g.title,
          detail: `choose ${ask} of ${recvs.length}`,
          need: ask, covered: evaluated ? cov : null, cc,
          status: !evaluated ? 'template' : cov >= ask ? 'covered' : cov > 0 ? 'partial' : 'missing',
        });
      }
      // Unit credit for the two fall-through branches (distinct / choose-N);
      // the assume/ge_area branches accumulate before their `continue`.
      if (evaluated) unitsCovered += sectionUnits * ((gCovered - sectionCoveredBefore) / ask);
    }

    if (isOr) {
      closeSection();
      // Best-covered path wins; ties keep the authored order, so an unevaluated
      // template reports its primary alternative rather than an arbitrary one.
      const ratio = (x) => (x.total ? x.covered / x.total : 0);
      const pick = sectionStats.reduce((a, b) => (ratio(b) > ratio(a) ? b : a),
        sectionStats[0] || { total: 0, covered: 0, unitsTotal: 0, unitsCovered: 0, bumps: [] });
      gTotal = pick.total;
      gCovered = pick.covered;
      unitsTotal = unitsBefore + pick.unitsTotal;
      unitsCovered = coveredUnitsBefore + pick.unitsCovered;
      for (const [categories, bTotal, bCovered] of pick.bumps || []) {
        commitBump(categories, bTotal, bCovered);
      }
    }
    total += gTotal;
    covered += gCovered;
    if (byTier[tier]) { byTier[tier].total += gTotal; byTier[tier].covered += gCovered; }
    return { label: g.title, tier, total: gTotal, covered: evaluated ? gCovered : null, lines };
  });

  return {
    total,
    covered: evaluated ? covered : null,
    ...(byCategory ? { by_category: byCategory, by_category_multi: byCategoryMulti } : {}),
    by_tier: evaluated ? byTier : Object.fromEntries(TIERS.map((t) => [t, { total: byTier[t].total, covered: null }])),
    units: {
      total: +unitsTotal.toFixed(1),
      // A partially covered authored block can produce fractional units (for
      // example, one of three slots in a 10-unit block). Keep one decimal so
      // the primary percentage is not distorted by whole-unit rounding.
      covered: evaluated ? +(unitsCovered.toFixed(1)) : null,
    },
    // The Massachusetts paper's population, counted the paper's way: binary
    // per required COURSE, at every level — GE excluded (their published
    // measure) and GE included (our extension for GE-heavy majors).
    named_requirements: (() => {
      const c = namedRequirementCourses(requirementGroups, { articulated, articulatedRequirements });
      return {
        courses: { total: c.total, covered: evaluated ? c.covered : null },
        courses_with_ge: {
          total: c.with_ge.total,
          covered: evaluated ? c.with_ge.covered : null,
        },
      };
    })(),
    groups,
  };
}

// area code -> [{ course_id, prefix, number }] for one community college, from
// the ASSIST course catalog's igetc_area tags. Used to satisfy GE/breadth slots.
async function loadCollegeGeAreas(db, communityCollegeId) {
  const rows = await db.collection('assist_courses')
    .find({ side: 'sending', community_college_id: Number(communityCollegeId), uc_transferable: true },
      { projection: { course_id: 1, prefix: 1, number: 1, title: 1, units: 1, igetc_area: 1, _id: 0 } })
    .toArray();
  const map = new Map();
  for (const c of rows) {
    for (const a of c.igetc_area || []) {
      if (!map.has(a)) map.set(a, []);
      map.get(a).push({ course_id: c.course_id, prefix: c.prefix, number: c.number, title: c.title, units: c.units });
    }
  }
  return map;
}

// Stamp per-college articulation onto the stored (agreement-shaped) degree so the
// shared RequirementsLedger can render the "4-year degree" tab in the exact same
// style as an agreement. Returns { requirement_groups, courses } — courses is the
// CC-course lookup the ledger's sending side needs. Major-prep options come from
// real agreements. GE-area requirements carry category metadata and a complete
// qualifying-course count instead of a misleading three-course sample.
//
// `template: true` renders the stored degree with NO college context: course and
// GE receivers keep a null articulation_status (the ledger leaves their sending
// side blank), while at-the-university slots still carry their reason.
function buildLedgerGroups(requirementGroups, ctx = {}) {
  const { articulated = new Set(), optionsByParent = new Map(), coursesById = new Map(), ccGeAreas = null, template = false } = ctx;
  const usedCourses = new Map();
  const addOptCourses = (opts) => {
    for (const o of opts) for (const cid of o.course_ids || []) {
      const c = coursesById.get(Number(cid));
      if (c && !usedCourses.has(Number(cid))) usedCourses.set(Number(cid), { course_id: Number(cid), prefix: c.prefix, number: c.number, title: c.title, units: c.units });
    }
  };
  const geOptions = (areas) => {
    const hits = geCoverCourses(areas, ccGeAreas).slice(0, 3);
    for (const h of hits) if (!usedCourses.has(h.course_id)) usedCourses.set(h.course_id, { course_id: h.course_id, prefix: h.prefix, number: h.number, title: h.title, units: h.units });
    return hits.map((h) => ({ course_ids: [h.course_id], course_conjunction: 'and' }));
  };

  const stamp = (r, s) => {
    const rec = r.receiving || {};
    if (template) {
      if (rec.kind === 'ge_area') {
        return {
          ...r,
          articulation_status: null,
          not_articulated_reason: null,
          options: [],
          category_match: {
            kind: 'ge_area',
            areas: [...(s.ge_areas || r.ge_areas || [])],
            required_count: s.section_advisement ?? 1,
            qualifying_count: null,
            assumed: Boolean(r.assume_satisfiable),
          },
        };
      }
      if (rec.kind === 'course' || rec.kind === 'series') {
        return { ...r, articulation_status: null, not_articulated_reason: null, options: [] };
      }
      return { ...r, articulation_status: 'not_articulated', not_articulated_reason: 'must_take_at_university', options: [] };
    }
    if (rec.kind === 'course' || rec.kind === 'series') {
      // A series articulates only when every course in it does.
      let isArt = receiverArticulated(rec, articulated);
      let opts = isArt
        ? receiverPids(rec).flatMap((pid) => optionsByParent.get(pid) || [])
        : [];
      if (isArt && !opts.length) opts = r.options || [];
      if (!isArt && Array.isArray(r.ge_areas) && r.ge_areas.length) {
        const g2 = geOptions(r.ge_areas); // R&C R1A/R1B fallback via IGETC 1A/1B
        if (g2.length) { isArt = true; opts = g2; }
      }
      addOptCourses(opts);
      return { ...r, articulation_status: isArt ? 'articulated' : 'not_articulated', not_articulated_reason: isArt ? null : 'no_course_articulated', options: opts };
    }
    if (rec.kind === 'ge_area') {
      const areas = [...(s.ge_areas || r.ge_areas || [])];
      const hits = r.assume_satisfiable ? [] : geCoverCourses(areas, ccGeAreas);
      const required = s.section_advisement ?? 1;
      return {
        ...r,
        articulation_status: r.assume_satisfiable || hits.length >= required ? 'articulated' : 'not_articulated',
        not_articulated_reason: null,
        options: [],
        category_match: {
          kind: 'ge_area',
          areas,
          required_count: required,
          qualifying_count: r.assume_satisfiable ? null : hits.length,
          assumed: Boolean(r.assume_satisfiable),
        },
      };
    }
    return { ...r, articulation_status: 'not_articulated', not_articulated_reason: 'must_take_at_university', options: [] };
  };

  const groups = (requirementGroups || []).map((g) => {
    // Collapse a group's "take-all" course sections (every receiver required) into
    // ONE section, so the ledger shows a single "Complete all of:" card with the
    // courses as rows instead of one card per course. Choose-N sections (e.g. the
    // science elective) and non-course sections stay separate.
    const takeAll = [];
    const others = [];
    for (const s of g.sections || []) {
      const recvs = s.receivers || [];
      const ask = s.section_advisement ?? 1;
      const allCourses = recvs.length > 0 && recvs.every((r) => r.receiving?.kind === 'course');
      if (allCourses && ask === recvs.length) takeAll.push(...recvs);
      else others.push(s);
    }
    const sections = [];
    if (takeAll.length) sections.push({ section_advisement: takeAll.length, unit_advisement: null, receivers: takeAll.map((r) => stamp(r, {})) });
    for (const s of others) sections.push({ ...s, receivers: (s.receivers || []).map((r) => stamp(r, s)) });
    return { ...g, is_required: true, sections };
  });
  return { requirement_groups: groups, courses: [...usedCourses.values()] };
}

// The unit budget behind a template: every slot counts a flat ~4 units unless
// the section carries an authored `unit_advisement` (a stated unit rule like
// Berkeley's 20-unit upper-division block). Computed from the stored doc so
// the page's numbers move with the data, never a hand-kept figure.
const ASSUMED_UNITS_PER_COURSE = 4;

/**
 * One tier for a section, resolved the way every reader must resolve it.
 *
 * Two vocabularies mark university-only work and both are legitimate: the CS
 * documents say `tier: 'nontransferable'`, the bio/econ documents say
 * `course_level: 'upper_division'` with `cc_articulable: false`. Whichever the
 * group uses, the group's word is final — a group that can only be discharged
 * after transferring is university-only in its entirety, and a section-level
 * `tier: 'transferable'` beneath it is editor residue, not a fact. Berkeley MCB
 * carried fifteen such sections, and readers that let the section win reported
 * all 392 of its mis-summed units as lower division.
 *
 * Under any other group a section may still state its own tier (the CS
 * documents put upper-division sections inside mixed groups this way).
 */
function resolveSectionTier(group, section) {
  const universityOnly = /^upper/.test(String(group.course_level || ''))
    || group.cc_articulable === false
    || group.tier === 'nontransferable';
  if (universityOnly) return 'nontransferable';
  const tier = section.tier || group.tier;
  return TIERS.includes(tier) ? tier : 'transferable';
}

function sectionUnits(section) {
  const slots = Number(section.section_advisement) || (section.receivers || []).length || 0;
  return section.unit_advisement != null
    ? Number(section.unit_advisement)
    : slots * ASSUMED_UNITS_PER_COURSE;
}

function computeUnitBudget(requirementGroups) {
  const perTier = { transferable: 0, breadth: 0, nontransferable: 0 };
  for (const g of requirementGroups || []) {
    const sections = g.sections || [];
    const isOr = String(g.group_conjunction || '').toLowerCase() === 'or' && sections.length > 1;
    if (isOr) {
      // A choice costs one path. Price it at the cheapest alternative a
      // college can actually reach — a path with a recorded reach of zero
      // articulates nowhere and cannot set the price; unrecorded reach is
      // assumed live. Same convention as degreeTransferBudget's groupUnits,
      // so the denominator and the budget agree about every document.
      const reachable = sections.filter((s) => (s.articulation_reach ?? 1) > 0);
      const pick = (reachable.length ? reachable : sections)
        .reduce((a, b) => (sectionUnits(b) < sectionUnits(a) ? b : a));
      perTier[resolveSectionTier(g, pick)] += sectionUnits(pick);
      continue;
    }
    for (const s of sections) {
      perTier[resolveSectionTier(g, s)] += sectionUnits(s);
    }
  }
  return {
    modeled_units: perTier.transferable + perTier.breadth + perTier.nontransferable,
    per_tier: perTier,
    assumed_units_per_course: ASSUMED_UNITS_PER_COURSE,
  };
}

function degreeUnitSystem(degree, fallback = null) {
  const stored = String(degree?.unit_system || '').toLowerCase();
  if (stored === 'quarter' || stored === 'semester') return stored;
  const reference = String(fallback || '').toLowerCase();
  if (reference === 'quarter' || reference === 'semester') return reference;
  const statedUnits = Number(degree?.total_units);
  if (Number.isFinite(statedUnits)) return statedUnits >= 150 ? 'quarter' : 'semester';
  return null;
}

module.exports = {
  buildDegreeGroups,
  normalizeRequirementName,
  buildLedgerGroups,
  loadUniversityCourses,
  loadCollegeGeAreas,
  computeUnitBudget,
  resolveSectionTier,
  degreeUnitSystem,
  // The classification predicates the figure readers apply, exported so the
  // display taxonomy (normalizeDegreeCategories.js) derives from EXACTLY the
  // rules the figures use — the display can then never contradict the math.
  namedPadding,
  namedGeFlavored,
  notCollegeArticulable,
};
