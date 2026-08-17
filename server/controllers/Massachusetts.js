/**
 * Massachusetts published baselines: the paper's per-pair values from
 * `CurrComp Master.xlsx`, imported by scripts/ma/importMassachusetts.js.
 * They exist as the diff target for our recomputation — the Massachusetts
 * tab renders them beside the values our own engine computes from the
 * recovered course-level data.
 */
const { asyncHandler } = require('../middleware/asyncHandler');

async function baselinesData(db) {
  const rows = await db.collection('ma_paper_baselines').find({}).toArray();
  const measures = {};
  for (const row of rows) {
    if (!measures[row.measure]) measures[row.measure] = { resident: [], cells: [] };
    const target = row.community_college_id == null ? 'resident' : 'cells';
    measures[row.measure][target].push({
      school_id: row.school_id,
      school: row.school,
      community_college_id: row.community_college_id,
      college_name: row.college_name ?? null,
      value: row.value,
    });
  }
  return {
    measures,
    source: 'CurrComp Master.xlsx (published per-pair values; see server/data/ma/PROVENANCE.md)',
  };
}

exports.baselinesData = baselinesData;

exports.baselines = asyncHandler(async (req, res) => {
  res.json(await baselinesData(req.app.locals.db));
});
