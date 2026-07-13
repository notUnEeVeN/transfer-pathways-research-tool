import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { InstitutionRail, summarizeCoverageRows } from './DataPage'

describe('InstitutionRail', () => {
  it('renders a campus-only selector even when campus records include majors', () => {
    const onSelect = vi.fn()
    const { container, getByRole } = render(
      <InstitutionRail title='UC campuses' searchable={false} selectedId={7}
        onSelect={onSelect}
        items={[
          { id: 79, name: 'UC Berkeley', majors: ['EECS, B.S.'] },
          { id: 7, name: 'UC San Diego', majors: ['Computer Science, B.S.'] },
        ]} />
    )
    expect(container.textContent).toContain('UC campuses · 2')
    expect(container.textContent).not.toContain('Computer Science, B.S.')
    expect(getByRole('button', { name: 'UC San Diego' }).className).toContain('bg-primary-soft')

    fireEvent.click(getByRole('button', { name: 'UC Berkeley' }))
    expect(onSelect).toHaveBeenCalledWith(79)
  })
})

describe('summarizeCoverageRows', () => {
  it('averages all campus agreements and ignores unavailable percentages', () => {
    expect(summarizeCoverageRows([
      { pct_articulated: 100, fully_articulated: true },
      { pct_articulated: 50, fully_articulated: false },
      { pct_articulated: null, fully_articulated: false },
    ])).toEqual({
      count: 3,
      average: 75,
      fullyArticulated: false,
    })
  })
})
