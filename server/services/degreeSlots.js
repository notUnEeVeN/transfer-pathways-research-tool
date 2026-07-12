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
        if (r.receiving?.kind === 'course' && r.receiving.parent_id != null) parentIds.add(Number(r.receiving.parent_id));
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

      // American History & Institutions — assumed satisfiable at every college.
      if (recvs[0]?.assume_satisfiable) {
        const cov = evaluated ? ask : 0;
        gCovered += cov;
        lines.push({
          title: recvs[0].receiving?.name || g.title,
          detail: 'assumed — UC-required, universal at CCs',
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
          if (r.receiving?.kind === 'course') {
            const pid = Number(r.receiving.parent_id);
            let isCovered = evaluated && articulated.has(pid);
            let cc = isCovered ? ccCodes(optionsByParent.get(pid) || r.options || [], coursesById) : [];
            // GE fallback (R&C R1A/R1B → IGETC 1A/1B) when major-prep articulation is absent.
            if (evaluated && !isCovered && Array.isArray(r.ge_areas) && r.ge_areas.length) {
              const geHits = geCoverCourses(r.ge_areas, ccGeAreas);
              if (geHits.length) { isCovered = true; cc = geHits.slice(0, 3).map(codeOf); }
            }
            if (isCovered) gCovered += 1;
            const uc = universityCoursesById[pid];
            lines.push({
              code: uc ? codeOf(uc) : `#${pid}`,
              title: uc?.title || null,
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
        // Choose `ask` of many (e.g. the natural-science elective, 1 of 10).
        const artRecvs = evaluated ? recvs.filter((r) => articulated.has(Number(r.receiving?.parent_id))) : [];
        const cov = Math.min(artRecvs.length, ask);
        gCovered += cov;
        const cc = artRecvs.slice(0, ask).flatMap((r) =>
          ccCodes(optionsByParent.get(Number(r.receiving?.parent_id)) || r.options || [], coursesById));
        lines.push({
          title: g.title,
          detail: `choose ${ask} of ${recvs.length}`,
          need: ask, covered: evaluated ? cov : null, cc,
          status: !evaluated ? 'template' : cov >= ask ? 'covered' : cov > 0 ? 'partial' : 'missing',
        });
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
    by_tier: evaluated ? byTier : Object.fromEntries(TIERS.map((t) => [t, { total: byTier[t].total, covered: null }])),
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

module.exports = { buildDegreeGroups, loadUniversityCourses, loadCollegeGeAreas };
