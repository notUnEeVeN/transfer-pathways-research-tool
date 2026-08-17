import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const cjs = createRequire(import.meta.url);
const {
  buildMaDocuments, validateMaDocuments, deriveTuitionRates, MA_SCHOOL_IDS, MA_CC_IDS,
} = cjs('./buildMaDocuments');

// One university (Testfield), one community college (Berkshire): the heatmap
// names three requirements (two lower, one upper); the resident plan adds one
// GE course; the AS has three courses; the pair pathway shows the calculus
// requirement and the GE requirement satisfied by transfer (both absent from
// the pathway, along with the AS courses that satisfied them).
const raw = {
  heatmap: {
    universities: [{
      name: 'Testfield',
      lower_count: 2,
      courses: [
        { header: 'Computer Science I (COMP 151)', prefix: 'COMP', number: '151', upper: false },
        { header: 'Calculus I (MATH 161)', prefix: 'MATH', number: '161', upper: false },
        { header: 'Operating Systems (COMP 350)', prefix: 'COMP', number: '350', upper: true },
      ],
      matrix: { Berkshire: [false, true, false] },
      lower_ratio: { Berkshire: 0.5 },
      all_ratio: { Berkshire: 1 / 3 },
      mt: { Berkshire: true },
    }],
  },
  as_degrees: {
    Berkshire: {
      system: 'semester',
      cip: '11.0701',
      courses: [
        { id: 1, name: 'C++ Programming I', prefix: 'CIS', number: '124', prereqs: [], coreqs: [], credits: 4 },
        { id: 2, name: 'Calculus I', prefix: 'MAT', number: '151', prereqs: [], coreqs: [], credits: 4 },
        { id: 3, name: 'English Composition', prefix: 'ENG', number: '101', prereqs: [], coreqs: [], credits: 3 },
      ],
    },
  },
  pathways: {
    Testfield: {
      resident: [
        { id: 1, name: 'Computer Science I', prefix: 'COMP', number: '151', prereqs: [], coreqs: [], credits: 3 },
        { id: 2, name: 'Calculus I', prefix: 'MATH', number: '161', prereqs: [], coreqs: [], credits: 4 },
        { id: 3, name: 'Operating Systems', prefix: 'COMP', number: '350', prereqs: [1], coreqs: [], credits: 3 },
        { id: 4, name: 'Composition', prefix: 'ENGL', number: '110', prereqs: [], coreqs: [], credits: 3 },
      ],
      pairs: {
        Berkshire: [
          // The layered pathway keeps every AS course (the student takes the
          // whole associate degree) and removes only the BS requirements that
          // transfer: Calculus and Composition are gone from the BS side;
          // COMP 151 and Operating Systems remain.
          { id: 1, name: 'Computer Science I', prefix: 'COMP', number: '151', prereqs: [], coreqs: [], credits: 3 },
          { id: 2, name: 'Operating Systems', prefix: 'COMP', number: '350', prereqs: [1], coreqs: [], credits: 3 },
          { id: 3, name: 'C++ Programming I', prefix: 'CIS', number: '124', prereqs: [], coreqs: [], credits: 4 },
          { id: 4, name: 'Calculus I', prefix: 'MAT', number: '151', prereqs: [], coreqs: [], credits: 4 },
          { id: 5, name: 'English Composition', prefix: 'ENG', number: '101', prereqs: [], coreqs: [], credits: 3 },
        ],
      },
    },
  },
  baselines: {
    pct_as: { resident: { Testfield: 1 }, cells: { Berkshire: { Testfield: 0.5385 } } },
    credit_hours: { resident: { Testfield: 120 }, cells: { Berkshire: { Testfield: 17 } } },
  },
};

describe('buildMaDocuments', () => {
  const built = buildMaDocuments(raw);

  it('mints stable ids for institutions in both kinds', () => {
    expect(MA_SCHOOL_IDS.Testfield ?? MA_SCHOOL_IDS.Bridgewater).toBeDefined();
    const university = built.institutions.find((row) => row.kind === 'university');
    const college = built.institutions.find((row) => row.kind === 'community_college');
    expect(university).toMatchObject({ state: 'ma', academic_calendar: 'semester' });
    expect(college).toMatchObject({ state: 'ma', source_id: MA_CC_IDS.Berkshire });
  });

  it('builds a course-count template with lower, upper, and GE-titled groups', () => {
    const degree = built.degrees[0];
    expect(degree).toMatchObject({
      kind: 'degree', major_slug: 'ma-cs', state: 'ma', unit_system: 'semester',
    });
    // Resident credits: 3 + 4 + 3 + 3.
    expect(degree.total_units).toBe(13);
    const [lower, upper, ge] = degree.requirement_groups;
    expect(lower.tier).toBe('transferable');
    expect(lower.sections[0].receivers).toHaveLength(2);
    // Units come from the resident plan matched by prefix+number.
    expect(lower.sections[0].unit_advisement).toBe(7);
    expect(upper.tier).toBe('nontransferable');
    expect(upper.sections[0].receivers).toHaveLength(1);
    // Resident courses absent from the heatmap matrix form a GE-titled group
    // so the MA course lens excludes them while unit lenses count them.
    expect(ge.title).toMatch(/^GE:/);
    expect(ge.tier).toBe('transferable');
    expect(ge.sections[0].receivers).toHaveLength(1);
    expect(ge.sections[0].unit_advisement).toBe(3);
  });

  it('builds the AS degree with named sections and summed units', () => {
    const as = built.asDegrees[0];
    expect(as).toMatchObject({
      kind: 'as_degree', degree_type: 'local_as', major_slug: 'ma-cs',
      state: 'ma', total_units: 11, unit_system: 'semester',
      college_id: `ma:cc:${MA_CC_IDS.Berkshire}`,
      community_college_id: MA_CC_IDS.Berkshire,
    });
    const section = as.requirement_groups[0].sections[0];
    expect(section.receivers).toHaveLength(3);
    expect(section.receivers[0].options[0].course_ids).toEqual([
      MA_CC_IDS.Berkshire * 1000 + 1,
    ]);
  });

  it('marks articulation from the heatmap and options from the pathway overlay', () => {
    const agreement = built.agreements[0];
    expect(agreement).toMatchObject({ state: 'ma', community_college_id: MA_CC_IDS.Berkshire });
    const byCode = new Map(agreement.requirement_groups[0].sections[0].receivers
      .map((receiver) => [receiver.receiving.code, receiver]));
    // COMP 151 did not articulate.
    expect(byCode.get('COMP 151').articulation_status).toBe('not_articulated');
    // MATH 161 did. The pathway keeps every AS course, so the consumed AS
    // course is recovered by name similarity: the AS 'Calculus I' pairs to
    // the removed BS calculus requirement.
    const math = byCode.get('MATH 161');
    expect(math.articulation_status).toBe('articulated');
    expect(math.options.flatMap((option) => option.course_ids))
      .toContain(MA_CC_IDS.Berkshire * 1000 + 2);
    // The GE requirement articulated too (its resident row left the
    // pathway); the AS composition course pairs to it by name.
    const ge = byCode.get('ENGL 110');
    expect(ge.articulation_status).toBe('articulated');
    expect(ge.options.flatMap((option) => option.course_ids))
      .toContain(MA_CC_IDS.Berkshire * 1000 + 3);
  });

  it('emits sending and receiving course rows so the engine can price units', () => {
    const sending = built.courses.filter((row) => row.side === 'sending');
    const receiving = built.courses.filter((row) => row.side === 'receiving');
    expect(sending).toHaveLength(3);
    expect(sending[0]).toMatchObject({
      course_id: MA_CC_IDS.Berkshire * 1000 + 1, units: 4,
      uc_transferable: true, state: 'ma',
    });
    // One receiving row per template course (heatmap + GE), keyed by parent_id.
    expect(receiving).toHaveLength(4);
    expect(receiving.every((row) => Number.isFinite(row.parent_id))).toBe(true);
  });

  it('emits baseline rows including the resident row', () => {
    const cell = built.baselines.find((row) => row.measure === 'credit_hours'
      && row.community_college_id === MA_CC_IDS.Berkshire);
    expect(cell.value).toBe(17);
    const resident = built.baselines.find((row) => row.measure === 'credit_hours'
      && row.community_college_id === null);
    expect(resident.value).toBe(120);
  });
});

// The importer refuses to write documents that cannot reproduce the source's
// own numbers. Failures abort — they mean OUR rebuild broke a round-trip.
// Warnings are the paper's internal cross-artifact drifts (they feed the
// reproduction report); notes are expected-by-design observations, such as
// the Q1 offerings-vs-AS-contents gap and elective unit fallbacks.
describe('validateMaDocuments', () => {
  it('passes the coherent fixture, warning only about the resident drift', () => {
    const report = validateMaDocuments(raw, buildMaDocuments(raw));
    expect(report.failures).toEqual([]);
    // Resident plan sums 13 against the published 120.
    expect(report.warnings.some((w) => /Testfield.*resident.*13.*120/i.test(w))).toBe(true);
    expect(Array.isArray(report.notes)).toBe(true);
  });

  it('fails loudly when a boolean flip breaks the ratio round-trip', () => {
    const broken = JSON.parse(JSON.stringify(raw));
    broken.heatmap.universities[0].matrix.Berkshire = [true, true, false];
    const report = validateMaDocuments(broken, buildMaDocuments(broken));
    expect(report.failures.some((f) => /Testfield.*Berkshire.*lower/i.test(f))).toBe(true);
  });

  it('reports a published-sum disagreement as a warning, not a failure', () => {
    // Nine real pairs disagree between the pathway tabs and the published
    // Credit Hours sheet (UMass Boston/MassBay matches NEITHER revision of
    // the tab), so this is cross-artifact drift in the source, not an
    // import error.
    const drifted = JSON.parse(JSON.stringify(raw));
    drifted.baselines.credit_hours.cells.Berkshire.Testfield = 99;
    const report = validateMaDocuments(drifted, buildMaDocuments(drifted));
    expect(report.failures).toEqual([]);
    expect(report.warnings.some((w) => /Testfield.*Berkshire.*99/i.test(w))).toBe(true);
  });

  it('warns on overlay-vs-boolean drift and notes the expected Q1/Q2 gap', () => {
    const drifted = JSON.parse(JSON.stringify(raw));
    // The pathway also drops COMP 151 (overlay says it transferred) while
    // the heatmap boolean still says it did not — genuine drift.
    drifted.pathways.Testfield.pairs.Berkshire = drifted.pathways.Testfield.pairs.Berkshire
      .filter((course) => course.name !== 'Computer Science I');
    drifted.baselines.credit_hours.cells.Berkshire.Testfield = 14;
    const report = validateMaDocuments(drifted, buildMaDocuments(drifted));
    expect(report.failures).toEqual([]);
    expect(report.warnings.some((w) => /COMP 151.*overlay|overlay.*COMP 151/i.test(w))).toBe(true);

    // The reverse direction — articulable at the college but kept in the
    // pathway because the AS does not carry it — is the paper's own design
    // (offerings vs AS contents) and lands in notes.
    const q1q2 = JSON.parse(JSON.stringify(raw));
    q1q2.heatmap.universities[0].matrix.Berkshire = [true, true, false];
    q1q2.heatmap.universities[0].lower_ratio.Berkshire = 1;
    q1q2.heatmap.universities[0].all_ratio.Berkshire = 2 / 3;
    const report2 = validateMaDocuments(q1q2, buildMaDocuments(q1q2));
    expect(report2.failures).toEqual([]);
    expect(report2.notes.some((n) => /COMP 151.*stayed/i.test(n))).toBe(true);
  });
});

describe('resident residue is a multiset complement', () => {
  it('keeps duplicate resident rows in the GE block when only one matches a matrix column', () => {
    // Framingham in miniature: the Set-based inHeatmap filter dropped EVERY
    // resident row sharing a code or name with any matrix column, so
    // duplicate elective rows vanished and their transfers could never earn
    // credit. Matching must consume one resident row per column; the rest
    // are the residue.
    const overlay = JSON.parse(JSON.stringify(raw));
    overlay.pathways.Testfield.resident = [
      { id: 1, name: 'Computer Science I', prefix: 'COMP', number: '151', prereqs: [], coreqs: [], credits: 3 },
      { id: 2, name: 'Calculus I', prefix: 'MATH', number: '161', prereqs: [], coreqs: [], credits: 4 },
      { id: 3, name: 'Operating Systems', prefix: 'COMP', number: '350', prereqs: [1], coreqs: [], credits: 3 },
      { id: 4, name: 'Free elec', prefix: 'ELEC', number: 'xxx', prereqs: [], coreqs: [], credits: 3 },
      { id: 5, name: 'Free elec', prefix: 'ELEC', number: 'xxx', prereqs: [], coreqs: [], credits: 3 },
    ];
    const built = buildMaDocuments(overlay);
    const degree = built.degrees.find((d) => d.school === 'Testfield');
    const ge = degree.requirement_groups.find((g) => /^GE/i.test(g.title));
    const geNames = ge.sections[0].receivers.map((r) => r.receiving.name);
    // Both duplicate electives survive as their own residue slots.
    expect(geNames.filter((name) => name === 'Free elec')).toHaveLength(2);
  });
});

describe('placeholder GE slots (ELEC xxx) keep their multiplicity', () => {
  it('credits exactly the removed slots, by name — kept same-code slots stay unarticulated', () => {
    // Bridgewater×Bristol in miniature: the resident plan lists FOUR "ELEC
    // xxx" GE slots with different category names; the pathway keeps two
    // (Arts, Humanities) and removes two (Social Science, Global Culture).
    // A Set of removed codes lit up all four; the multiset must not.
    const overlay = {
      heatmap: {
        universities: [{
          name: 'Testfield',
          lower_count: 1,
          courses: [{ header: 'Computer Science I (COMP 151)', prefix: 'COMP', number: '151', upper: false }],
          matrix: { Berkshire: [true] },
          lower_ratio: { Berkshire: 1 },
          all_ratio: { Berkshire: 1 },
          mt: {},
        }],
      },
      as_degrees: {
        Berkshire: {
          system: 'semester',
          courses: [
            { id: 1, name: 'C++ Programming I', prefix: 'CIS', number: '124', prereqs: [], coreqs: [], credits: 4 },
            { id: 2, name: 'Intro to Sociology', prefix: 'SOC', number: '101', prereqs: [], coreqs: [], credits: 3 },
            { id: 3, name: 'World Cultures', prefix: 'ANT', number: '110', prereqs: [], coreqs: [], credits: 3 },
          ],
        },
      },
      pathways: {
        Testfield: {
          resident: [
            { id: 1, name: 'Computer Science I', prefix: 'COMP', number: '151', prereqs: [], coreqs: [], credits: 3 },
            { id: 2, name: 'Arts', prefix: 'ELEC', number: 'xxx', prereqs: [], coreqs: [], credits: 3 },
            { id: 3, name: 'Humanities', prefix: 'ELEC', number: 'xxx', prereqs: [], coreqs: [], credits: 3 },
            { id: 4, name: 'Social Science', prefix: 'ELEC', number: 'xxx', prereqs: [], coreqs: [], credits: 3 },
            { id: 5, name: 'Global Culture', prefix: 'ELEC', number: 'xxx', prereqs: [], coreqs: [], credits: 3 },
          ],
          pairs: {
            Berkshire: [
              // Pathway keeps: CS I removed? No — CS I removed (AS covers it);
              // Arts and Humanities KEPT; Social Science + Global Culture removed.
              { id: 1, name: 'Arts', prefix: 'ELEC', number: 'xxx', prereqs: [], coreqs: [], credits: 3 },
              { id: 2, name: 'Humanities', prefix: 'ELEC', number: 'xxx', prereqs: [], coreqs: [], credits: 3 },
              { id: 3, name: 'C++ Programming I', prefix: 'CIS', number: '124', prereqs: [], coreqs: [], credits: 4 },
              { id: 4, name: 'Intro to Sociology', prefix: 'SOC', number: '101', prereqs: [], coreqs: [], credits: 3 },
              { id: 5, name: 'World Cultures', prefix: 'ANT', number: '110', prereqs: [], coreqs: [], credits: 3 },
            ],
          },
        },
      },
      baselines: {
        pct_as: { resident: { Testfield: 1 }, cells: { Berkshire: { Testfield: 0.6 } } },
        credit_hours: { resident: { Testfield: 120 }, cells: { Berkshire: { Testfield: 16 } } },
      },
    };

    const built = buildMaDocuments(overlay);
    const agreement = built.agreements.find((a) => a.pairing === 'order-approximate');
    const receivers = agreement.requirement_groups[0].sections[0].receivers;
    const byName = (name) => receivers.find((r) => r.receiving.name === name);

    expect(byName('Social Science').articulation_status).toBe('articulated');
    expect(byName('Global Culture').articulation_status).toBe('articulated');
    // The kept slots share the ELEC xxx code with the removed ones and must
    // NOT read as satisfied.
    expect(byName('Arts').articulation_status).toBe('not_articulated');
    expect(byName('Humanities').articulation_status).toBe('not_articulated');
    // Options exist only for removed requirements: CS I + the two removed slots.
    const withOptions = receivers.filter((r) => (r.options || []).length > 0);
    expect(withOptions).toHaveLength(3);
  });
});

describe('deriveTuitionRates', () => {
  // The paper's Cost tab is (credit hours − 120) × a flat per-credit rate, so
  // the rate is recoverable from its own cells wherever hours exceed 120.
  const baselines = {
    credit_hours: {
      resident: { Testfield: 123, Flatstate: 120 },
      cells: { Berkshire: { Testfield: 140, Flatstate: 120 } },
    },
    cost: {
      resident: { Testfield: 993.33, Flatstate: 0 },
      cells: { Berkshire: { Testfield: 6622.2, Flatstate: 0 } },
    },
  };

  it('recovers a consistent per-credit rate from cell and resident rows', () => {
    const { rates, warnings } = deriveTuitionRates({ baselines });
    // 993.33 / 3 and 6622.2 / 20 both say 331.11.
    expect(rates.get('Testfield')).toBeCloseTo(331.11, 2);
    expect(warnings).toEqual([]);
  });

  it('leaves a university without derivable cells unpriced rather than guessing', () => {
    const { rates } = deriveTuitionRates({ baselines });
    expect(rates.has('Flatstate')).toBe(false);
  });

  it('warns when a university prices inconsistently across its own cells', () => {
    const drifted = JSON.parse(JSON.stringify(baselines));
    drifted.cost.cells.Berkshire.Testfield = 9000;
    const { warnings } = deriveTuitionRates({ baselines: drifted });
    expect(warnings.some((w) => /Testfield/.test(w))).toBe(true);
  });

  it('stamps derived tuition onto the built university documents', () => {
    const withTuition = JSON.parse(JSON.stringify(raw));
    withTuition.baselines.cost = {
      resident: { Testfield: 993.33 },
      cells: {},
    };
    withTuition.baselines.credit_hours.resident.Testfield = 123;
    const built = buildMaDocuments(withTuition);
    const university = built.institutions.find((row) => row.kind === 'university');
    expect(university.tuition_per_credit_usd).toBeCloseTo(331.11, 2);
    expect(university.tuition_annual_resident_usd).toBeCloseTo(331.11 * 24, 2);
  });

  it('omits tuition fields entirely when nothing is derivable', () => {
    const built = buildMaDocuments(raw);
    const university = built.institutions.find((row) => row.kind === 'university');
    expect(university).not.toHaveProperty('tuition_per_credit_usd');
    expect(university).not.toHaveProperty('tuition_annual_resident_usd');
  });
});
