/**
 * Articulation depth — how much of each campus program's stated preparation
 * universe (required AND recommended receiver slots) has an articulated
 * equivalent, rolled up per community college district.
 *
 * The measure behind the depth-and-income figure. Every campus defines its own
 * receiver universe, so a college's share is computed against EACH campus's own
 * agreement and then averaged across campuses — never pooled raw counts, which
 * would let a campus with a large template dominate. Campuses that encode no
 * recommended groups (their competitive expectations live in the required
 * layer or in prose) simply contribute their required-only universe; the
 * union share is well-defined either way.
 *
 * Rows are district-level: { district, n_colleges, colleges, coverage_all,
 * coverage_required, coverage_recommended } with coverage_recommended null
 * when no visible campus encodes a recommended layer.
 */
const { programPairs } = require('../../config/majors');
const { pairAllowed } = require('../majorVisibility');

function layerCounts(groups, layer) {
  let total = 0;
  let articulated = 0;
  for (const group of groups || []) {
    const isRequired = group.is_required === true;
    if (layer === 'required' && !isRequired) continue;
    if (layer === 'recommended' && isRequired) continue;
    for (const section of group.sections || []) {
      for (const receiver of section.receivers || []) {
        total += 1;
        if (receiver.articulation_status === 'articulated') articulated += 1;
      }
    }
  }
  return { total, articulated };
}

const LAYERS = ['all', 'required', 'recommended'];

async function articulationDepthData(db, auditDb, params) {
  const pairs = programPairs(params.majorPrograms);
  if (!pairs.length) return [];
  const visible = params.visiblePairs == null
    ? pairs
    : pairs.filter((pair) => pairAllowed(params.visiblePairs, pair.school_id, pair.major));
  if (!visible.length) return [];

  const [agreements, institutions] = await Promise.all([
    db.collection('assist_agreements')
      .find(
        { $or: visible.map((pair) => ({ uc_school_id: pair.school_id, major: pair.major })) },
        { projection: { requirement_groups: 1, community_college_id: 1 } },
      )
      .toArray(),
    db.collection('assist_institutions')
      .find({ kind: 'community_college' }, { projection: { source_id: 1, name: 1, district: 1 } })
      .toArray(),
  ]);

  // college -> layer -> { sum of per-campus shares, campuses contributing }
  const perCollege = new Map();
  for (const agreement of agreements) {
    const collegeId = Number(agreement.community_college_id);
    for (const layer of LAYERS) {
      const { total, articulated } = layerCounts(agreement.requirement_groups, layer);
      if (!total) continue; // this campus defines no such universe — no vote
      const key = `${collegeId}:${layer}`;
      const cur = perCollege.get(key) || { sum: 0, n: 0 };
      cur.sum += articulated / total;
      cur.n += 1;
      perCollege.set(key, cur);
    }
  }

  const byDistrict = new Map();
  for (const inst of institutions) {
    if (!inst.district) continue;
    const collegeId = Number(inst.source_id);
    const all = perCollege.get(`${collegeId}:all`);
    if (!all) continue; // college outside this major's agreement corpus
    const row = byDistrict.get(inst.district) || {
      district: inst.district,
      colleges: [],
      sums: { all: 0, required: 0, recommended: 0 },
      counts: { all: 0, required: 0, recommended: 0 },
    };
    row.colleges.push(inst.name);
    for (const layer of LAYERS) {
      const cur = perCollege.get(`${collegeId}:${layer}`);
      if (!cur) continue;
      row.sums[layer] += cur.sum / cur.n;
      row.counts[layer] += 1;
    }
    byDistrict.set(inst.district, row);
  }

  return [...byDistrict.values()]
    .map((row) => ({
      district: row.district,
      n_colleges: row.counts.all,
      colleges: row.colleges.sort(),
      coverage_all: row.counts.all ? row.sums.all / row.counts.all : null,
      coverage_required: row.counts.required ? row.sums.required / row.counts.required : null,
      coverage_recommended: row.counts.recommended
        ? row.sums.recommended / row.counts.recommended
        : null,
    }))
    .sort((a, b) => a.district.localeCompare(b.district));
}

module.exports = { articulationDepthData, layerCounts };
