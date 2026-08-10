import { describe, expect, it } from 'vitest';
import {
  hasEverySeedCapture,
  looksLikeRequirements,
  looksLikeRolePage,
} from './captureVirginiaCatalogs';

describe('Virginia catalog source-layer capture', () => {
  it('requires course evidence on a program page but accepts prose policy layers', () => {
    const prose = `Graduation requirements ${'students must complete the degree and residency requirements. '.repeat(12)}`;
    expect(looksLikeRequirements(prose)).toBe(false);
    expect(looksLikeRolePage('graduation', prose)).toBe(true);
    expect(looksLikeRolePage('general_education', prose)).toBe(true);
  });

  it('does not call a major-only cache complete after layer seeds are added', () => {
    const inst = {
      seeds: [
        { role: 'program', url: 'https://catalog.example.edu/cs-bs/' },
        { role: 'general_education', url: 'https://catalog.example.edu/core/' },
        { role: 'graduation', url: 'https://catalog.example.edu/policies/' },
      ],
    };
    const cached = {
      outcome: 'captured',
      pages: [{
        role: 'program',
        requested_url: inst.seeds[0].url,
        final_url: inst.seeds[0].url,
        status: 200,
        bytes_text: 5000,
        has_requirements: true,
      }],
    };
    expect(hasEverySeedCapture(inst, cached)).toBe(false);
    cached.pages.push({
      role: 'general_education', requested_url: inst.seeds[1].url,
      final_url: inst.seeds[1].url, status: 200, bytes_text: 3000,
    });
    cached.pages.push({
      role: 'graduation', requested_url: inst.seeds[2].url,
      final_url: inst.seeds[2].url, status: 200, bytes_text: 3000,
    });
    expect(hasEverySeedCapture(inst, cached)).toBe(true);
  });

  it('accepts a discovered current program in place of a stale Acalog seed', () => {
    const inst = { seeds: [{ role: 'program', url: 'https://catalog.example.edu/preview_program.php?poid=10' }] };
    const cached = {
      outcome: 'captured',
      pages: [{
        role: 'program',
        requested_url: 'https://catalog.example.edu/preview_program.php?poid=99',
        final_url: 'https://catalog.example.edu/preview_program.php?poid=99&print=1',
        has_requirements: true,
      }],
    };
    expect(hasEverySeedCapture(inst, cached)).toBe(true);
  });
});
