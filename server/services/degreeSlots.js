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
 * slots and a college covers min(available, ask) of them.
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

async function loadUniversityCourses(db, requirementGroups) {
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
  return out;
}

function buildDegreeGroups(requirementGroups, ctx = {}) {
  const {
    articulated = null, optionsByParent = new Map(),
    universityCoursesById = {}, coursesById = new Map(), ccGeAreas = null,
  } = ctx;
  const evaluated = articulated != null;

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
    let gTotal = 0;
    let gCovered = 0;
    const lines = [];

    for (const s of g.sections || []) {
      const ask = s.section_advisement ?? 1;
      const recvs = s.receivers || [];
      const kind = recvs[0]?.receiving?.kind;
      gTotal += ask;
      const sectionCoveredBefore = gCovered;
      const sectionUnits = s.unit_advisement != null ? Number(s.unit_advisement) : ask * 4;
      unitsTotal += sectionUnits;

      // Assumed satisfiable at every college (AH&I, Cal-GETC, capped electives).
      if (recvs[0]?.assume_satisfiable) {
        const cov = evaluated ? ask : 0;
        gCovered += cov;
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
            let isCovered = evaluated && receiverArticulated(r.receiving, articulated);
            let cc = isCovered
              ? pids.flatMap((pid) => ccCodes(optionsByParent.get(pid) || r.options || [], coursesById))
              : [];
            // GE fallback (R&C R1A/R1B → IGETC 1A/1B) when major-prep articulation is absent.
            if (evaluated && !isCovered && Array.isArray(r.ge_areas) && r.ge_areas.length) {
              const geHits = geCoverCourses(r.ge_areas, ccGeAreas);
              if (geHits.length) { isCovered = true; cc = geHits.slice(0, 3).map(codeOf); }
            }
            if (isCovered) gCovered += 1;
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
        const artRecvs = evaluated ? recvs.filter((r) => receiverArticulated(r.receiving, articulated)) : [];
        const cov = Math.min(artRecvs.length, ask);
        gCovered += cov;
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

    total += gTotal;
    covered += gCovered;
    if (byTier[tier]) { byTier[tier].total += gTotal; byTier[tier].covered += gCovered; }
    return { label: g.title, tier, total: gTotal, covered: evaluated ? gCovered : null, lines };
  });

  return {
    total,
    covered: evaluated ? covered : null,
    by_tier: evaluated ? byTier : Object.fromEntries(TIERS.map((t) => [t, { total: byTier[t].total, covered: null }])),
    units: { total: unitsTotal, covered: evaluated ? Math.round(unitsCovered) : null },
    groups,
  };
}

// area code -> [{ course_id, prefix, number }] for one community college, from
// the ASSIST course catalog's igetc_area tags. Used to satisfy GE/breadth slots.
async function loadCollegeGeAreas(db, communityCollegeId) {
  const rows = await db.collection('assist_courses')
    .find({ side: 'sending', community_college_id: Number(communityCollegeId), uc_transferable: true },
      { projection: { course_id: 1, prefix: 1, number: 1, igetc_area: 1, _id: 0 } })
    .toArray();
  const map = new Map();
  for (const c of rows) {
    for (const a of c.igetc_area || []) {
      if (!map.has(a)) map.set(a, []);
      map.get(a).push({ course_id: c.course_id, prefix: c.prefix, number: c.number });
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
      if (c && !usedCourses.has(Number(cid))) usedCourses.set(Number(cid), { course_id: Number(cid), prefix: c.prefix, number: c.number });
    }
  };
  const geOptions = (areas) => {
    const hits = geCoverCourses(areas, ccGeAreas).slice(0, 3);
    for (const h of hits) if (!usedCourses.has(h.course_id)) usedCourses.set(h.course_id, { course_id: h.course_id, prefix: h.prefix, number: h.number });
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

function computeUnitBudget(requirementGroups) {
  const perTier = { transferable: 0, breadth: 0, nontransferable: 0 };
  for (const g of requirementGroups || []) {
    for (const s of g.sections || []) {
      const slots = Number(s.section_advisement) || (s.receivers || []).length || 0;
      const units = s.unit_advisement != null
        ? Number(s.unit_advisement)
        : slots * ASSUMED_UNITS_PER_COURSE;
      const tier = TIERS.includes(s.tier || g.tier) ? (s.tier || g.tier) : 'transferable';
      perTier[tier] += units;
    }
  }
  return {
    modeled_units: perTier.transferable + perTier.breadth + perTier.nontransferable,
    per_tier: perTier,
    assumed_units_per_course: ASSUMED_UNITS_PER_COURSE,
  };
}

module.exports = { buildDegreeGroups, buildLedgerGroups, loadUniversityCourses, loadCollegeGeAreas, computeUnitBudget };
