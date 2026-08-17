/**
 * Full-pathway curricular complexity — the Massachusetts paper's Figure 6,
 * computed for our corpora.
 *
 * The paper scores each transfer PATHWAY: the associate degree's courses plus
 * every four-year requirement the transfer does not satisfy, joined by
 * prerequisite/corequisite edges, with structural complexity
 * h(G) = Σ(delay + blocking) per Heileman et al. (2018). Our implementation of
 * those equations reproduced the paper's own published scores on 58 of 60
 * pathways exactly (scripts/ma/complexityCheck.js), the two misses being their
 * own revision drift — so the METRIC is validated; this module supplies the
 * same pathway assembly for California.
 *
 * Assembly per (campus × college) pair, mirroring the paper's sheets:
 *   - the college's associate degree, Or-collapsed to its cheapest path
 *     (each AS course a vertex, edges from the CC prerequisite projection);
 *   - lower-division requirements: satisfied and CONSUMED from the AS when the
 *     pair's agreement articulates them (multiset — a course satisfies one
 *     requirement); unsatisfied ones stay as university vertices, exactly the
 *     paper's offerings-vs-AS gap;
 *   - IGETC-satisfiable general education: satisfied by the AS side (its GE
 *     courses are already vertices); campus-only GE stays;
 *   - upper-division requirements: university vertices (named courses via the
 *     campus catalogue; eligibility pools as placeholder slots, as the paper's
 *     SLOT rows);
 *   - elective capacity: placeholder slots for whatever the AS's leftover
 *     courses do not absorb (the paper's blue rows);
 *   - unit-accounting sections: not courses, skipped.
 *
 * When a lower-division requirement is consumed, university-side prerequisite
 * edges that pointed at it are REWIRED to the community-college courses that
 * covered it — the paper's sheets do the same by construction, because their
 * transfer tab is one sheet with one id space.
 *
 * Edge coverage: the CC side is census-complete (99%+ of every course id the
 * cs/bio/econ populations consume is concept-examined; an empty entry means no
 * enforced prerequisites), and all nine UC catalogues have been fetched and
 * requisite-parsed. Every row still reports `edge_info_pct` — the share of its
 * vertices whose prerequisite status is known either way — because placeholder
 * slots (pools, electives) are structurally unknowable. Missing edges can only
 * UNDERSTATE complexity, never inflate it.
 */
const { getMajor } = require('../../config/majors');
const { resolveSectionTier } = require('../degreeSlots');
const { projectPrereqEdges } = require('../prereqGraph');
const { curricularComplexity } = require('./curricularComplexity');

const normalizeCode = (prefix, number) => `${String(prefix || '').toUpperCase().replace(/\s+/g, ' ').trim()} ${String(number || '').toUpperCase()}`.trim();

/** Cheapest-path course ids of an associate degree, per the shared Or-collapse reading. */
function asDegreeCourseIds(asDoc) {
  const ids = [];
  const seen = new Set();
  // AS blocks satisfied by an area rather than a named course (IGETC rows,
  // elective rows) carry no options; the student still takes real courses
  // there, so each surviving slot is a CC-side placeholder — exactly the
  // paper's SLOT rows in its AS sheets.
  let slots = 0;
  let slotUnits = 0;
  for (const group of asDoc.requirement_groups || []) {
    for (const section of group.sections || []) {
      const receivers = section.receivers || [];
      const cost = (receiver) => Math.min(...(receiver.options || [{ course_ids: [] }])
        .map((option) => (option.course_ids || []).length || 1));
      const ask = section.section_advisement != null && Number(section.section_advisement) < receivers.length
        ? Math.max(0, Number(section.section_advisement))
        : receivers.length;
      const picked = [...receivers].sort((a, b) => cost(a) - cost(b)).slice(0, ask);
      const perReceiverUnits = picked.length && Number(section.unit_advisement)
        ? Number(section.unit_advisement) / picked.length : null;
      for (const receiver of picked) {
        const options = receiver.options || [];
        if (!options.length) { slots += 1; slotUnits += perReceiverUnits || 0; continue; }
        const chosen = [...options].sort((a, b) => ((a.course_ids || []).length || 99) - ((b.course_ids || []).length || 99))[0];
        if (!(chosen.course_ids || []).length) { slots += 1; slotUnits += perReceiverUnits || 0; continue; }
        for (const id of chosen.course_ids || []) {
          if (!seen.has(id)) { seen.add(id); ids.push(id); }
        }
      }
    }
  }
  return { ids, slots, slotUnits };
}

/** Choose-N cheapest receivers of a degree section, matching the shared reader. */
function pickReceivers(section) {
  const receivers = section.receivers || [];
  const expansion = (r) => (r.receiving?.kind === 'series'
    ? (r.receiving.parent_ids || []).length || 1 : 1);
  const ask = section.section_advisement != null && Number(section.section_advisement) < receivers.length
    ? Math.max(0, Number(section.section_advisement))
    : receivers.length;
  return [...receivers].sort((a, b) => expansion(a) - expansion(b)).slice(0, ask);
}

/**
 * Build one pathway's vertex set. `asIds` empty ⇒ the resident pathway (the
 * degree taken with no transfer), which anchors the per-campus delta exactly
 * as the paper's resident tabs do.
 */
function assemblePathway({ degree, asIds, asSlots = 0, asSlotUnits = 0, agreementByParent, ucCatalog, ucCodeByParent, ccUnits }) {
  const vertices = new Map(); // key -> { units, kind: 'cc'|'uc'|'slot', catalogId }
  const substitution = new Map(); // uc catalogue id -> [cc keys]
  const usedAs = new Set();
  const asAvailable = new Set(asIds);
  let electiveUnits = 0;
  let geSkippedCourses = 0;
  let consumed = 0;

  for (const id of asIds) {
    vertices.set(`cc:${id}`, { units: ccUnits.get(id) ?? null, kind: 'cc' });
  }
  for (let i = 0; i < asSlots; i += 1) {
    vertices.set(`slot:as:${i}`, { units: asSlots ? asSlotUnits / asSlots : null, kind: 'slot' });
  }

  const addUcByCode = (code, fallbackUnits) => {
    const row = code ? ucCatalog.get(code) : null;
    const key = row ? row.id : `uc:req:${vertices.size}:${code || 'unnamed'}`;
    if (!vertices.has(key)) {
      vertices.set(key, {
        units: row?.units ?? fallbackUnits ?? null,
        kind: row ? 'uc' : 'slot',
        catalogId: row?.id || null,
      });
    }
    return key;
  };

  for (const group of degree.requirement_groups || []) {
    // An Or-group is ONE choice: the shared reader collapses it to a single
    // path, and walking every alternative counted all twelve of Berkeley
    // biology's tracks into one pathway (the audit's n_courses 96-115 rows).
    // Take the cheapest section by receiver expansion, as the reader prices it.
    const isOr = String(group.group_conjunction || '').toLowerCase() === 'or'
      && (group.sections || []).length > 1;
    const sectionCost = (section) => pickReceivers(section)
      .reduce((sum, r) => sum + (r.receiving?.kind === 'series'
        ? (r.receiving.parent_ids || []).length || 1 : 1), 0);
    const sections = isOr
      ? [[...(group.sections || [])].sort((a, b) => sectionCost(a) - sectionCost(b))[0]]
      : (group.sections || []);
    for (const section of sections) {
      const category = section.category
        || (resolveSectionTier(group, section) === 'nontransferable' ? 'upper-division' : 'lower-division');
      if (category === 'unit-accounting') continue;
      if (category === 'electives') { electiveUnits += Number(section.unit_advisement) || 0; continue; }
      const receivers = pickReceivers(section);
      const perReceiverUnits = receivers.length && Number(section.unit_advisement)
        ? Number(section.unit_advisement) / receivers.length : null;

      if (category === 'general-education') {
        if (resolveSectionTier(group, section) !== 'nontransferable') {
          // IGETC-satisfiable: covered on the AS side, whose GE courses are
          // already pathway vertices. Resident pathways take them as slots.
          if (asIds.length) { geSkippedCourses += receivers.length; continue; }
          receivers.forEach((_, index) => {
            vertices.set(`slot:ge:${group.title || ''}:${section.category}:${vertices.size}:${index}`,
              { units: perReceiverUnits, kind: 'slot' });
          });
        } else {
          // Campus-only GE (a DC slot, upper-division writing): stays for
          // transfer and resident alike.
          for (const receiver of receivers) {
            const code = receiver.receiving?.alternatives?.[0]?.code || receiver.receiving?.code || null;
            addUcByCode(code && !/^(GE|AH&I|ELECTIVE)/i.test(code) ? code : null, perReceiverUnits);
          }
        }
        continue;
      }

      if (category === 'upper-division') {
        if (section.eligibility) {
          const slots = Number(section.eligibility.courses_required) || receivers.length || 1;
          const each = Number(section.unit_advisement) ? Number(section.unit_advisement) / slots : null;
          for (let i = 0; i < slots; i += 1) {
            vertices.set(`slot:pool:${degree._id}:${vertices.size}:${i}`, { units: each, kind: 'slot' });
          }
          continue;
        }
        for (const receiver of receivers) {
          const receiving = receiver.receiving || {};
          if (receiving.kind === 'series') {
            for (const pid of receiving.parent_ids || []) addUcByCode(ucCodeByParent.get(pid) || null, perReceiverUnits);
            continue;
          }
          const code = receiving.alternatives?.[0]?.code || receiving.code
            || ucCodeByParent.get(receiving.parent_id) || null;
          addUcByCode(code && !/^(GE|AH&I|ELECTIVE)/i.test(code) ? code : null, perReceiverUnits);
        }
        continue;
      }

      // lower-division: satisfiable by transfer when this pair's agreement
      // articulates it AND the associate degree still has the sending courses
      // to spend — the multiset rule.
      for (const receiver of receivers) {
        const receiving = receiver.receiving || {};
        const parentIds = receiving.kind === 'series' ? (receiving.parent_ids || []) : [receiving.parent_id];
        let covered = false;
        if (asIds.length) {
          for (const pid of parentIds) {
            const articulation = agreementByParent.get(pid);
            if (!articulation?.options?.length) continue;
            const option = articulation.options.find((ids) => ids.length
              && ids.every((id) => asAvailable.has(id) && !usedAs.has(id)));
            if (option) {
              option.forEach((id) => usedAs.add(id));
              consumed += 1;
              const catalogId = ucCatalog.get(ucCodeByParent.get(pid) || '')?.id;
              if (catalogId) substitution.set(catalogId, option.map((id) => `cc:${id}`));
              covered = true;
            }
          }
        }
        if (covered) continue;
        for (const pid of parentIds.length ? parentIds : [null]) {
          addUcByCode(ucCodeByParent.get(pid) || null, perReceiverUnits);
        }
      }
    }
  }

  // Elective capacity: the paper's blue rows. AS courses that satisfied
  // nothing already sit in the pathway and absorb capacity first.
  const standardUnit = degree.unit_system === 'semester' ? 4 : 4.5;
  const leftover = (asIds.length + asSlots) - usedAs.size - geSkippedCourses;
  const electiveSlots = Math.max(0, Math.round(electiveUnits / standardUnit) - Math.max(0, leftover));
  for (let i = 0; i < electiveSlots; i += 1) {
    vertices.set(`slot:elective:${i}`, { units: standardUnit, kind: 'slot' });
  }

  return { vertices, substitution, consumed };
}

function scorePathway({ vertices, substitution }, { ccPrereqs, ucPrereqsById }) {
  const keys = [...vertices.keys()];
  const inSet = new Set(keys);
  const parentsOf = (key) => {
    if (key.startsWith('cc:')) {
      return (ccPrereqs.get(key) || []).filter((p) => inSet.has(p));
    }
    const meta = vertices.get(key);
    if (!meta?.catalogId) return [];
    const targets = ucPrereqsById.get(meta.catalogId) || [];
    const out = [];
    for (const target of targets) {
      if (inSet.has(target)) out.push(target);
      else if (substitution.has(target)) out.push(...substitution.get(target).filter((k) => inSet.has(k)));
    }
    return [...new Set(out)].filter((p) => p !== key);
  };
  const { complexity, maxDelay } = curricularComplexity(keys, parentsOf);
  const edges = keys.reduce((sum, k) => sum + parentsOf(k).length, 0);
  // A vertex is "informed" when its prerequisite status is KNOWN either way:
  // CC courses that the concept projection has examined (empty list = no
  // enforced prerequisites), and UC courses present in the campus catalogue
  // (every catalogue row has been through the requisite parse, so absence of
  // edges there also means none are stated). Placeholder slots can never be
  // informed — they are the structural remainder.
  const informed = keys.filter((k) => (k.startsWith('cc:') && ccPrereqs.has(k))
    || Boolean(vertices.get(k)?.catalogId)).length;
  const placeholders = keys.filter((k) => vertices.get(k)?.kind === 'slot').length;
  return {
    n_courses: keys.length,
    n_placeholder: placeholders,
    n_edges: edges,
    complexity,
    max_delay: maxDelay,
    edge_info_pct: keys.length ? +((100 * informed) / keys.length).toFixed(1) : null,
  };
}

async function pathwayComplexityData(db, visiblePairs, { majorSlug = 'cs', degreeType = 'ast' } = {}) {
  const major = getMajor(majorSlug);
  if (!major) throw new Error(`unknown major: ${majorSlug}`);

  const [degrees, asDocs, ccPrereqs, ccCourses] = await Promise.all([
    db.collection('curated_requirements')
      .find({ state: { $exists: false }, kind: 'degree', major_slug: majorSlug }).sort({ _id: 1 }).toArray(),
    db.collection('curated_requirements')
      .find({ state: { $exists: false }, kind: 'as_degree', major_slug: majorSlug, degree_type: degreeType }).toArray(),
    projectPrereqEdges(db),
    db.collection('assist_courses')
      .find({ state: { $exists: false }, side: 'sending' }, { projection: { course_id: 1, units: 1, min_units: 1 } }).toArray(),
  ]);
  const ccUnits = new Map(ccCourses.map((c) => [c.course_id, Number(c.min_units ?? c.units) || null]));
  const collegeRows = await db.collection('assist_institutions')
    .find({ state: { $exists: false }, kind: 'community_college' }).project({ source_id: 1, name: 1 }).toArray();
  const collegeName = new Map(collegeRows.map((r) => [Number(r.source_id), r.name]));

  const rows = [];
  for (const degree of degrees) {
    const programs = major.programs?.[degree.school_id] || [];
    if (visiblePairs && !programs.some((program) => visiblePairs.some(
      (pair) => pair.school_id === Number(degree.school_id) && pair.major === program,
    ))) continue;

    const [catalogRows, receivingRows, agreements] = await Promise.all([
      db.collection('curated_prerequisites')
        .find({ institution_id: `uc:${degree.school_id}` })
        .project({ course_id: 1, course_code: 1, units: 1, prerequisite_ids: 1 }).toArray(),
      db.collection('assist_courses')
        .find({ institution_id: `uc:${degree.school_id}`, parent_id: { $exists: true, $ne: null } })
        .project({ parent_id: 1, prefix: 1, number: 1 }).toArray(),
      db.collection('assist_agreements')
        .find({ state: { $exists: false }, uc_school_id: degree.school_id, major: { $in: programs } }).toArray(),
    ]);
    const ucCatalog = new Map();
    const ucPrereqsById = new Map();
    for (const row of catalogRows) {
      const code = String(row.course_code || '').toUpperCase().replace(/\s+/g, ' ').trim();
      if (!code) continue;
      if (!ucCatalog.has(code)) {
        ucCatalog.set(code, { id: row.course_id, units: Number(row.units) || null });
      }
      if ((row.prerequisite_ids || []).length) ucPrereqsById.set(row.course_id, row.prerequisite_ids);
    }
    const ucCodeByParent = new Map(receivingRows.map((r) => [r.parent_id, normalizeCode(r.prefix, r.number)]));

    const shared = { ccPrereqs, ucPrereqsById };
    const resident = scorePathway(
      assemblePathway({ degree, asIds: [], asSlots: 0, agreementByParent: new Map(), ucCatalog, ucCodeByParent, ccUnits }),
      shared,
    );

    const agreementsByCc = new Map();
    for (const agreement of agreements) {
      const byParent = agreementsByCc.get(agreement.community_college_id) || new Map();
      for (const group of agreement.requirement_groups || []) {
        for (const section of group.sections || []) {
          for (const receiver of section.receivers || []) {
            const receiving = receiver.receiving || {};
            const parentIds = receiving.kind === 'series' ? (receiving.parent_ids || []) : [receiving.parent_id];
            if (receiver.articulation_status !== 'articulated') continue;
            const options = (receiver.options || [])
              .map((option) => (option.course_ids || []).filter((id) => id != null))
              .filter((ids) => ids.length);
            if (!options.length) continue;
            for (const pid of parentIds) {
              if (pid != null && !byParent.has(pid)) byParent.set(pid, { options });
            }
          }
        }
      }
      agreementsByCc.set(agreement.community_college_id, byParent);
    }

    for (const asDoc of asDocs) {
      const collegeId = asDoc.community_college_id;
      const agreementByParent = agreementsByCc.get(collegeId);
      if (!agreementByParent) continue;
      const { ids: asIds, slots: asSlots, slotUnits: asSlotUnits } = asDegreeCourseIds(asDoc);
      if (!asIds.length) continue;
      const pathway = assemblePathway({ degree, asIds, asSlots, asSlotUnits, agreementByParent, ucCatalog, ucCodeByParent, ccUnits });
      const score = scorePathway(pathway, shared);
      rows.push({
        school_id: degree.school_id,
        school: degree.school,
        community_college_id: collegeId,
        college_name: collegeName.get(Number(collegeId)) || asDoc.college_name || String(collegeId),
        degree_type: degreeType,
        as_courses: asIds.length + asSlots,
        requirements_consumed: pathway.consumed,
        ...score,
        resident_complexity: resident.complexity,
        delta_vs_resident: +(score.complexity - resident.complexity).toFixed(1),
      });
    }
  }
  return rows;
}

/**
 * Cached full-corpus computation. The assembly takes ~10s per major, so the
 * endpoint serves from `analysis_cache` (one doc per major × degree type) and
 * lets the caller apply visibility filtering to the cached rows — scoping is
 * cheap, scoring is not. Empty results are never cached, so a data problem
 * cannot freeze an empty matrix in place. Refresh with
 * `scripts/buildPathwayComplexityCache.js` (or `?refresh=1`) after any change
 * to degrees, associate degrees, agreements, or prerequisite data.
 */
const CACHE_COLLECTION = 'analysis_cache';

async function pathwayComplexityCached(db, { majorSlug = 'cs', degreeType = 'ast', refresh = false } = {}) {
  const cacheId = `pathway-complexity:${majorSlug}:${degreeType}`;
  if (!refresh) {
    const hit = await db.collection(CACHE_COLLECTION).findOne({ _id: cacheId });
    if (hit?.rows?.length) return { rows: hit.rows, computed_at: hit.computed_at, cached: true };
  }
  const rows = await pathwayComplexityData(db, null, { majorSlug, degreeType });
  const computed_at = new Date().toISOString();
  if (rows.length) {
    await db.collection(CACHE_COLLECTION).replaceOne(
      { _id: cacheId },
      { _id: cacheId, kind: 'pathway-complexity', major_slug: majorSlug, degree_type: degreeType, rows, computed_at },
      { upsert: true },
    );
  }
  return { rows, computed_at, cached: false };
}

module.exports = {
  pathwayComplexityData,
  pathwayComplexityCached,
  assemblePathway,
  asDegreeCourseIds,
  scorePathway,
};
