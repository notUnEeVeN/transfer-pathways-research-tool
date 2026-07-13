import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import RequirementsLedger from './RequirementsLedger'
import evl from './_degree_eval.fixture.json'

describe('RequirementsLedger — merged degree doc (ledger style)', () => {
  it('renders the evaluated 4-year degree with group titles + CC options', () => {
    const { container } = render(
      <RequirementsLedger major={{ requirement_groups: evl.requirement_groups }}
        courses={evl.courses} universityCoursesById={evl.university_courses_by_id}
        preserveOrder showCompletion={false} />
    )
    // group title shows instead of "Required"; a merged CC course shows
    expect(container.textContent).toContain('Lower-division mathematics')
    expect(container.textContent).not.toContain('Recommended')
    // showCompletion off: no vacuous eligibility checks — at-the-university
    // groups must not read as satisfied
    expect(container.querySelectorAll('[role="img"]').length).toBe(0)
  })
})
