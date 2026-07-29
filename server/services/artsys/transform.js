/**
 * Parsed ARTSYS guides -> canonical documents shaped exactly like the ASSIST
 * corpus, so `services/analysis/eligibility.js` runs over them unmodified.
 *
 * Field naming: the California collections carry California names
 * (`uc_school_id`, `community_college_id`). Those are not reused here — a
 * Maryland receiving institution is not a UC campus, and borrowing the label
 * would make every downstream query ambiguous about what it is reading. The
 * ARTSYS documents use the neutral names the canonical migration already emits
 * (`college_id`, `university_id`, `major`, `system`, `requirement_groups`),
 * which is the subset the eligibility engine and the analysis layer actually
 * consume.
 *
 * Branch -> section mapping. ARTSYS states the conjunction in the CSS class:
 *   `andbranch` — every listed receiver is required  -> section_advisement = N
 *   `orbranch`  — any one of them satisfies          -> section_advisement = 1
 * This matches how the California ASSIST parser encodes "complete all listed"
 * (section_advisement = receiver count) so a genuinely missing receiver leaves
 * the choose-N minimum unmet rather than silently passing.
 */
const {
  SOURCE, STATE, collegeId, universityId, courseId, agreementId, receiverHash,
} = require('./ids');

/** Maryland receiving institutions, from the guide index filter. */
const RECEIVING_INSTITUTIONS = Object.freeze({
  1733: 'Bowie State University',
  1735: 'Capitol Technology University',
  1740: 'Coppin State University',
  1744: 'Frostburg State University',
  1747: 'Goucher College',
  1751: 'Hood College',
  1769: 'Morgan State University',
  12633: "Mount St. Mary's University",
  1773: 'Notre Dame of Maryland University',
  1777: 'Salisbury University',
  1786: 'Stevenson University',
  1778: "St. Mary's College of Maryland",
  1781: 'Towson University',
  1731: 'University of Baltimore',
  12644: 'University of Maryland, Baltimore',
  12645: 'University of Maryland, Baltimore County',
  12646: 'University of Maryland, College Park',
  1765: 'University of Maryland, Eastern Shore',
  1760: 'University of Maryland Global Campus',
  1789: 'Washington College',
});

const nameToReceivingId = new Map(
  Object.entries(RECEIVING_INSTITUTIONS).map(([id, name]) => [norm(name), Number(id)])
);

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Resolve the receiving institution from the guide header text. */
function resolveReceivingInstitution(name) {
  const key = norm(name);
  if (nameToReceivingId.has(key)) {
    return { artsys_id: nameToReceivingId.get(key), name: RECEIVING_INSTITUTIONS[nameToReceivingId.get(key)] };
  }
  // Header text can carry a trailing fragment; fall back to a prefix match
  // before giving up, then record the miss rather than inventing an id.
  for (const [candidate, id] of nameToReceivingId) {
    if (key.startsWith(candidate) || candidate.startsWith(key)) {
      return { artsys_id: id, name: RECEIVING_INSTITUTIONS[id] };
    }
  }
  return null;
}

/**
 * Convert one parsed guide rendering into the canonical trio.
 *
 * @param {object} parsed output of parseGuide()
 * @returns {{agreement:object|null, courses:object[], institutions:object[], problems:string[]}}
 */
function transformGuide(parsed) {
  const problems = [];
  const receiving = resolveReceivingInstitution(parsed.receiving_institution);
  const sender = parsed.sender;
  if (!receiving) problems.push(`unresolved receiving institution: ${parsed.receiving_institution}`);
  if (!sender) problems.push('no selected sender on page');
  if (!receiving || !sender) return { agreement: null, courses: [], institutions: [], problems };

  const collegeKey = collegeId(sender.artsys_id);
  const universityKey = universityId(receiving.artsys_id);
  const courses = new Map();

  const addCourse = (institutionKey, side, { code, title, units = null, artsysCourseId = null }) => {
    if (!code) return null;
    const id = courseId({ artsysCourseId, institutionId: institutionKey, code });
    const prior = courses.get(id);
    // Later sightings can carry a title or units the first did not; merge
    // upward rather than overwriting a populated field with null.
    courses.set(id, {
      _id: id,
      canonical_id: id,
      source: SOURCE,
      state: STATE,
      institution_id: institutionKey,
      side,
      artsys_course_id: artsysCourseId ?? prior?.artsys_course_id ?? null,
      prefix: /^([A-Za-z]+)/.exec(code)?.[1] ?? null,
      number: /([0-9].*)$/.exec(code)?.[1] ?? null,
      code,
      title: title ?? prior?.title ?? null,
      units: units ?? prior?.units ?? null,
      min_units: units ?? prior?.min_units ?? null,
      max_units: units ?? prior?.max_units ?? null,
    });
    return id;
  };

  const requirementGroups = (parsed.groups || []).map((group) => {
    const rule = group.rule || {};
    const groupKey = `g${group.index}`;
    const sections = (group.sections || []).map((section) => {
      const receivers = (section.receivers || []).map((r) => {
        const recv = r.receiving || {};
        const receivingCourseKey = recv.kind === 'course'
          ? addCourse(universityKey, 'receiving', {
            code: recv.code,
            title: recv.title,
            units: recv.units,
            artsysCourseId: recv.artsys_course_id,
          })
          : null;

        const options = (r.options || []).map((opt) => {
          const ids = (opt.courses || []).map((c) => addCourse(collegeKey, 'sending', {
            code: c.code,
            title: c.title,
            artsysCourseId: opt.courses.length === 1 ? opt.artsys_course_id : null,
          })).filter(Boolean);
          return {
            course_ids: ids,
            // The California corpus stores raw numeric ids in `course_ids` and
            // namespaced keys in `course_keys`. Here the canonical id IS the
            // namespaced key, so both fields hold it and any consumer of
            // either field behaves identically.
            course_keys: ids,
            course_conjunction: opt.conjunction === 'and' ? 'and' : 'or',
            artsys_equivalency_id: opt.artsys_equivalency_id ?? null,
            label: opt.label ?? null,
          };
        }).filter((opt) => opt.course_ids.length);

        return {
          receiving: {
            kind: recv.kind || 'course',
            course_id: receivingCourseKey,
            code: recv.code ?? null,
            title: recv.title ?? null,
            label: recv.label ?? null,
            units: recv.units ?? null,
          },
          articulation_status: r.status === 'articulated' ? 'articulated' : 'not_articulated',
          not_articulated_reason: r.status === 'articulated' ? null : 'no_course_articulated',
          hash_id: receiverHash(parsed.guide_id, groupKey, recv.label || recv.code || ''),
          slot: r.slot ?? null,
          // Options are alternatives: any one satisfies the receiver.
          options_conjunction: 'or',
          options,
        };
      });

      // When the group states its own course count, the section must NOT cap
      // its own contribution: "Complete the following 2 requirements" over an
      // or-section of 19 alternatives means pick 2 of the 19, and a
      // section_advisement of 1 makes the group unsatisfiable by construction.
      // A null advisement lets `getEffectiveGroupAsk` cap at the group's ask,
      // which is the same shape ASSIST uses for bare buckets under a group
      // advisement. Only when the group states nothing does the branch
      // conjunction carry the requirement itself.
      const groupStatesCount = rule.group_advisement != null;
      return {
        section_advisement: groupStatesCount
          ? null
          : (section.conjunction === 'or' ? 1 : receivers.length),
        unit_advisement: null,
        conjunction: section.conjunction,
        implicit: !!section.implicit,
        receivers,
      };
    });

    return {
      group_id: groupKey,
      // ARTSYS guides list only requirements that count toward the degree;
      // there is no optional/recommended flag in the markup, so every group is
      // required. Recorded explicitly so the engine's `is_required` filter
      // behaves the same way it does on ASSIST documents.
      is_required: true,
      label: group.header || null,
      group_conjunction: 'And',
      group_advisement: rule.group_advisement ?? null,
      group_unit_advisement: rule.group_unit_advisement ?? null,
      group_min_distinct_sections: rule.group_min_distinct_sections ?? null,
      group_max_distinct_sections: rule.group_max_distinct_sections ?? null,
      group_section_min_courses: rule.group_min_distinct_sections != null ? 1 : null,
      stated_credits: rule.stated_credits ?? null,
      min_grade: rule.min_grade ?? null,
      no_double_count: !!rule.no_double_count,
      rule_constructs: rule.constructs ?? [],
      rule_matched: !!rule.matched,
      sections,
    };
  });

  const agreement = {
    _id: agreementId(parsed.guide_id, sender.artsys_id),
    source: SOURCE,
    state: STATE,
    system: 'artsys',
    guide_id: parsed.guide_id,
    college_id: collegeKey,
    college_name: sender.name ?? null,
    university_id: universityKey,
    university_name: receiving.name,
    major: parsed.program ?? null,
    effective: parsed.effective ?? null,
    requirement_groups: requirementGroups,
  };

  const institutions = [
    {
      _id: collegeKey,
      institution_id: collegeKey,
      source: SOURCE,
      state: STATE,
      artsys_id: sender.artsys_id,
      kind: 'community_college',
      system: 'mdcc',
      name: sender.name ?? null,
    },
    {
      _id: universityKey,
      institution_id: universityKey,
      source: SOURCE,
      state: STATE,
      artsys_id: receiving.artsys_id,
      kind: 'university',
      system: 'md4yr',
      name: receiving.name,
    },
  ];

  return { agreement, courses: [...courses.values()], institutions, problems };
}

module.exports = { transformGuide, resolveReceivingInstitution, RECEIVING_INSTITUTIONS };
