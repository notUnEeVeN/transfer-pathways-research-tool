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

  it('enables researched templates but leaves unvalidated visual inputs pending for new majors', () => {
    for (const slug of ['bio', 'econ']) {
      const capabilities = getMajor(slug).capabilities;
      expect(capabilities.assistAgreements).toBe(true);
      expect(capabilities.caCreditLossArtifact).toBe(true);
      expect(capabilities.agreementPathways).toBe(false);
      expect(capabilities.degreeTemplates).toBe(true);
      expect(capabilities.courseCategories).toBe(false);
      expect(capabilities.prerequisites).toBe(false);
    }
  });

  it('unknown slug returns null', () => {
    expect(getMajor('nope')).toBeNull();
    expect(getMajor('')).toBeNull();
    expect(getMajor(undefined)).toBeNull();
  });

  it('serializeMajors survives a JSON round-trip with every field intact', () => {
    const json = JSON.parse(JSON.stringify(serializeMajors()));
    const cs = json.find((m) => m.slug === 'cs');
    expect(cs.label).toBe('Computer Science');
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
      .toEqual({ error: 'unknown major: nope', known: ['cs', 'bio', 'econ'] });
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
