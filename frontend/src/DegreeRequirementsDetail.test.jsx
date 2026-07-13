import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DegreeRequirementsDetail } from './DataPage'
import tmpl from './shared/components/requirements/_degree_template.fixture.json'

describe('DegreeRequirementsDetail (ledger-rendered template)', () => {
  it('renders the current endpoint shape through the shared ledger', () => {
    const { container } = render(<DegreeRequirementsDetail doc={tmpl} />)
    expect(container.textContent).toContain('requirements')
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
})
