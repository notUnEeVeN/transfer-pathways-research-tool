import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DegreeRequirementsDetail } from './DataPage'
import tmpl from './shared/components/requirements/_degree_template.fixture.json'

describe('DegreeRequirementsDetail (ledger-rendered template)', () => {
  it('renders the current endpoint shape through the shared ledger', () => {
    const { container } = render(<DegreeRequirementsDetail doc={tmpl} />)
    expect(container.textContent).toContain('requirements')
    // header identifies what this view is (eyebrow + clarifying caption)
    expect(container.textContent).toContain('Hand-curated four-year graduation requirements')
    expect(container.textContent).toContain('The full bachelor’s degree requirement set')
    expect(container.textContent).toContain('Lower-division mathematics')
    expect(container.textContent).toContain('MATH 51')
    // template rows have no college context: no articulation claims, and the
    // eligibility completion marks are off
    expect(container.textContent).not.toContain('you can transfer without it')
    expect(container.querySelectorAll('[role="img"]').length).toBe(0)
    // at-the-university slots still carry their reason
    expect(container.textContent).toContain('Must be taken at the university after transfer')
  })

  // Regression: a persisted (IndexedDB) response from an earlier endpoint shape
  // (v3 `groups`, no `requirement_groups`). The tab must not crash to blank.
  it('does not crash on a stale response shape missing requirement_groups', () => {
    const stale = { school: 'UC Berkeley', program: 'EECS, B.S.', total: 29, groups: [{ label: 'x', lines: [] }] }
    expect(() => render(<DegreeRequirementsDetail doc={stale} />)).not.toThrow()
  })

  it('flags a template as Verified once it carries verification notes', () => {
    const verified = { ...tmpl, verification_notes: [{ text: 'walked the official pages', author_label: 'Tybalt Mallet', created_at: '2026-08-02T00:00:00.000Z' }] }
    const { container } = render(<DegreeRequirementsDetail doc={verified} />)
    expect(container.textContent).toContain('checked against the official pages')
    expect(container.textContent).toContain('Verified by Tybalt Mallet')
    // Same banner as the associate-degree review: who, when, and how to reopen.
    expect(container.textContent).toContain('Use Unverify below')
    expect(container.textContent).toMatch(/8\/\d{1,2}\/2026/)
  })

  it('flags a template as Verified from an explicit verdict flag, even with no notes', () => {
    const verified = { ...tmpl, verification_notes: [], verification: { verified: true, verified_by_label: 'Tybalt Mallet' } }
    const { container } = render(<DegreeRequirementsDetail doc={verified} />)
    expect(container.textContent).toContain('Verified by Tybalt Mallet')
  })

  it('shows no verified banner for a template with no notes and no verdict flag', () => {
    const unverified = { ...tmpl, verification_notes: [], verification: null }
    const { container } = render(<DegreeRequirementsDetail doc={unverified} />)
    expect(container.textContent).not.toContain('checked against the official pages')
  })
})
