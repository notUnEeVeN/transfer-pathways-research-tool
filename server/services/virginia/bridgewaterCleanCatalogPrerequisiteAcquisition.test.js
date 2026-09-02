import { describe, expect, it } from 'vitest';
import {
  expectedCoursePath,
  bridgewaterUnmodeledTimingSignals,
  extractBridgewaterCourseEntry,
  verifyBridgewaterCatalogEdition,
} from './bridgewaterCleanCatalogPrerequisiteAcquisition';

const entry = ({
  canonical = 'https://bridgewater.cleancatalog.io/art/art321',
  about = '/art/art321',
  heading = 'ART-321: Graphic Design',
  credits = '3',
  extra = '',
} = {}) => `
  <html><head><link rel="canonical" href="${canonical}"></head><body><main>
    <article about="${about}" class="node node--type-class node--view-mode-full">
      <header><h1>${heading}</h1></header>
      <span class="field field--name-field-credits"><span class="field__item">${credits}</span></span>
      <div class="field field--name-field-pr"><div class="field__label">Prerequisites</div><div class="field__item">Sophomore standing</div></div>
      <div class="field field--name-field-corequisites"><div class="field__label">Corequisites</div><div class="field__item">CL-200</div></div>
    </article>${extra}
  </main></body></html>`;

describe('Bridgewater CleanCatalog prerequisite acquisition boundary', () => {
  it('maps every reviewed Bridgewater direct-course prefix to its exact department path', () => {
    expect(expectedCoursePath('ART321')).toBe('/art/art321');
    expect(expectedCoursePath('CL200')).toBe('/connected-learning-curriculum/cl200');
    expect(expectedCoursePath('COMM100')).toBe('/communication-studies-theatre/comm100');
    expect(expectedCoursePath('CSCI341')).toBe('/mathematics-computer-science/csci341');
    expect(expectedCoursePath('DSA230')).toBe('/mathematics-computer-science/dsa230');
    expect(expectedCoursePath('MATH150')).toBe('/mathematics-computer-science/math150');
    expect(expectedCoursePath('HIST101')).toBeNull();
  });

  it('normalizes punctuation while refusing unsupported departments', () => {
    expect(expectedCoursePath('ART-321')).toBe('/art/art321');
    expect(expectedCoursePath('CL200')).toBe('/connected-learning-curriculum/cl200');
    expect(expectedCoursePath('COMM100')).toBe('/communication-studies-theatre/comm100');
    expect(expectedCoursePath('HIST101')).toBeNull();
  });

  it('accepts one exact full course article and retains prerequisite/corequisite text', () => {
    const result = extractBridgewaterCourseEntry(entry(), 'ART321');
    expect(result.verified).toBe(true);
    expect(result.entries).toEqual([expect.objectContaining({
      course_code: 'ART321',
      heading_text: 'ART-321: Graphic Design',
      title: 'Graphic Design',
      published_units: expect.objectContaining({ credit_hours_min: 3, credit_hours_max: 3 }),
    })]);
    expect(result.entries[0].raw_entry_text).toContain('Prerequisites: Sophomore standing');
    expect(result.entries[0].raw_entry_text).toContain('Corequisites: CL-200');
    expect(result.entries[0].requisite_field_receipt).toMatchObject({
      receipt_contract: 'bridgewater_cleancatalog_exact_article_requisite_field_labels_v1',
      exact_prerequisite_field_count: 1,
      exact_corequisite_field_count: 1,
      unrecognized_requisite_like_field_count: 0,
    });
    expect(result.entries[0].requisite_field_receipt.requisite_fields).toEqual([
      expect.objectContaining({ label: 'Prerequisites', values: ['Sophomore standing'] }),
      expect.objectContaining({ label: 'Corequisites', values: ['CL-200'] }),
    ]);
  });

  it('flags Bridgewater timing prose that cannot be erased by field silence', () => {
    expect(bridgewaterUnmodeledTimingSignals(
      'This required first-semester seminar is taken during the student’s first semester.',
    )).toEqual(['required_first_semester', 'taken_during_first_semester']);
    expect(bridgewaterUnmodeledTimingSignals(
      'Taken in a student’s first semester.',
    )).toEqual(['taken_in_first_semester']);
    expect(bridgewaterUnmodeledTimingSignals(
      'Introduces programming fundamentals. Term Offered: Fall.',
    )).toEqual([]);
  });

  it.each([
    ['wrong canonical path', { canonical: 'https://bridgewater.cleancatalog.io/art/art322' }],
    ['wrong article path', { about: '/art/art322' }],
    ['wrong heading code', { heading: 'ART-322: Web Design' }],
    ['missing published credits', { credits: '' }],
    ['duplicate course article', { extra: '<article class="node node--type-class node--view-mode-full"><h1>ART-321: Duplicate</h1></article>' }],
  ])('fails closed on %s', (label, mutation) => {
    const result = extractBridgewaterCourseEntry(entry(mutation), 'ART321');
    expect(result.verified, label).toBe(false);
    expect(result.entries).toEqual([]);
    expect(result.missing).toEqual(['ART321']);
  });

  it('requires the official edition page to state the exact catalog year', () => {
    const html = `<html><head><link rel="canonical" href="https://bridgewater.cleancatalog.io/courses-of-instruction"></head><body><main>
      <h1>Courses of Instruction</h1>
      <p>Course numbers and descriptions listed herein apply to the 2026-2027 academic year.</p>
    </main></body></html>`;
    expect(verifyBridgewaterCatalogEdition(html, '2026-2027')).toMatchObject({
      verified: true,
      issues: [],
      catalog_year: '2026-2027',
    });
    expect(verifyBridgewaterCatalogEdition(html, '2025-2026')).toMatchObject({
      verified: false,
      catalog_year: null,
    });
  });

  it('does not accept a copyright year or navigation label as edition evidence', () => {
    const html = `<html><head><link rel="canonical" href="https://bridgewater.cleancatalog.io/courses-of-instruction"></head><body><main>
      <h1>Courses of Instruction</h1><p>2026-2027 Undergraduate Catalog</p>
    </main><footer>© 2026 Bridgewater College</footer></body></html>`;
    expect(verifyBridgewaterCatalogEdition(html, '2026-2027')).toMatchObject({
      verified: false,
      issues: ['exact_catalog_year_statement'],
    });
  });
});
