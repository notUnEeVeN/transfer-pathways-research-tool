/**
 * ASSIST.org's academic year identifier. Used in URLs we link out to so the
 * user lands on the matching agreement year. Bump this every academic year
 * (75 → 76 → 77...) and update ASSIST_ACADEMIC_YEAR_LABEL alongside.
 *
 * Note: this is intentionally separate from the data-parse-script's own
 * academic-year config — the scraper has its own pipeline cadence; the
 * frontend only cares about which year the public ASSIST.org page should
 * display.
 */
export const ASSIST_ACADEMIC_YEAR = 76

/** Human-readable label for the current ASSIST academic year. Bump with
 *  ASSIST_ACADEMIC_YEAR above. */
export const ASSIST_ACADEMIC_YEAR_LABEL = '2025–2026'

/**
 * FALLBACK / initial value for the "data last refreshed from ASSIST.org" date.
 * The source of truth is now the `site_meta` doc the publish pipeline writes to
 * Atlas, served at /site-meta and read at runtime via useSiteMeta — so the date
 * updates on the next publish WITHOUT a frontend redeploy.
 *
 * This constant is only used when the live value isn't available: SSR/prerender
 * (it seeds useSiteMeta's initialData so the prerendered Methodology page and the
 * client's first render agree — no hydration mismatch), the initial loading tick,
 * and API-down. Keep it roughly current as a sensible default; it no longer needs
 * to be bumped on every scrape.
 */
export const DATA_LAST_UPDATED = 'June 1, 2026'

/**
 * Base URL for the research API. Resolved from VITE_API_URL at build time,
 * falling back to the local dev server. This console must never default to the
 * production PMT API.
 */
const configuredApiBase = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')
export const API_BASE_URL = configuredApiBase.endsWith('/api')
  ? configuredApiBase
  : `${configuredApiBase}/api`

// Single source of truth lives in the shared eligibility logic (server/shared,
// via the @shared alias) so the grade→GPA scale can't drift between frontend
// and server.
export { gradeToGPA } from '@shared/eligibility/constants'

export const GRADE_OPTIONS = [
  { value: 'PL', label: 'PL' },
  { value: 'IP', label: 'IP' },
  { value: 'A+', label: 'A+' },
  { value: 'A', label: 'A' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B', label: 'B' },
  { value: 'B-', label: 'B-' },
  { value: 'C+', label: 'C+' },
  { value: 'C', label: 'C' },
  { value: 'C-', label: 'C-' },
  { value: 'D+', label: 'D+' },
  { value: 'D', label: 'D' },
  { value: 'D-', label: 'D-' },
  { value: 'F', label: 'F' }
]

// The four academic seasons, for the term dropdown of any term+year picker (the
// Add Course modal and the Cal-GETC "Add to plan" picker share this).
export const TERM_OPTIONS = [
  { value: 'Fall', label: 'Fall' },
  { value: 'Winter', label: 'Winter' },
  { value: 'Spring', label: 'Spring' },
  { value: 'Summer', label: 'Summer' }
]

export const UC_ORDER = [
  'UC Berkeley',
  'UC Los Angeles',
  'UC San Diego',
  'UC Irvine',
  'UC Davis',
  'UC Santa Barbara',
  'UC Santa Cruz',
  'UC Riverside',
  'UC Merced'
]
