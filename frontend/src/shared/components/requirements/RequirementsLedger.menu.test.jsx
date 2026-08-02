import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RequirementsLedger from './RequirementsLedger'

/**
 * A general-education menu lists many courses to pick one from. Printed in
 * full it buries the requirement it belongs to, so past a threshold the
 * section states the count instead. The courses stay in the document — this is
 * a display decision, not a smaller degree.
 */
const menuOf = (n, sectionExtras = {}) => ({
  requirement_groups: [{
    title: 'Social and Behavioral Sciences',
    is_required: true,
    sections: [{
      ...sectionExtras,
      receivers: Array.from({ length: n }, (_, i) => ({
        receiving: { kind: 'course', parent_id: i + 1 },
        articulation_status: 'articulated',
        options: [{ course_ids: [(i + 1) * 10] }],
      })),
    }],
  }],
})

const uniCourses = (n) => Object.fromEntries(
  Array.from({ length: n }, (_, i) => [i + 1, { prefix: 'SOC', number: String(200 + i), title: `Option ${i}` }])
)
const ccCourses = (n) => Array.from({ length: n }, (_, i) => (
  { course_id: (i + 1) * 10, prefix: 'CC', number: String(100 + i), title: `CC ${i}`, units: 3 }
))

const renderMenu = (n, props = {}, sectionExtras = {}) => render(
  <RequirementsLedger major={menuOf(n, sectionExtras)} courses={ccCourses(n)}
    universityCoursesById={uniCourses(n)} preserveOrder showCompletion={false} {...props} />
)

describe('RequirementsLedger — long option menus', () => {
  it('prints a short list in full', () => {
    const { container } = renderMenu(5)
    expect(container.textContent).toContain('SOC 200')
    expect(container.textContent).toContain('SOC 204')
    expect(container.textContent).not.toMatch(/courses satisfy this/)
  })

  it('collapses a long list to a count', () => {
    const { container } = renderMenu(24)
    expect(container.textContent).toContain('24 courses satisfy this')
    expect(container.textContent).not.toContain('SOC 200')
  })

  it('opens the list on request, and closes it again', () => {
    const { container } = renderMenu(24)
    fireEvent.click(screen.getByText('show'))
    expect(container.textContent).toContain('SOC 200')
    expect(container.textContent).toContain('SOC 223')
    fireEvent.click(screen.getByText('collapse'))
    expect(container.textContent).not.toContain('SOC 200')
  })

  it('never hides a course the student has completed', () => {
    // Collapsing must not swallow progress: the completed option stays on
    // screen and only the rest are counted away.
    const { container } = renderMenu(24, { showCompletion: true, userCourses: [{ course_id: 30 }] })
    expect(container.textContent).toContain('SOC 202')
    expect(container.textContent).toContain('23 more courses satisfy this')
  })
})
