/**
 * Full-pathway curricular complexity — the Massachusetts paper's Figure 6,
 * computed for our corpora.
 *
 * The paper scores each transfer PATHWAY: the associate degree's courses plus
 * every four-year requirement the transfer does not satisfy, joined by
 * prerequisite/corequisite edges, with structural complexity
 * h(G) = Σ(delay + blocking) per Heileman et al. (2018). Our implementation of
 * those equations reproduces 59 of the 60 scores in the archived Massachusetts
 * workbook; the remaining four-point difference is retained as an artifact
 * divergence rather than assigned a cause. This module supplies a separately
 * sourced, explicitly modelled pathway assembly for California.
 *
 * Assembly per (campus × college) pair, mirroring the paper's sheets:
 *   - the college's enumerated named associate-degree requirements, resolved
 *     through the shared exact stored-tree selector (each selected named
 *     course a vertex, edges from the CC prerequisite projection);
 *   - lower-division requirements: satisfied and CONSUMED from the AS when the
 *     pair's agreement articulates them (multiset — a course satisfies one
 *     requirement); unsatisfied ones stay as university vertices, exactly the
 *     paper's offerings-vs-AS gap;
 *   - IGETC-satisfiable general education: satisfied administratively by the
 *     AS side. The gathered AS records preserve the GE block and its units,
 *     not the student's actual GE course list, so those courses are not graph
 *     vertices; campus-only GE stays;
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
 * Every row reports `edge_info_pct`: the share of its vertices whose
 * prerequisite status is known either way. Placeholder slots are structurally
 * unknowable. Missing edges understate an individual graph's absolute score,
 * but can move transfer-minus-resident in either direction because the two
 * graphs do not necessarily have the same missing-edge pattern.
 */
const { getMajor } = require('../../config/majors');
const { stateClause } = require('../../config/stateScope');
const { resolveSectionTier } = require('../degreeSlots');
const { projectPrereqEdges, projectPrereqGroups } = require('../prereqGraph');
const { curricularComplexity } = require('./curricularComplexity');
const { associateNamedSections, planAssociateDegree } = require('./transferCreditRate');

const normalizeCode = (prefix, number) => `${String(prefix || '').toUpperCase().replace(/\s+/g, ' ').trim()} ${String(number || '').toUpperCase()}`.trim();

const AMBIGUOUS_UNIT_POOL = 'ambiguous_named_unit_pool';

/**
 * Deterministic named-course plan for one associate degree.
 *
 * The transfer-credit model already contains the exact subset search needed
 * for a choose-by-units section. Passing empty eligibility sets gives Figure 6
 * a campus-independent minimum-unit reading of the stored requirement tree.
 *
 * Some collected A.S.-T documents flatten a catalogue sequence/grouping into
 * one unit pool. An optimizer can satisfy the numeric floor but cannot recover
 * the missing grouping. Presentation scoring therefore fails closed on every
 * named unit pool by default. Callers may disable that guard only for a
 * diagnostic of the stored flat model; they must retain the returned warning.
 */
function asDegreeCourseIds(asDoc, ccUnits, { strictUnitPools = true } = {}) {
  const sections = associateNamedSections(asDoc);
  const unitPools = sections.filter((section) => section.unit_advisement != null);
  if (strictUnitPools && unitPools.length) {
    return {
      ids: [], slots: 0, slotUnits: 0,
      method_status: 'excluded',
      exclusion_reason: AMBIGUOUS_UNIT_POOL,
      method_warning: `${unitPools.length} named choose-by-unit section${unitPools.length === 1 ? '' : 's'} cannot be scored without assuming a course grouping.`,
    };
  }

  const unitsById = new Map([...ccUnits.entries()]
    .map(([id, units]) => [Number(id), Number(units) || 0]));
  const plan = planAssociateDegree(sections, new Set(), new Set(), unitsById);
  if (!plan.complete || !plan.ids.length) {
    return {
      ids: [], slots: 0, slotUnits: 0,
      method_status: 'excluded',
      exclusion_reason: 'associate_plan_incomplete',
      method_warning: plan.warnings.join(' ') || 'No complete named-course associate-degree plan could be resolved.',
    };
  }
  return {
    ids: plan.ids,
    slots: 0,
    slotUnits: 0,
    selected_units: plan.total,
    method_status: plan.warnings.length ? 'estimated' : 'ok',
    method_warning: plan.warnings.join(' ') || null,
  };
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
  const completedArticulations = new Set();
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
          // IGETC-satisfiable: covered on the AS side. Gathered associate
          // records preserve the GE block but not a student's selected GE
          // courses, so the transfer graph has no invented GE vertices;
          // resident pathways retain the campus requirement as slots.
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
            // ASSIST may express one sending option against a receiving
            // series.  Completing that option satisfies the whole series; it
            // is not spent again independently for each receiving course.
            // Preserve one shared articulation object in agreementByParent so
            // later degree receivers in the same series recognize the prior
            // completion.  Every covered UC course rewires to the same sending
            // sequence for downstream prerequisite edges.
            if (completedArticulations.has(articulation)) {
              consumed += 1;
              covered = true;
              continue;
            }
            const option = articulation.options.find((ids) => ids.length
              && ids.every((id) => asAvailable.has(id) && !usedAs.has(id)));
            if (option) {
              option.forEach((id) => usedAs.add(id));
              completedArticulations.add(articulation);
              consumed += 1;
              for (const coveredPid of articulation.parentIds || [pid]) {
                const catalogId = ucCatalog.get(ucCodeByParent.get(coveredPid) || '')?.id;
                if (catalogId) substitution.set(catalogId, option.map((id) => `cc:${id}`));
              }
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

/**
 * Resolve an AND-of-OR prerequisite expression against one pathway.
 *
 * `prerequisiteGroups` is the catalogue schema: every outer group is required,
 * while the ids inside one group are alternatives.  A curriculum containing
 * two alternatives must therefore contribute one edge, not two.  If several
 * alternatives are already vertices, retain the first available id in the
 * stored group order (source order for UC captures); this is deterministic,
 * but explicitly not a global minimum-complexity optimization.  An articulated
 * substitution counts as an in-path occurrence.  Older rows that predate the
 * grouped schema retain their historical flat-list behaviour through
 * `legacyIds`.
 */
function resolveUcParents({ prerequisiteGroups, legacyIds, inSet, substitution }) {
  const available = (target) => inSet.has(target)
    || (substitution.get(target) || []).some((key) => inSet.has(key));
  const targets = Array.isArray(prerequisiteGroups) && prerequisiteGroups.length
    ? prerequisiteGroups
      .map((alternatives) => (alternatives || []).find(available))
      .filter(Boolean)
    : (legacyIds || []).filter(available);
  const out = [];
  for (const target of targets) {
    if (inSet.has(target)) out.push(target);
    else out.push(...(substitution.get(target) || []).filter((key) => inSet.has(key)));
  }
  return [...new Set(out)];
}

/**
 * Resolve the concept projection's AND-of-ANY prerequisite groups. When more
 * than one local course is in the pathway, the projection's sorted id order is
 * the deterministic tie-breaker; all courses remain vertices and only this
 * prerequisite edge is selected.
 */
function resolveCcParents({ prerequisiteGroups, legacyIds, inSet }) {
  if (!Array.isArray(prerequisiteGroups)) {
    return [...new Set((legacyIds || []).filter((key) => inSet.has(key)))];
  }
  return [...new Set(prerequisiteGroups
    .map((group) => (group?.anyOf || []).find((key) => inSet.has(key)))
    .filter(Boolean))];
}

function scorePathway(
  { vertices, substitution },
  {
    ccPrereqs,
    ccPrerequisiteGroups = new Map(),
    ucPrereqsById,
    ucPrerequisiteGroupsById = new Map(),
  },
) {
  const keys = [...vertices.keys()];
  const inSet = new Set(keys);
  const parentsOf = (key) => {
    if (key.startsWith('cc:')) {
      return resolveCcParents({
        prerequisiteGroups: ccPrerequisiteGroups.has(key)
          ? ccPrerequisiteGroups.get(key) : undefined,
        legacyIds: ccPrereqs.get(key),
        inSet,
      });
    }
    const meta = vertices.get(key);
    if (!meta?.catalogId) return [];
    return resolveUcParents({
      prerequisiteGroups: ucPrerequisiteGroupsById.get(meta.catalogId),
      legacyIds: ucPrereqsById.get(meta.catalogId),
      inSet,
      substitution,
    }).filter((parent) => parent !== key);
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

async function pathwayComplexityData(
  db,
  visiblePairs,
  { majorSlug = 'cs', degreeType = 'ast', verifiedOnly = false } = {},
) {
  const major = getMajor(majorSlug);
  if (!major) throw new Error(`unknown major: ${majorSlug}`);
  // Every enumerating query below was pinned to the unstamped California
  // corpus, so a ported major passed the capability gate and then matched no
  // documents at all — the figure returned HTTP 200 with zero rows rather than
  // failing. Scope to the major's own state through the shared clause.
  const scope = stateClause(major.state);

  const [degrees, asDocs, ccPrereqs, ccPrerequisiteGroups, ccCourses] = await Promise.all([
    db.collection('curated_requirements')
      .find({ ...scope, kind: 'degree', major_slug: majorSlug }).sort({ _id: 1 }).toArray(),
    db.collection('curated_requirements')
      .find({
        ...scope,
        kind: 'as_degree',
        status: 'found',
        major_slug: majorSlug,
        degree_type: degreeType,
        ...(verifiedOnly ? { 'verification.verified': true } : {}),
      }).toArray(),
    projectPrereqEdges(db),
    projectPrereqGroups(db),
    db.collection('assist_courses')
      .find({ ...scope, side: 'sending' }, { projection: { course_id: 1, units: 1, min_units: 1 } }).toArray(),
  ]);
  const ccUnits = new Map(ccCourses.map((c) => [c.course_id, Number(c.min_units ?? c.units) || null]));
  const collegeRows = await db.collection('assist_institutions')
    .find({ ...scope, kind: 'community_college' }).project({ source_id: 1, name: 1 }).toArray();
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
        .project({
          course_id: 1,
          course_code: 1,
          units: 1,
          prerequisite_groups: 1,
          prerequisite_ids: 1,
        }).toArray(),
      db.collection('assist_courses')
        .find({ institution_id: `uc:${degree.school_id}`, parent_id: { $exists: true, $ne: null } })
        .project({ parent_id: 1, prefix: 1, number: 1 }).toArray(),
      db.collection('assist_agreements')
        .find({ ...scope, uc_school_id: degree.school_id, major: { $in: programs } }).toArray(),
    ]);
    const ucCatalog = new Map();
    const ucPrereqsById = new Map();
    const ucPrerequisiteGroupsById = new Map();
    for (const row of catalogRows) {
      const code = String(row.course_code || '').toUpperCase().replace(/\s+/g, ' ').trim();
      if (!code) continue;
      if (!ucCatalog.has(code)) {
        ucCatalog.set(code, { id: row.course_id, units: Number(row.units) || null });
      }
      if ((row.prerequisite_groups || []).length) {
        ucPrerequisiteGroupsById.set(row.course_id, row.prerequisite_groups);
      }
      if ((row.prerequisite_ids || []).length) ucPrereqsById.set(row.course_id, row.prerequisite_ids);
    }
    const ucCodeByParent = new Map(receivingRows.map((r) => [r.parent_id, normalizeCode(r.prefix, r.number)]));

    const shared = {
      ccPrereqs,
      ccPrerequisiteGroups,
      ucPrereqsById,
      ucPrerequisiteGroupsById,
    };
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
            const articulation = {
              options,
              parentIds: parentIds.filter((pid) => pid != null),
            };
            for (const pid of articulation.parentIds) {
              if (!byParent.has(pid)) byParent.set(pid, articulation);
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
      const selection = asDegreeCourseIds(asDoc, ccUnits);
      const {
        ids: asIds, slots: asSlots, slotUnits: asSlotUnits,
      } = selection;
      const identity = {
        school_id: degree.school_id,
        school: degree.school,
        community_college_id: collegeId,
        college_name: collegeName.get(Number(collegeId)) || asDoc.college_name || String(collegeId),
        degree_type: degreeType,
        record_id: asDoc._id,
        source_catalog_year: asDoc.catalog_year || null,
        source_verified: asDoc.verification?.verified === true,
        source_analysis_ready: asDoc.analysis_ready === true
          ? true : (asDoc.analysis_ready === false ? false : null),
      };
      if (!asIds.length) {
        rows.push({
          ...identity,
          method_status: 'excluded',
          exclusion_reason: selection.exclusion_reason || 'associate_plan_incomplete',
          method_warning: selection.method_warning || null,
          as_courses: null,
          as_selected_units: null,
          requirements_consumed: null,
          n_courses: null,
          n_placeholder: null,
          n_edges: null,
          complexity: null,
          max_delay: null,
          edge_info_pct: null,
          resident_complexity: resident.complexity,
          delta_vs_resident: null,
        });
        continue;
      }
      const pathway = assemblePathway({ degree, asIds, asSlots, asSlotUnits, agreementByParent, ucCatalog, ucCodeByParent, ccUnits });
      const score = scorePathway(pathway, shared);
      rows.push({
        ...identity,
        method_status: selection.method_status,
        exclusion_reason: null,
        method_warning: selection.method_warning,
        as_courses: asIds.length + asSlots,
        as_selected_units: selection.selected_units ?? null,
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
// v3 corrects three pathway-shape semantics: exact associate-degree choices,
// AND-of-OR prerequisite groups, and atomic ASSIST receiving-series coverage.
// Keep this in the cache id so no v2 matrix can survive the model change.
const CACHE_VERSION = 'v3';

async function pathwayComplexityCached(
  db,
  {
    majorSlug = 'cs', degreeType = 'ast', verifiedOnly = true, refresh = false,
  } = {},
) {
  const cohort = verifiedOnly ? 'verified' : 'all';
  const cacheId = `pathway-complexity:${CACHE_VERSION}:${majorSlug}:${degreeType}:${cohort}`;
  if (!refresh) {
    const hit = await db.collection(CACHE_COLLECTION).findOne({ _id: cacheId });
    if (hit?.rows?.length) return { rows: hit.rows, computed_at: hit.computed_at, cached: true };
  }
  const rows = await pathwayComplexityData(db, null, { majorSlug, degreeType, verifiedOnly });
  const computed_at = new Date().toISOString();
  if (rows.length) {
    await db.collection(CACHE_COLLECTION).replaceOne(
      { _id: cacheId },
      {
        _id: cacheId,
        kind: 'pathway-complexity',
        model_version: CACHE_VERSION,
        major_slug: majorSlug,
        degree_type: degreeType,
        verified_only: verifiedOnly,
        rows,
        computed_at,
      },
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
  resolveUcParents,
  resolveCcParents,
  AMBIGUOUS_UNIT_POOL,
};
