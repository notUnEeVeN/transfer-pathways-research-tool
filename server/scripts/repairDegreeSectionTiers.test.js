import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const { startInMemoryMongo } = cjs('../test/mongoHarness');
const { repairDegreeSectionTiers } = cjs('./repairDegreeSectionTiers');

let mongo;
let db;

beforeAll(async () => {
  mongo = await startInMemoryMongo();
  db = mongo.client.db('repair_section_tiers_test');
}, 60_000);

afterAll(async () => { await mongo.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

// Berkeley MCB's rebuild left fifteen sections stamped `tier: 'transferable'`
// under groups marked university-only, and Economics one more. The group's
// word is final (shared rule in degreeSlots.resolveSectionTier); this repair
// makes the stored documents agree with it so no reader ever needs to know
// the contradiction existed.
describe('repairDegreeSectionTiers', () => {
  const seed = (id, groups) => db.collection('curated_requirements').insertOne({
    _id: id, kind: 'degree', school_id: 79, requirement_groups: groups,
  });

  it('aligns contradictory section tiers with a university-only group', async () => {
    await seed('degree:79:bio', [{
      title: 'Upper-division MCB emphasis',
      tier: 'nontransferable',
      course_level: 'upper_division',
      cc_articulable: false,
      group_conjunction: 'Or',
      sections: [
        { tier: 'transferable', unit_advisement: 24 },
        { tier: 'transferable', unit_advisement: 24 },
      ],
    }]);

    const report = await repairDegreeSectionTiers(db, { apply: true });
    expect(report.changed).toEqual([{ doc_id: 'degree:79:bio', sections: 2 }]);

    const doc = await db.collection('curated_requirements').findOne({ _id: 'degree:79:bio' });
    expect(doc.requirement_groups[0].sections.map((s) => s.tier))
      .toEqual(['nontransferable', 'nontransferable']);
    expect(doc.updated_at).toBeInstanceOf(Date);

    const revisions = await db.collection('curated_revisions').find({}).toArray();
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ doc_id: 'degree:79:bio', kind: 'degree' });
    expect(revisions[0].changes.length).toBeGreaterThan(0);
  });

  it('leaves consistent documents untouched and writes nothing on a dry run', async () => {
    await seed('degree:79:cs', [{
      title: 'Upper-division major coursework',
      tier: 'nontransferable',
      sections: [{ tier: 'nontransferable', unit_advisement: 20 }],
    }]);
    await seed('degree:89:bio', [{
      title: 'Preparation',
      tier: 'transferable',
      sections: [{ tier: 'transferable', unit_advisement: 12 }],
    }]);

    const dryOnConsistent = await repairDegreeSectionTiers(db, { apply: true });
    expect(dryOnConsistent.changed).toEqual([]);

    await seed('degree:79:econ', [{
      title: 'Further units earned at Berkeley — transfer cap reached',
      tier: 'nontransferable',
      cc_articulable: false,
      sections: [{ tier: 'transferable', unit_advisement: 10 }],
    }]);
    const dry = await repairDegreeSectionTiers(db, { apply: false });
    expect(dry.changed).toEqual([{ doc_id: 'degree:79:econ', sections: 1 }]);

    const doc = await db.collection('curated_requirements').findOne({ _id: 'degree:79:econ' });
    expect(doc.requirement_groups[0].sections[0].tier).toBe('transferable');
    expect(await db.collection('curated_revisions').countDocuments({})).toBe(0);
  });
});
