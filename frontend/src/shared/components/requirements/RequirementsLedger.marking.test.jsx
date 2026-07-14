import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RequirementsLedger from './RequirementsLedger'

// Task 9 — additive row-marking. These assertions exercise ONLY the new
// `markedRows`/`onMarkRow` affordance; the default (props-absent) path is
// covered by the "no chip / no cursor-pointer" case so the golden ledger
// output stays byte-identical.

// Minimal major: one required group, one section, two articulated receivers.
// Row keys are the index path `${groupIdx}-${sectionIdx}-${rowIdx}`.
const major = {
  requirement_groups: [{
    is_required: true,
    sections: [{
      receivers: [
        { receiving: { kind: 'course', parent_id: 1 }, articulation_status: 'articulated', options: [{ course_ids: [10] }] },
        { receiving: { kind: 'course', parent_id: 2 }, articulation_status: 'articulated', options: [{ course_ids: [20] }] },
      ],
    }],
  }],
}
const courses = [
  { course_id: 10, prefix: 'CC', number: '100', title: 'Intro', units: 3 },
  { course_id: 20, prefix: 'CC', number: '200', title: 'Next', units: 3 },
]
const universityCoursesById = {
  1: { prefix: 'UNI', number: '1', title: 'Req One', min_units: 4, max_units: 4 },
  2: { prefix: 'UNI', number: '2', title: 'Req Two', min_units: 4, max_units: 4 },
}

describe('RequirementsLedger — additive row marking', () => {
  it('(a) clicking a row calls onMarkRow with its index-path key', () => {
    const onMarkRow = vi.fn()
    render(
      <RequirementsLedger major={major} courses={courses} universityCoursesById={universityCoursesById}
        preserveOrder showCompletion={false} markedRows={new Set()} onMarkRow={onMarkRow} />
    )
    // Click anywhere in the first row (the receiving side); the click bubbles
    // to the row wrapper's onClick.
    fireEvent.click(screen.getByText('UNI 1'))
    expect(onMarkRow).toHaveBeenCalledWith('0-0-0')
  })

  it('(b) a marked row renders the "Marked in error" chip', () => {
    render(
      <RequirementsLedger major={major} courses={courses} universityCoursesById={universityCoursesById}
        preserveOrder showCompletion={false} markedRows={new Set(['0-0-0'])} onMarkRow={vi.fn()} />
    )
    expect(screen.getByText(/marked in error/i)).toBeInTheDocument()
  })

  it('(c) ticking the CC checkbox does NOT mark the row', () => {
    const onMarkRow = vi.fn()
    const onToggleCourse = vi.fn()
    render(
      <RequirementsLedger major={major} courses={courses} universityCoursesById={universityCoursesById}
        preserveOrder showCompletion={false} onToggleCourse={onToggleCourse}
        markedRows={new Set()} onMarkRow={onMarkRow} />
    )
    const checkbox = screen.getAllByRole('checkbox')[0]
    fireEvent.click(checkbox)
    expect(onToggleCourse).toHaveBeenCalledWith(10)
    expect(onMarkRow).not.toHaveBeenCalled()
  })

  it('(d) without the new props: no chip and no cursor-pointer rows (default path)', () => {
    const { container } = render(
      <RequirementsLedger major={major} courses={courses} universityCoursesById={universityCoursesById}
        preserveOrder showCompletion={false} />
    )
    expect(screen.queryByText(/marked in error/i)).toBeNull()
    expect(container.querySelector('.cursor-pointer')).toBeNull()
  })
})
