/**
 * Deep-validation cohort: which community colleges the team is hand-
 * validating AS degrees for, plus per-college progress derived from the
 * existing provenance fields (group source/stamps and doc verification).
 * Stored as one settings doc on the audit handle — team state, like tasks.
 */
const DOC_ID = 'as_degree_validation';

function cleanIds(ids = []) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(ids) ? ids : []) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0 || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function groupWasCurated(group) {
  return group?.source === 'curated'
    || Boolean(group?.curated_by || group?.curated_at || group?.reviewed_by || group?.reviewed_at
      || group?.reviewed === true);
}

async function setValidationCohort(auditDb, collegeIds, uid) {
  const college_ids = cleanIds(collegeIds);
  await auditDb.collection('settings').updateOne(
    { _id: DOC_ID },
    { $set: { college_ids, updated_by: uid ?? null, updated_at: new Date() } },
    { upsert: true },
  );
  return { college_ids };
}

async function getValidationCohort(auditDb, db) {
  const doc = await auditDb.collection('settings').findOne({ _id: DOC_ID });
  const college_ids = cleanIds(doc?.college_ids);
  if (!college_ids.length) {
    return {
      college_ids: [],
      colleges: [],
      updated_by: doc?.updated_by ?? null,
      updated_at: doc?.updated_at ?? null,
    };
  }

  const collegeKeys = college_ids.map((id) => `cc:${id}`);
  const [institutions, degrees] = await Promise.all([
    db.collection('assist_institutions')
      .find({ _id: { $in: collegeKeys } }, { projection: { name: 1 } })
      .toArray(),
    db.collection('curated_requirements')
      .find({ kind: 'as_degree', college_id: { $in: collegeKeys } })
      .toArray(),
  ]);

  const nameById = new Map(institutions.map((institution) => [institution._id, institution.name]));
  const byCollege = new Map(college_ids.map((id) => [id, []]));
  for (const degree of degrees) {
    const groups = Array.isArray(degree.requirement_groups) ? degree.requirement_groups : [];
    const collegeDegrees = byCollege.get(Number(degree.community_college_id));
    if (!collegeDegrees) continue;
    collegeDegrees.push({
      record_id: degree._id,
      degree_type: degree.degree_type,
      status: degree.status,
      verified: degree.verification?.verified === true,
      groups_total: groups.length,
      groups_curated: groups.filter(groupWasCurated).length,
    });
  }

  const colleges = college_ids.map((id) => ({
    college_id: id,
    name: nameById.get(`cc:${id}`) ?? null,
    degrees: byCollege.get(id)
      .sort((a, b) => String(a.degree_type).localeCompare(String(b.degree_type))),
  }));

  return {
    college_ids,
    colleges,
    updated_by: doc?.updated_by ?? null,
    updated_at: doc?.updated_at ?? null,
  };
}

module.exports = { getValidationCohort, setValidationCohort };
