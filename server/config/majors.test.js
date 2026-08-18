import { describe, it, expect } from 'vitest';
import {
  getMajor, listMajors, defaultMajor, serializeMajors, majorScopeFromQuery,
  programPairs, programPairClause,
} from './majors';
import { _paperMajors as PAPER_MAJORS } from '../services/analysis/pathways';

describe('majors config', () => {
  it('cs is the default; bio and econ are onboarded alongside it', () => {
    expect(defaultMajor().slug).toBe('cs');
    expect(listMajors().map((m) => m.slug)).toEqual(['cs', 'bio', 'econ']);
    expect(listMajors({ includeStates: true }).map((m) => m.slug))
      .toEqual(['cs', 'bio', 'econ', 'ma-cs', 'va-cs']);
  });

  it('keeps the state majors out of the default picker payload', () => {
    // Each state tab addresses its own major directly; the California major
    // picker must never offer them.
    expect(serializeMajors().map((m) => m.slug)).toEqual(['cs', 'bio', 'econ']);
    expect(serializeMajors({ state: 'ma' }).map((m) => m.slug)).toEqual(['ma-cs']);
    expect(serializeMajors({ state: 'va' }).map((m) => m.slug)).toEqual(['va-cs']);
    const ma = getMajor('ma-cs');
    expect(ma.state).toBe('ma');
    expect(Object.keys(ma.programs)).toHaveLength(11);
    expect(ma.degreeAnalysisSlots).toEqual(['local_as']);
  });

  it('state:"all" is the cross-corpus registry and changes no existing payload', () => {
    // The compare tab's pane picker is the only caller of 'all'. Regression
    // first, byte-for-byte against the independent listMajors path: every
    // other caller's payload is untouched by the branch, and in particular the
    // default payload still stamps no state-scoped major into a California
    // picker.
    expect(JSON.stringify(serializeMajors())).toBe(JSON.stringify(listMajors()));
    expect(JSON.stringify(serializeMajors({ state: 'ma' })))
      .toBe(JSON.stringify([getMajor('ma-cs')]));
    expect(serializeMajors().some((major) => major.state)).toBe(false);

    expect(serializeMajors({ state: 'all' }).map((m) => m.slug))
      .toEqual(['cs', 'bio', 'econ', 'ma-cs', 'va-cs']);
    expect(serializeMajors({ state: 'all' })).toEqual(listMajors({ includeStates: true }));
  });

  it('cs program pins are byte-identical to every analysis compatibility pin', () => {
    expect(getMajor('cs').programs).toEqual(PAPER_MAJORS);
  });

  it('defines exactly one canonical CS program at each of the nine campuses', () => {
    const pairs = programPairs('cs');
    expect(pairs).toHaveLength(9);
    expect(pairs).toContainEqual({
      school_id: 79,
      major: 'Electrical Engineering & Computer Sciences, B.S.',
    });
    expect(pairs.map((pair) => pair.major)).not.toContain('Computer Science, B.A.');
    expect(pairs.map((pair) => pair.major)).not.toContain('Computer Science Minor');
  });

  it('preserves the stored trailing space in the Merced program name', () => {
    expect(getMajor('cs').programs[144]).toContain('COMPUTER SCIENCE AND ENGINEERING, B.S. ');
  });

  it('cs match string and capabilities', () => {
    const cs = getMajor('cs');
    expect(cs.match).toBe('computer science');
    expect(cs.capabilities.asDegrees).toBe(true);
    expect(cs.capabilities.assistAgreements).toBe(true);
    expect(cs.capabilities.caCreditLossArtifact).toBe(true);
    expect(cs.capabilities.agreementPathways).toBe(true);
    expect(cs.capabilities.paperBaselines).toBe(true);
    expect(cs.capabilities.transferMinimums).toBe(true);
    expect(cs.capabilities.courseCategories).toBe(true);
    expect(cs.capabilities.prerequisites).toBe(true);
  });

  it('enables researched degree and prerequisite templates while leaving category curation pending', () => {
    for (const slug of ['bio', 'econ']) {
      const capabilities = getMajor(slug).capabilities;
      expect(capabilities.assistAgreements).toBe(true);
      expect(capabilities.caCreditLossArtifact).toBe(true);
      expect(capabilities.agreementPathways).toBe(false);
      expect(capabilities.degreeTemplates).toBe(true);
      expect(capabilities.courseCategories).toBe(false);
      expect(capabilities.prerequisites).toBe(true);
    }
    // Both new majors now have imported associate-degree records; the
    // capabilities that remain false are the ones still awaiting validation.
    expect(getMajor('bio').capabilities.asDegrees).toBe(true);
    expect(getMajor('econ').capabilities.asDegrees).toBe(true);
  });

  it('publishes explicit prerequisite roots for each major', () => {
    expect(getMajor('cs').prerequisiteConcepts).toContain('cs_3_data_structures');
    expect(getMajor('bio').prerequisiteConcepts).toEqual(expect.arrayContaining([
      'bio_genetics', 'biochemistry', 'molecular_biology', 'intro_data_science',
    ]));
    expect(getMajor('econ').prerequisiteConcepts).toEqual(expect.arrayContaining([
      'econ_micro', 'econ_macro', 'intro_psychology', 'intro_american_government',
      'intro_sociology',
    ]));
  });

  it('publishes the researched associate-degree cohorts and labels per major', () => {
    expect(getMajor('cs').degreeAnalysisSlots).toEqual(['local_as', 'ast']);
    expect(getMajor('bio').degreeAnalysisSlots).toEqual(['local_as', 'ast']);
    expect(getMajor('econ').degreeAnalysisSlots).toEqual(['ast', 'local_other']);
    expect(getMajor('econ').degreeSlotLabels).toEqual({
      ast: 'A.A.-T / A.S.-T',
      local_other: 'Local A.A.',
    });
    const serializedEcon = JSON.parse(JSON.stringify(serializeMajors()))
      .find((major) => major.slug === 'econ');
    expect(serializedEcon.degreeAnalysisSlots).toEqual(['ast', 'local_other']);
    expect(serializedEcon.degreeSlotLabels.local_other).toBe('Local A.A.');
  });

  it('unknown slug returns null', () => {
    expect(getMajor('nope')).toBeNull();
    expect(getMajor('')).toBeNull();
    expect(getMajor(undefined)).toBeNull();
  });

  it('serializeMajors survives a JSON round-trip with every field intact', () => {
    const json = JSON.parse(JSON.stringify(serializeMajors()));
    const cs = json.find((m) => m.slug === 'cs');
    expect(cs.label).toBe('Computer Science (CA)');
    expect(cs.programs['79']).toEqual(['Electrical Engineering & Computer Sciences, B.S.']);
    expect(cs.categories.map((c) => c.key)).toContain('discrete_math');
    expect(cs.capabilities.paperBaselines).toBe(true);
    // Nothing in the config is a RegExp, so nothing is lost to stringify.
    expect(json).toEqual(serializeMajors());
  });

  it('majorScopeFromQuery: slug becomes exact pairs; explicit contains stays legacy-compatible', () => {
    expect(majorScopeFromQuery({ major: 'cs' }))
      .toEqual({ slug: 'cs', majorPrograms: getMajor('cs').programs, majorContains: '' });
    expect(majorScopeFromQuery({ majorContains: 'econom' }))
      .toEqual({ slug: null, majorPrograms: null, majorContains: 'econom' });
    expect(majorScopeFromQuery({}))
      .toEqual({ slug: null, majorPrograms: null, majorContains: '' });
    expect(majorScopeFromQuery({ major: 'nope' }))
      .toEqual({ error: 'unknown major: nope', known: ['cs', 'bio', 'econ', 'ma-cs', 'va-cs'] });
  });

  it('majorScopeFromQuery prefers the slug when both are supplied', () => {
    expect(majorScopeFromQuery({ major: 'cs', majorContains: 'ignored' }))
      .toEqual({ slug: 'cs', majorPrograms: getMajor('cs').programs, majorContains: '' });
  });

  it('builds a fail-closed exact Mongo clause with configurable field names', () => {
    expect(programPairClause({ 79: ['Canonical'] }, {
      schoolField: 'school_id', majorField: 'program',
    })).toEqual({
      $or: [{ school_id: 79, program: { $in: ['Canonical'] } }],
    });
    expect(programPairClause(null)).toEqual({ _id: { $exists: false } });
  });
});
