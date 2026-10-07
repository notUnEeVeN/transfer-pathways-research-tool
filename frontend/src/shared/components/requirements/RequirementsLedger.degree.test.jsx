import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import RequirementsLedger from './RequirementsLedger'
import evl from './_degree_eval.fixture.json'
import { sectionRule } from './ledgerText'

describe('RequirementsLedger — merged degree doc (ledger style)', () => {
  it('preserves choose-one logic for alternative laboratory series', () => {
    const receivers = [{ receiving: { kind: 'series' } }, { receiving: { kind: 'series' } }]
    expect(sectionRule({ section_advisement: 1 }, {}, receivers, null, false))
      .toBe('Complete 1 of these 2 series:')
    expect(sectionRule({}, {}, receivers, { originalTotal: 1, label: 'courses' }, false))
      .toBe('Complete 1 of these 2 series:')
    expect(sectionRule({ section_advisement: 2 }, {}, receivers, null, false))
      .toBe('Complete all 2 series:')
  })

  it('shows a satisfied named ASSIST block without falsely claiming no articulation', () => {
    const major = { requirement_groups: [{ title: 'Mathematics', is_required: true, sections: [{
      receivers: [{ receiving: { kind: 'course', course_id: 'math' },
        articulation_status: 'articulated', assist_requirement: 'Mathematics Requirement', options: [] }],
    }] }] }
    const { container } = render(<RequirementsLedger major={major} preserveOrder showCompletion={false} />)
    expect(container.textContent).toContain('Articulated through the ASSIST requirement block: Mathematics Requirement')
    expect(container.textContent).not.toContain('No course articulates')
    expect(container.textContent).not.toContain('Take at the university')
  })
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

  it('renders breadth as a category count rather than a truncated OR list', () => {
    const category = {
      requirement_groups: [{
        title: 'Humanities & Social Sciences breadth',
        is_required: true,
        sections: [{
          section_advisement: 4,
          receivers: [{
            receiving: { kind: 'ge_area', code: 'H/SS', name: 'Humanities & Social Sciences breadth' },
            category_match: {
              kind: 'ge_area', areas: ['3A', '3B', '4'], required_count: 4,
              qualifying_count: 87, assumed: false,
            },
            articulation_status: 'articulated', options: [],
          }],
        }],
      }],
    }
    const { container } = render(
      <RequirementsLedger major={category} preserveOrder showCompletion={false} />
    )
    expect(container.textContent).toContain('Complete 4 courses from:')
    expect(container.textContent).toContain('87 qualifying courses')
    expect(container.textContent).toContain('IGETC 3A, 3B, 4')
    expect(container.textContent).not.toContain('Requirements with no community-college equivalent')
  })
})
