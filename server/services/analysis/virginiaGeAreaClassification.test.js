import { describe, expect, it } from 'vitest';
import {
  AREAS,
  CLASSIFIED,
  virginiaEnumeratedGeUnits,
  virginiaGeArea,
  virginiaGeAreaForLabel,
} from './virginiaGeAreaClassification';

const group = (label, units, receivers = 1, extra = {}) => ({
  label_seen: label,
  sections: [{ unit_advisement: units, receivers: Array.from({ length: receivers }, () => ({})) }],
  ...extra,
});

describe('Virginia general-education classification', () => {
  it('classifies each UCGS block from its authored label', () => {
    expect(virginiaGeAreaForLabel('History elective')).toBe(AREAS.HISTORY);
    expect(virginiaGeAreaForLabel('UCGS Block IV — Natural Sciences')).toBe(AREAS.NATURAL);
    expect(virginiaGeAreaForLabel('Humanities from two distinct categories'))
      .toBe(AREAS.HUMANITIES);
    expect(virginiaGeAreaForLabel('Social Science elective excluding History'))
      .toBe(AREAS.SOCIAL);
    expect(virginiaGeAreaForLabel('Written communication')).toBe(AREAS.WRITTEN);
    expect(virginiaGeAreaForLabel('Oral communication')).toBe(AREAS.ORAL);
  });

  it('normalizes dashes, case, and punctuation', () => {
    for (const variant of [
      'UCGS Block II — Arts, Humanities, and Literature',
      'ucgs block ii - arts, humanities and literature',
      'UCGS  Block  II –  Arts Humanities  and Literature',
    ]) expect(virginiaGeAreaForLabel(variant)).toBe(AREAS.HUMANITIES);
  });

  it('never classifies major preparation, student development, or open electives', () => {
    for (const label of [
      'Computer science core',
      'Computer science requirements',
      'Calculus I',
      'Calculus II or Statistics I',
      'Discrete mathematics',
      'Mathematics',
      'Precalculus and Calculus I',
      'Student development',
      'College success',
      'Approved elective',
      'Approved elective capacity',
      'Two distinct technical selections',
      'Two distinct electives totaling 5-8 credits',
      'Additional applicable credit to the 60-credit minimum',
      'Common quantitative and symbolic reasoning requirements',
    ]) expect(virginiaGeAreaForLabel(label), label).toBeNull();
  });

  it('classifies mathematics only as an explicit general UCGS block', () => {
    expect(virginiaGeAreaForLabel('UCGS Block V — Mathematics')).toBe(AREAS.MATHEMATICS);
    // A computer-science degree's calculus is major preparation, and crediting
    // it as breadth would double count it against the bachelor major.
    expect(virginiaGeAreaForLabel('Calculus sequence')).toBeNull();
    expect(virginiaGeAreaForLabel('Calculus and linear algebra')).toBeNull();
  });

  it('prefers an authored ge_area over the label table', () => {
    expect(virginiaGeArea({ ge_area: 'nova_history', label_seen: 'Computer science core' }))
      .toBe('nova_history');
    expect(virginiaGeArea({ label_seen: 'History elective' })).toBe(AREAS.HISTORY);
    expect(virginiaGeArea({ label_seen: 'Computer science core' })).toBeNull();
  });

  it('falls through on any label the table has not reviewed', () => {
    for (const label of ['', null, undefined, 'Something nobody has classified yet']) {
      expect(virginiaGeAreaForLabel(label)).toBeNull();
    }
  });

  it('counts enumerated GE units only for Virginia canonical sources', () => {
    const doc = { requirement_groups: [group('History elective', 3)] };
    expect(virginiaEnumeratedGeUnits(doc, { exactSource: true })).toBe(3);
    // A California or Massachusetts document must never reach the table.
    expect(virginiaEnumeratedGeUnits(doc)).toBe(0);
    expect(virginiaEnumeratedGeUnits(doc, { exactSource: false })).toBe(0);
  });

  it('leaves aggregate GE blocks to geBlocks and skips non-GE groups', () => {
    const doc = {
      requirement_groups: [
        group('History elective', 3),                        // enumerated GE -> counted
        group('Humanities from two distinct categories', 6),  // enumerated GE -> counted
        group('UCGS Block VI — History', 3, 0),               // no receivers -> geBlocks owns it
        group('Computer science core', 13),                   // major -> never
        group('Approved elective capacity', 4),               // elective -> never
        group('History elective', 3, 1, { ge_area: 'x' }),    // authored marker -> geBlocks owns it
        group('History elective', 3, 1, { units_fill: true }),// fill -> never
      ],
    };
    expect(virginiaEnumeratedGeUnits(doc, { exactSource: true })).toBe(9);
  });

  it('keeps every table entry pointing at a declared area', () => {
    const areas = new Set(Object.values(AREAS));
    for (const [label, area] of CLASSIFIED) {
      expect(areas.has(area), `${label} -> ${area}`).toBe(true);
    }
    expect(CLASSIFIED.size).toBeGreaterThan(60);
  });
});
