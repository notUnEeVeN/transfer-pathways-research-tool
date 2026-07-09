// Attach district/region/county geography (from ref_cc_districts, keyed by
// college id) to each community college so the data explorer can filter the
// college list by district/county/region. Pure + unit-tested; colleges without
// a geography row keep null/[] so the response shape stays uniform.
function mergeGeography(colleges, geoDocs) {
  const byId = new Map(geoDocs.map((g) => [Number(g._id), g]));
  return colleges.map((c) => {
    const g = byId.get(Number(c.id)) || null;
    return {
      ...c,
      district: g?.district ?? null,
      region: g?.region ?? null,
      counties_served: Array.isArray(g?.counties_served) ? g.counties_served : [],
    };
  });
}

exports.listAll = async (req, res) => {
  try {
    const db = req.app.locals.db;
    // ref_cc_districts lives with the analysis reference tables (same handle
    // loadRefs uses); community_colleges is a ported catalog collection.
    const auditDb = req.app.locals.auditDb || db;
    const [colleges, geoDocs] = await Promise.all([
      db.collection('community_colleges').find().toArray(),
      auditDb
        .collection('ref_cc_districts')
        .find({}, { projection: { district: 1, region: 1, counties_served: 1 } })
        .toArray(),
    ]);
    res.json(mergeGeography(colleges, geoDocs));
  } catch (error) {
    console.error('Error retrieving community colleges:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports._mergeGeography = mergeGeography;
