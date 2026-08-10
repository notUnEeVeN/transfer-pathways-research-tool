import { describe, expect, it } from 'vitest';
import { courseIdFor } from '../services/virginia/courseIdentity';
import {
  receiversForRow,
  requirementGroups,
  toDocument,
} from './importVirginiaCatalogDegrees';

const course = (code, title = code) => ({ code, title });

describe('Virginia catalog requirement conversion', () => {
  it('keeps every member of an AND sequence and models OR as receiver alternatives', () => {
    const and = receiversForRow({
      codes: [course('CHEM211'), course('CHEM213')], conjunction: 'and', credits: { min: 4, max: 4 },
    }, { cc: false, layer: 'major' });
    expect(and).toHaveLength(1);
    expect(and[0].receiving).toEqual({
      kind: 'series', conjunction: 'and',
      parent_ids: [courseIdFor('CHEM211'), courseIdFor('CHEM213')], units: 4,
    });

    const or = receiversForRow({
      codes: [course('CS471'), course('CS571')], conjunction: 'or', credits: { min: 3, max: 3 },
    }, { cc: false, layer: 'major' });
    expect(or.map((receiver) => receiver.receiving)).toEqual([
      { kind: 'course', parent_id: courseIdFor('CS471'), units: 3 },
      { kind: 'course', parent_id: courseIdFor('CS571'), units: 3 },
    ]);
  });

  it('makes ordinary fixed rows explicit required slots and joins a marked OR alternative', () => {
    const tree = {
      groups: [{
        title: 'Computer Science Core', credits: null, sections: [{
          choose: null, credits: null, rows: [
            { codes: [course('CS112')], conjunction: 'and' },
            { codes: [course('CS108'), course('CS109')], conjunction: 'and', alternative_to_previous: true },
            { codes: [course('CS211')], conjunction: 'and' },
          ],
        }],
      }],
    };
    const [group] = requirementGroups(tree, {
      cc: false, creditsByCode: new Map(), availableSourceIds: new Set(['major']),
    });
    expect(group.sections).toHaveLength(2);
    expect(group.sections[0].section_advisement).toBe(1);
    expect(group.sections[0].receivers.map((receiver) => receiver.receiving.kind)).toEqual(['course', 'series']);
    expect(group.sections[1].section_advisement).toBe(1);
  });

  it('uses stable VA course IDs and keys for an AS alternative', () => {
    const [receiver] = receiversForRow({
      codes: [course('CSC208'), course('MTH288')], conjunction: 'or', credits: { min: 3, max: 3 },
    }, { cc: true, layer: 'associate_degree' });
    expect(receiver.receiving).toBeNull();
    expect(receiver.options_conjunction).toBe('or');
    expect(receiver.options).toEqual([
      { course_ids: [courseIdFor('CSC208')], course_conjunction: 'and', course_keys: ['va:CSC208'] },
      { course_ids: [courseIdFor('MTH288')], course_conjunction: 'and', course_keys: ['va:MTH288'] },
    ]);
  });

  it('retains layered provenance, catalog context, and unit audit in the document', () => {
    const extract = {
      outcome: 'captured', parser: 'courseleaf', program_title: 'Computer Science, BS',
      source_url: 'https://catalog.example.edu/cs/', catalog_year: '2026-2027',
      total_credits: { min: 120, max: 120 },
      degree_context: {
        award: 'BS', college: 'Engineering', academic_unit: 'Computer Science',
        general_education_authority: 'University Core', unit_audit: { graduation_minimum: 120, modeled_units: 120 },
      },
      sources: [
        { id: 'major', kind: 'major', url: 'https://catalog.example.edu/cs/', sha256: 'a' },
        { id: 'graduation', kind: 'graduation', url: 'https://catalog.example.edu/policies/', sha256: 'b' },
      ],
      source_layers: { major: { status: 'captured', source_refs: ['major'] } },
      groups: [{
        title: 'Core', credits: { min: 3, max: 3, raw: '3' }, source_text: [],
        sections: [{ choose: null, credits: null, rows: [{ codes: [course('CS101')], conjunction: 'and' }] }],
      }],
    };
    const doc = toDocument(extract, {
      slug: 'example-university', name: 'Example University', level: 'four_year', platform: 'courseleaf',
    }, new Map());
    expect(doc).toMatchObject({
      catalog_year: '2026-2027', college: 'Engineering', academic_unit: 'Computer Science',
      ge_authority: 'University Core', unit_audit: { graduation_minimum: 120, modeled_units: 120 },
      collection_status: 'major_only',
    });
    expect(doc.sources.map((source) => source.id)).toEqual(['major', 'graduation']);
    expect(doc.requirement_groups[0].source_refs).toEqual(['major']);
    expect(doc.provenance.source_bundle_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
