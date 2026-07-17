// Read-time computed view over as_degree docs: college-name joins, per-group
// provenance/confidence rollups, and a diff against the statewide template.
// Display-level only — no analysis math lives here (spec §6). The stored doc
// is never mutated; template_default stubs are resolved by the CONSUMER
// joining `template`, not by copying template content into docs.

const TEMPLATE_FALLBACK_ID = 'as_degree_template:cs';
const LOW_CONFIDENCE = 0.7;

function collectCourseIds(docs) {
  const ids = new Set();
  for (const doc of docs) {
    for (const g of doc.requirement_groups || []) {
      for (const s of g.sections || []) {
        for (const r of s.receivers || []) {
          for (const o of r.options || []) {
            for (const id of o.course_ids || []) ids.add(id);
          }
        }
      }
    }
  }
  return [...ids];
}

async function loadCourses(db, docs) {
  const ids = collectCourseIds(docs);
  if (!ids.length) return [];
  return db.collection('assist_courses')
    .find({ _id: { $in: ids.map((id) => `cc:${id}`) } },
      { projection: { course_id: 1, prefix: 1, number: 1, title: 1, units: 1, concept: 1 } })
    .toArray();
}

// Best-effort display sum (spec §5 unit accounting): unit-advisement sections
// contribute their stated units; all-required sections sum each receiver's
// first option; choose-N sections contribute N × the mean receiver units.
function groupUnits(group, unitsByCourseId) {
  if (group.units_fill || group.source === 'template_default') return 0;
  let total = 0;
  for (const s of group.sections || []) {
    if (s.unit_advisement != null) { total += s.unit_advisement; continue; }
    const perReceiver = (s.receivers || []).map((r) => {
      const opt = (r.options || [])[0];
      if (!opt) return 0;
      return (opt.course_ids || []).reduce((sum, id) => sum + (unitsByCourseId.get(id) || 0), 0);
    });
    const sum = perReceiver.reduce((a, b) => a + b, 0);
    if (s.section_advisement != null && perReceiver.length) {
      total += s.section_advisement * (sum / perReceiver.length);
    } else {
      total += sum;
    }
  }
  return total;
}

function computeDeviations(doc, template) {
  const docIds = new Set((doc.requirement_groups || []).map((g) => g.group_id));
  return {
    missing_groups: (template && template.groups ? template.groups : [])
      .map((g) => g.group_id)
      .filter((id) => !docIds.has(id)),
    extra_groups: (doc.requirement_groups || [])
      .filter((g) => g.template_group == null)
      .map((g) => g.group_id),
  };
}

function summarizeDoc(doc, template, collegeName, unitsByCourseId) {
  const groups = doc.requirement_groups || [];
  const sourceCounts = { extracted: 0, template_default: 0, curated: 0 };
  const confidences = [];
  let unresolved = 0;
  for (const g of groups) {
    if (sourceCounts[g.source] != null) sourceCounts[g.source] += 1;
    if (g.source === 'extracted' && Number.isFinite(g.confidence)) confidences.push(g.confidence);
    unresolved += (g.unresolved_courses_seen || []).length;
  }
  const unitsAccounted = Math.round(
    groups.reduce((sum, g) => sum + groupUnits(g, unitsByCourseId), 0) * 10) / 10;
  const deviations = computeDeviations(doc, template);
  const flags = [];
  if (doc.status === 'ambiguous') flags.push('ambiguous');
  if (sourceCounts.template_default > 0) flags.push('template_default_groups');
  if (confidences.some((c) => c < LOW_CONFIDENCE)) flags.push('low_confidence');
  if (unresolved > 0) flags.push('unresolved_courses');
  const hasFill = groups.some((g) => g.units_fill);
  if (doc.status === 'found' && !hasFill && Number.isFinite(doc.total_units)
      && Math.abs(unitsAccounted - doc.total_units) > 1) {
    flags.push('units_mismatch');
  }
  return {
    _id: doc._id,
    community_college_id: doc.community_college_id,
    college_id: doc.college_id,
    college_name: collegeName || null,
    degree_type: doc.degree_type ?? null,
    major_slug: doc.major_slug ?? null,
    status: doc.status,
    degree_title_seen: doc.degree_title_seen || null,
    catalog_url: doc.catalog_url || null,
    catalog_year: doc.catalog_year || null,
    unit_system: doc.unit_system || null,
    total_units: doc.total_units ?? null,
    group_count: groups.length,
    source_counts: sourceCounts,
    confidence_min: confidences.length ? Math.min(...confidences) : null,
    confidence_mean: confidences.length
      ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100) / 100
      : null,
    unresolved_count: unresolved,
    units_accounted: unitsAccounted,
    deviations,
    flags,
    verified: !!(doc.verification && doc.verification.verified),
    updated_at: doc.updated_at ?? null,
  };
}

async function asDegreeOverview(db) {
  const [template, docs, institutions] = await Promise.all([
    db.collection('curated_requirements').findOne({ kind: 'as_degree_template' }),
    db.collection('curated_requirements').find({ kind: 'as_degree' }).toArray(),
    db.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { name: 1 } }).toArray(),
  ]);
  const nameById = new Map(institutions.map((i) => [i._id, i.name]));
  const courses = await loadCourses(db, docs);
  const unitsByCourseId = new Map(courses.map((c) => [c.course_id, c.units || 0]));
  const rows = docs
    .map((d) => summarizeDoc(d, template, nameById.get(d.college_id), unitsByCourseId))
    .sort((a, b) => String(a.college_name).localeCompare(String(b.college_name)));
  return { template, rows };
}

async function asDegreeDetail(db, collegeId) {
  const docs = await db.collection('curated_requirements')
    .find({ kind: 'as_degree', college_id: String(collegeId) }).toArray();
  if (!docs.length) return null;
  const inst = await db.collection('assist_institutions')
    .findOne({ _id: String(collegeId) }, { projection: { name: 1 } });
  const degrees = await Promise.all(docs.map(async (doc) => {
    const [template, courses] = await Promise.all([
      db.collection('curated_requirements')
        .findOne({ _id: doc.template_ref || TEMPLATE_FALLBACK_ID }),
      loadCourses(db, [doc]),
    ]);
    const coursesById = Object.fromEntries(courses.map((c) => [`cc:${c.course_id}`, {
      code: `${c.prefix} ${c.number}`,
      title: c.title ?? null,
      units: c.units ?? null,
      concept: c.concept ?? null,
    }]));
    return {
      doc,
      courses_by_id: coursesById,
      deviations: computeDeviations(doc, template),
      degree_type: doc.degree_type ?? null,
    };
  }));
  return {
    college_name: inst ? inst.name : null,
    degrees,
  };
}

module.exports = { asDegreeOverview, asDegreeDetail };
