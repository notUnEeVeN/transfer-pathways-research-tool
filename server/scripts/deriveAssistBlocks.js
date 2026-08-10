#!/usr/bin/env node
/**
 * Recover the lower-division *block* structure a UC major asks for, from the
 * 115 ASSIST agreements that describe it.
 *
 *   node scripts/deriveAssistBlocks.js                  # report every major
 *   node scripts/deriveAssistBlocks.js --campus 89      # one campus
 *   node scripts/deriveAssistBlocks.js --json           # machine-readable
 *
 * Why this exists: our degree documents collapse "choose one complete series"
 * into a single section carrying a unit count, which throws away the
 * alternatives. A college that teaches Physics 5 but not Physics 1 then looks
 * identical to one that teaches neither. ASSIST already carries the structure —
 * `kind: 'series'` receivers with parent_ids, a conjunction and a unit total —
 * so this reads it back out rather than inventing it.
 *
 * Two things make it more than a union:
 *
 *   - **Subset blocks are artefacts, not alternatives.** A college articulating
 *     only part of a series produces a short series in its agreement. Davis
 *     mathematics yields MAT 021A+B+C+D alongside A+B+C, A+B, B+C+D, B+C and
 *     C+D. Only the maximal block is a requirement; the rest are that college's
 *     partial coverage. We keep maximal blocks and record how many colleges
 *     showed each, so a genuinely rare alternative is still distinguishable from
 *     a common partial.
 *
 *   - **A block can be short of the real requirement.** ASSIST only ever names
 *     courses some college articulates to. Davis chemistry gives a CHE 002A+002B
 *     block while CHE 002C appears loose in the same agreements, and UCLA omits
 *     MATH 31AL and the whole CHEM 14 series that its catalogue requires. Loose
 *     courses sharing a block's prefix are reported as `possibly_incomplete` so
 *     the campus catalogue can settle it. This tool cannot.
 */
const { MongoClient } = require('mongodb');

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : (i >= 0 ? true : fallback);
};

const CAMPUS = Object.freeze({
  79: 'UC Berkeley', 89: 'UC Davis', 120: 'UC Irvine', 117: 'UCLA', 144: 'UC Merced',
  46: 'UC Riverside', 7: 'UC San Diego', 128: 'UC Santa Barbara', 132: 'UC Santa Cruz',
});

/** "MATH 31A" -> "MATH 31", so a series and its loose courses group together. */
const family = (code) => {
  const m = /^(.*?)\s*(\d+)/.exec(code);
  return m ? `${m[1].trim()} ${m[2]}` : code;
};

const isSubset = (a, b) => a.length < b.length && a.every((x) => b.includes(x));

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(process.env.DB_NAME);

  const only = arg('campus');
  const asJson = arg('json') === true;
  const report = [];

  const campuses = (await db.collection('assist_agreements').distinct('uc_school_id'))
    .filter((id) => !only || String(id) === String(only))
    .sort((a, b) => a - b);

  for (const schoolId of campuses) {
    const courses = await db.collection('assist_courses')
      .find({ side: 'receiving', university_id: schoolId })
      .project({ parent_id: 1, prefix: 1, number: 1, min_units: 1 })
      .toArray();
    const byId = new Map();
    for (const c of courses) {
      if (c.parent_id != null) {
        byId.set(String(c.parent_id), { code: `${c.prefix} ${c.number}`.trim(), units: c.min_units });
      }
    }

    const majors = await db.collection('assist_agreements').distinct('major', { uc_school_id: schoolId });
    for (const major of majors) {
      const agreements = await db.collection('assist_agreements')
        .find({ uc_school_id: schoolId, major }).toArray();

      // Collect every series and every loose course, counting colleges. Also
      // record each Or group's sections as a choice slot: ASSIST's own grouping
      // is the only place the alternatives are stated. Course codes cannot tell
      // you that CHE 002 and CHE 004 are alternatives while CHE 002 and CHE 118
      // are both required.
      const seriesSeen = new Map(); // key -> { codes, units, colleges }
      const looseSeen = new Map();  // code -> { units, colleges }
      const choiceSlots = [];       // [[codes...], [codes...]] per Or group
      for (const agreement of agreements) {
        for (const group of agreement.requirement_groups || []) {
          const isOr = String(group.group_conjunction || '').toLowerCase() === 'or';
          const perSection = [];
          for (const section of group.sections || []) {
            const inSection = [];
            for (const receiver of section.receivers || []) {
              const r = receiver.receiving || {};
              if (r.kind === 'series') {
                const codes = (r.parent_ids || []).map((p) => byId.get(String(p))?.code).filter(Boolean);
                if (codes.length < 2) continue;
                const key = [...codes].sort().join('|');
                const entry = seriesSeen.get(key)
                  || { codes, units: r.units ?? null, colleges: new Set() };
                entry.colleges.add(agreement.community_college);
                seriesSeen.set(key, entry);
                inSection.push(...codes);
              } else if (r.parent_id != null) {
                const hit = byId.get(String(r.parent_id));
                if (!hit) continue;
                const entry = looseSeen.get(hit.code) || { units: hit.units, colleges: new Set() };
                entry.colleges.add(agreement.community_college);
                looseSeen.set(hit.code, entry);
                inSection.push(hit.code);
              }
            }
            if (inSection.length) perSection.push(inSection);
          }
          // An Or across sections, or a single section whose receivers are
          // alternatives (options_conjunction 'or'), both mean "pick one".
          if (isOr && perSection.length > 1) choiceSlots.push(perSection);
        }
      }

      // Merge choice slots that share any course — they describe one requirement.
      const merged = [];
      for (const slot of choiceSlots) {
        const flat = new Set(slot.flat());
        const hit = merged.find((m) => [...m.courses].some((c) => flat.has(c)));
        const target = hit || { courses: new Set(), options: new Map() };
        for (const c of flat) target.courses.add(c);
        for (const opt of slot) {
          const key = [...new Set(opt)].sort().join('|');
          target.options.set(key, (target.options.get(key) || 0) + 1);
        }
        if (!hit) merged.push(target);
      }

      // Drop any block wholly contained in a larger one — that is one college's
      // partial articulation, not a requirement the campus offers as a choice.
      const all = [...seriesSeen.values()];
      const maximal = all.filter((s) => !all.some((other) => isSubset(s.codes, other.codes)));
      const partials = all.length - maximal.length;

      // A loose course sharing a maximal block's family is a candidate missing
      // member of that block — ASSIST names it, but not inside the series.
      const blocked = new Set(maximal.flatMap((s) => s.codes));
      const suspect = [...looseSeen.keys()].filter(
        (code) => !blocked.has(code) && maximal.some((s) => s.codes.some((c) => family(c) === family(code))));

      // Present each merged slot as a choice, keeping only maximal options so a
      // college's partial articulation is not mistaken for an alternative.
      const unitsByCode = new Map();
      for (const { code, units } of byId.values()) unitsByCode.set(code, units);
      const blockUnits = (codes) => {
        const known = codes.map((c) => unitsByCode.get(c)).filter((u) => Number.isFinite(u));
        return known.length === codes.length ? known.reduce((a, b) => a + b, 0) : null;
      };

      const choices = merged.map((m) => {
        const opts = [...m.options.entries()].map(([k, colleges]) => ({ codes: k.split('|'), colleges }));
        const keep = opts.filter((o) => !opts.some((other) => isSubset(o.codes, other.codes)));
        return {
          options: keep.sort((a, b) => b.colleges - a.colleges).map((o) => ({
            codes: o.codes,
            colleges: o.colleges,
            units: blockUnits(o.codes),
          })),
        };
      }).filter((ch) => ch.options.length > 1);

      report.push({
        choices,
        campus: CAMPUS[schoolId] || String(schoolId),
        school_id: schoolId,
        major,
        colleges: agreements.length,
        blocks: maximal.map((s) => ({
          codes: s.codes,
          units: s.units,
          colleges: s.colleges.size,
        })).sort((a, b) => a.codes[0].localeCompare(b.codes[0])),
        loose_courses: [...looseSeen.entries()]
          .filter(([code]) => !blocked.has(code))
          .map(([code, v]) => ({ code, units: v.units, colleges: v.colleges.size }))
          .sort((a, b) => a.code.localeCompare(b.code)),
        partial_blocks_discarded: partials,
        possibly_incomplete: suspect.sort(),
      });
    }
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    await client.close();
    return;
  }

  for (const r of report) {
    if (/Computer Science|Electrical/i.test(r.major)) continue;
    console.log(`\n${'='.repeat(78)}\n${r.campus} — ${r.major}   (${r.colleges} colleges)`);
    if (r.partial_blocks_discarded) {
      console.log(`  ${r.partial_blocks_discarded} partial block(s) discarded as one-college articulation artefacts`);
    }
    for (const [i, ch] of r.choices.entries()) {
      console.log(`  CHOICE ${i + 1} — complete one of ${ch.options.length}:`);
      for (const o of ch.options) {
        console.log(`      ${String(o.units ?? '?').padStart(3)}u  [${String(o.colleges).padStart(3)}/${r.colleges} colleges]  ${o.codes.join(' + ')}`);
      }
    }
    const inChoice = new Set(r.choices.flatMap((ch) => ch.options.flatMap((o) => o.codes)));
    const required = r.blocks.filter((b) => !b.codes.some((c) => inChoice.has(c)));
    for (const b of required) {
      console.log(`  REQUIRED BLOCK  ${String(b.units ?? '?').padStart(3)}u  [${String(b.colleges).padStart(3)}/${r.colleges}]  ${b.codes.join(' + ')}`);
    }
    if (r.loose_courses.length) {
      console.log(`  loose courses: ${r.loose_courses.map((c) => `${c.code}(${c.units ?? '?'}u)`).join(', ')}`);
    }
    if (r.possibly_incomplete.length) {
      console.log(`  ** possibly incomplete blocks — these share a block's family but sit outside it:`);
      console.log(`     ${r.possibly_incomplete.join(', ')}`);
      console.log(`     check the campus catalogue; ASSIST only names courses some college articulates to.`);
    }
  }
  await client.close();
}

main().catch((error) => { console.error(error); process.exit(1); });
