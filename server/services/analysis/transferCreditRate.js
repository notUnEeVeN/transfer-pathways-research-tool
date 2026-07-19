/**
 * Transfer credit rate — the MA paper's Figure 3 construct on our CA data:
 * for each (community college with a CS associate degree, UC campus) pair,
 * the share of the degree's PRESCRIBED units that land on the campus's
 * four-year graduation requirements.
 *
 *   rate = (transferred named units + UC-verified GE units)
 *        / (chosen named units      + stated GE units)
 *
 * Locked design decisions (2026-07-18 session):
 *   - Prescribed units only: free-elective (`units_fill`) groups are excluded
 *     from BOTH sides — they have no course identity, so any treatment would
 *     be an assumption rather than a measurement.
 *   - A named course transfers iff it belongs to a usable articulation option
 *     for a receiver the campus template requires, where usable means EVERY
 *     course of the option's AND-group is inside the degree's course set (the
 *     series guard — half a physics sequence transfers nothing alone).
 *   - Units count once per distinct course, however many template slots it
 *     fills: requirements may double-count, credits never do.
 *   - Choice resolution is the optimal student with the LOWER unit count:
 *     transferring picks first, then fewer units (ties don't matter).
 *   - GE blocks all count as transferring, on two different bases surfaced in
 *     the payload: Cal-GETC / IGETC satisfy UC lower-division breadth BY
 *     DESIGN (verified); CSU GE and local patterns have no course-level UC
 *     pairing, but the optimal transfer-bound student fills them with the
 *     college's UC-transferable, IGETC-tagged courses — the same dual-
 *     qualifying pool the graduation-coverage view counts (e.g. 68 such
 *     courses at Yuba for Berkeley's H/SS areas) — so they count as ASSUMED.
 *   - Courses the catalog cites but ASSIST can't resolve are ignored on both
 *     sides (97.8% resolution) and surfaced via `unresolved_count`.
 *   - A pair with no ASSIST agreement at all yields a null cell (cannot
 *     verify ≠ verified zero).
 */

const GE_UC_VERIFIED = new Set(['calgetc', 'igetc']);
// Stated pattern unit asks, used when the stored group carries no
// unit_advisement of its own.
const GE_DEFAULT_UNITS = { calgetc: 34, igetc: 37, csu_ge: 39 };

const DEGREE_TYPES = ['local_cs_as', 'ast'];

function receivingPids(receiving) {
  if (!receiving) return [];
  if (receiving.kind === 'series') return (receiving.parent_ids || []).map(Number).filter(Number.isFinite);
  if (receiving.kind === 'course' && receiving.parent_id != null) return [Number(receiving.parent_id)];
  return [];
}

// The degree's named-course structure: per section, the ask (choose-N or all)
// and each requirement row's alternative options as numeric course-id lists.
function namedSections(doc) {
  const sections = [];
  for (const group of doc.requirement_groups || []) {
    if (group.units_fill || group.ge_area) continue;
    for (const section of group.sections || []) {
      const receivers = (section.receivers || []).map((receiver) => ({
        options: (receiver.options || [])
          .map((option) => (option.course_ids || []).map(Number).filter(Number.isFinite))
          .filter((ids) => ids.length),
      })).filter((receiver) => receiver.options.length);
      if (!receivers.length) continue;
      const ask = section.section_advisement != null
        ? Math.min(section.section_advisement, receivers.length)
        : receivers.length;
      sections.push({ ask, receivers });
    }
  }
  return sections;
}

// A GE block the extraction recognized by label but couldn't map to any
// pattern — counts like a local pattern (assumed) so its units don't vanish.
// Only pure unit blocks qualify: a group with named receivers already runs
// through the course-articulation path.
const GE_LABEL = /general\s*education|\bgen(?:eral)?[\s.]*ed\b/i;

// The degree's GE blocks: stated units plus the basis on which they count —
// verified (a UC transfer pattern) or assumed (everything else; the optimal
// student fills these areas with the college's dual-qualifying courses).
function geBlocks(doc) {
  const blocks = [];
  for (const group of doc.requirement_groups || []) {
    if (group.units_fill) continue;
    const hasReceivers = (group.sections || []).some((section) => (section.receivers || []).length);
    const labelledGe = !group.ge_area && !hasReceivers && GE_LABEL.test(group.label_seen || '');
    if (!group.ge_area && !labelledGe) continue;
    const stated = (group.sections || [])[0]?.unit_advisement;
    const units = Number.isFinite(Number(stated)) && Number(stated) > 0
      ? Number(stated)
      : GE_DEFAULT_UNITS[group.ge_area] || 0;
    if (!units) continue; // no stated ask and no pattern default — nothing to count
    blocks.push({
      pattern: group.ge_area || 'unlabelled',
      units,
      verified: GE_UC_VERIFIED.has(group.ge_area),
    });
  }
  return blocks;
}

function unresolvedCount(doc) {
  return (doc.requirement_groups || [])
    .reduce((n, group) => n + (group.unresolved_courses_seen || []).length, 0);
}

// Union across the pair's agreements: every usable articulation option (all
// of its courses inside the degree) for a receiver the template requires.
// Returns the set of degree course-ids that transfer.
function transferableCourseIds(pairAgreements, templatePids, degreeCourseSet) {
  const transferable = new Set();
  for (const agreement of pairAgreements) {
    for (const group of agreement.requirement_groups || []) {
      for (const section of group.sections || []) {
        for (const receiver of section.receivers || []) {
          if (receiver.articulation_status !== 'articulated') continue;
          if (!receivingPids(receiver.receiving).some((pid) => templatePids.has(pid))) continue;
          for (const option of receiver.options || []) {
            const ids = (option.course_ids || []).map(Number).filter(Number.isFinite);
            if (!ids.length || !ids.every((id) => degreeCourseSet.has(id))) continue;
            for (const id of ids) transferable.add(id);
          }
        }
      }
    }
  }
  return transferable;
}

// Optimal-student accounting over one degree at one campus. Every course's
// units count once (`counted` dedupes across rows); per requirement row the
// chosen option, and per choose-N section the chosen rows, prefer
// transferring picks first and lower units second.
function namedUnitTotals(sections, transferable, unitsById) {
  const counted = new Set();
  let total = 0;
  let transferred = 0;

  const optionScore = (ids) => {
    let optionTotal = 0;
    let optionTransferred = 0;
    for (const id of ids) {
      const units = unitsById.get(id) || 0;
      optionTotal += units;
      if (transferable.has(id)) optionTransferred += units;
    }
    return { ids, optionTotal, optionTransferred };
  };
  // Rank by transferred SHARE, then by the lower unit count — so a fully
  // transferring 3u pick beats a fully transferring 4u one (the lower-unit
  // rule), while any transferring pick still beats a blocked one.
  const ratio = (option) => (option.optionTotal ? option.optionTransferred / option.optionTotal : 0);
  const better = (a, b) => ratio(b) - ratio(a) || a.optionTotal - b.optionTotal;

  for (const section of sections) {
    const picks = section.receivers
      .map((receiver) => receiver.options.map(optionScore).sort(better)[0])
      .sort(better)
      .slice(0, section.ask);
    for (const pick of picks) {
      for (const id of pick.ids) {
        if (counted.has(id)) continue;
        counted.add(id);
        const units = unitsById.get(id) || 0;
        total += units;
        if (transferable.has(id)) transferred += units;
      }
    }
  }
  return { total, transferred };
}

async function transferCreditRateData(db, _auditDb, { degreeType = 'local_cs_as' } = {}) {
  const type = DEGREE_TYPES.includes(degreeType) ? degreeType : 'local_cs_as';
  const [degrees, templates, institutions] = await Promise.all([
    db.collection('curated_requirements')
      .find({ kind: 'as_degree', degree_type: type, status: 'found' }).toArray(),
    db.collection('curated_requirements').find({ kind: 'degree' }).toArray(),
    db.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { name: 1, source_id: 1 } }).toArray(),
  ]);

  const campuses = templates
    .map((template) => {
      const pids = new Set();
      for (const group of template.requirement_groups || []) {
        for (const section of group.sections || []) {
          for (const receiver of section.receivers || []) {
            for (const pid of receivingPids(receiver.receiving)) pids.add(pid);
          }
        }
      }
      return { school_id: Number(template.school_id), school: template.school, pids };
    })
    .sort((a, b) => String(a.school).localeCompare(String(b.school)));

  const collegeIds = [...new Set(degrees.map((d) => Number(d.community_college_id)))];
  const agreements = collegeIds.length && campuses.length
    ? await db.collection('assist_agreements').find(
      {
        uc_school_id: { $in: campuses.map((c) => c.school_id) },
        community_college_id: { $in: collegeIds },
      },
      { projection: { uc_school_id: 1, community_college_id: 1, requirement_groups: 1 } }
    ).toArray()
    : [];
  const agreementsByPair = new Map();
  for (const agreement of agreements) {
    const key = `${agreement.uc_school_id}:${agreement.community_college_id}`;
    if (!agreementsByPair.has(key)) agreementsByPair.set(key, []);
    agreementsByPair.get(key).push(agreement);
  }

  // One catalog read for every named course's units across all degrees.
  const allNamedIds = new Set();
  const parsed = degrees.map((doc) => {
    const sections = namedSections(doc);
    const courseSet = new Set(sections.flatMap((s) => s.receivers.flatMap((r) => r.options.flat())));
    for (const id of courseSet) allNamedIds.add(id);
    return { doc, sections, courseSet, ge: geBlocks(doc), unresolved: unresolvedCount(doc) };
  });
  const unitsById = new Map();
  if (allNamedIds.size) {
    const courseRows = await db.collection('assist_courses').find(
      { side: 'sending', course_id: { $in: [...allNamedIds] } },
      { projection: { course_id: 1, units: 1, _id: 0 } }
    ).toArray();
    for (const course of courseRows) unitsById.set(Number(course.course_id), Number(course.units) || 0);
  }

  const nameById = new Map(institutions.map((i) => [Number(i.source_id), i.name]));
  const rows = [];
  for (const { doc, sections, courseSet, ge, unresolved } of parsed) {
    const collegeId = Number(doc.community_college_id);
    const geUnits = ge.reduce((sum, block) => sum + block.units, 0);
    const geVerifiedUnits = ge.reduce((sum, block) => sum + (block.verified ? block.units : 0), 0);
    // Assumed = transferring via the optimal student's dual-qualifying picks
    // rather than a pattern-level UC guarantee.
    const geAssumedUnits = geUnits - geVerifiedUnits;
    for (const campus of campuses) {
      const pairAgreements = agreementsByPair.get(`${campus.school_id}:${collegeId}`) || [];
      let row = {
        community_college_id: collegeId,
        college_name: nameById.get(collegeId) || doc.college_name || `College ${collegeId}`,
        school_id: campus.school_id,
        school: campus.school,
        degree_type: type,
        record_id: doc._id,
        ge_units: geUnits,
        ge_verified_units: geVerifiedUnits,
        ge_assumed_units: geAssumedUnits,
        unresolved_count: unresolved,
      };
      if (!pairAgreements.length) {
        // No articulation data for the pair — unverifiable, not zero.
        row = { ...row, rate: null, prescribed_units: null, transferred_units: null, named_units: null, named_transferred_units: null };
      } else {
        const transferable = transferableCourseIds(pairAgreements, campus.pids, courseSet);
        const named = namedUnitTotals(sections, transferable, unitsById);
        const prescribed = named.total + geUnits;
        // All GE counts: verified patterns by design, the rest assumed.
        const transferred = named.transferred + geUnits;
        row = {
          ...row,
          rate: prescribed > 0 ? +((100 * transferred) / prescribed).toFixed(1) : null,
          prescribed_units: prescribed,
          transferred_units: transferred,
          named_units: named.total,
          named_transferred_units: named.transferred,
        };
      }
      rows.push(row);
    }
  }
  rows.sort((a, b) => String(a.college_name).localeCompare(String(b.college_name))
    || String(a.school).localeCompare(String(b.school)));
  return rows;
}

module.exports = { transferCreditRateData, GE_DEFAULT_UNITS };
