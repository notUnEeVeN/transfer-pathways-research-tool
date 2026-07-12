import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DegreeRequirementsDetail } from './DataPage'
import tmpl from './shared/components/requirements/_degree_template.fixture.json'

describe('DegreeRequirementsDetail', () => {
  it('renders the current endpoint shape (grouped, with a total)', () => {
    const { container } = render(<DegreeRequirementsDetail doc={tmpl} />)
    expect(container.textContent).toContain('requirements to graduate')
    expect(container.textContent).toContain('Lower-division mathematics')
    expect(container.textContent).toContain('MATH 51')
  })

  // Regression: a persisted response from an earlier endpoint shape lacked
  // `groups`. The tab must not crash to blank on it.
  it('does not crash on a stale response shape missing groups', () => {
    const stale = { school: 'UC Berkeley', program: 'EECS, B.S.', requirement_groups: [{}, {}] }
    expect(() => render(<DegreeRequirementsDetail doc={stale} />)).not.toThrow()
  })
})
