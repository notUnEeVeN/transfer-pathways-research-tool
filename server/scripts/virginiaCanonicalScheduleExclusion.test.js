import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDegreeAcceptance } from '../services/virginia/degreeAcceptance';
import { compileDegreeComposition } from '../services/virginia/degreeComposition';
import { acceptanceResolver, toDocument } from './importVirginiaCatalogDegrees';

const ROOT = path.join(__dirname, '..', '.va-catalogs');
const institutions = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'institutions.json'), 'utf8'),
).institutions;

// Match headings that turn a requirement inventory into a prospective plan.
// Do not match genuine graduation rules such as a ten-semester completion
// limit, a final-semester residence rule, or an officially required First-Year
// Seminar.
const PROSPECTIVE_HEADING = /^(?:\s*(?:(?:first|second|third|fourth|1st|2nd|3rd|4th)\s+(?:semester|year)(?:\s*\((?:fall|spring|summer|winter)\))?|(?:freshman|sophomore|junior|senior)\s+year|(?:fall|spring|summer|winter)(?:\s+(?:(?:term|semester|year)|(?:one|two|three|four|[1-4])))?|(?:semester|term|year)\s*(?:one|two|three|four|[1-8])|course\s+map|plan\s+of\s+study|suggested\s+schedul(?:e|ing)|recommended\s+(?:course\s+)?(?:schedule|sequence)|sample\s+(?:course\s+)?(?:schedule|plan)|four[- ]year\s+plan|roadmap))(?:\s*[:\u2014-]|\s*$)/i;

function acceptedDocuments() {
  return fs.readdirSync(path.join(ROOT, 'composed'))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const composition = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'composed', file), 'utf8'),
      );
      const institution = institutions.find((row) => row.slug === composition.slug);
      const extract = JSON.parse(
        fs.readFileSync(path.join(ROOT, 'requirements', file), 'utf8'),
      );
      const compiled = compileDegreeComposition(composition, {
        institutionLevel: institution.level,
      });
      const credits = new Map(compiled.codes_seen.map((code) => [code, 3]));
      const document = toDocument(extract, institution, credits, composition);
      const acceptance = validateDegreeAcceptance(document, {
        institutionLevel: institution.level,
        resolveCourse: acceptanceResolver(document, credits),
      });
      return { acceptance, document };
    })
    .filter(({ acceptance }) => acceptance.accepted);
}

function visibleRequirementText(document) {
  const variants = (document.requirement_variants || [])
    .flatMap((variant) => variant.requirement_groups || []);
  return [...document.requirement_groups, ...variants].flatMap((group) => [
    group.title,
    group.note,
    ...(group.sections || []).flatMap((section) => [
      section.label_seen,
      section.note,
      ...(section.receivers || []).flatMap((receiver) => [
        receiver.note,
        receiver.receiving?.name,
        receiver.receiving?.title,
      ]),
    ]),
  ]).filter(Boolean);
}

describe('Virginia canonical requirement trees exclude prospective schedules', () => {
  it('recognizes the exact legacy heading forms removed from production', () => {
    expect([
      'Fall 1',
      'Spring 1',
      'Freshman Year',
      'Sophomore Year',
      'Junior Year',
      'Senior Year',
      'First Semester (Fall)',
      'Second Semester (Spring)',
    ].every((heading) => PROSPECTIVE_HEADING.test(heading))).toBe(true);
  });

  it('audits the entire accepted publication cohort, including alternate variants', () => {
    const documents = acceptedDocuments();

    expect(documents).toHaveLength(37);
    for (const { document } of documents) {
      expect({
        id: document._id,
        prospective_content: visibleRequirementText(document).filter((value) => (
          PROSPECTIVE_HEADING.test(value)
        )),
      }).toEqual({ id: document._id, prospective_content: [] });
    }
  });

  it('retains NSU authoritative curriculum rows but discards their term sequence', () => {
    const { document } = acceptedDocuments().find(({ document: row }) => (
      row._id === 'va:degree:norfolk-state-university:cs'
    ));

    expect(document.requirement_groups.map((group) => group.title)).toEqual([
      'Standard Track fixed computing, mathematics, and technical-writing curriculum',
      'Two distinct laboratory-science selections required by the Standard Track curriculum',
      'Explicit General Education courses and narrowed Standard Track distributions',
      'General Education category gates supplied inside the fixed Standard Track curriculum',
      'Upper-level Computer Science and Mathematics electives',
      'Free elective',
      'University and department graduation requirements',
    ]);
    expect(visibleRequirementText(document).some((value) => PROSPECTIVE_HEADING.test(value)))
      .toBe(false);
  });
});
