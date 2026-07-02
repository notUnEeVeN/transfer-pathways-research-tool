// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SectionCard from './SectionCard'

describe('SectionCard', () => {
  it('renders its rows', () => {
    render(
      <SectionCard header={<span>Area 3</span>}>
        <div>Row A</div>
        <div>Row B</div>
      </SectionCard>
    )
    expect(screen.getByText('Row A')).toBeTruthy()
    expect(screen.getByText('Row B')).toBeTruthy()
  })

  it('shows a header strip with header + headerMark', () => {
    render(
      <SectionCard header={<span>Seven-course breadth</span>} headerMark={<span>Planned</span>}>
        <div>row</div>
      </SectionCard>
    )
    expect(screen.getByText('Seven-course breadth')).toBeTruthy()
    expect(screen.getByText('Planned')).toBeTruthy()
  })

  it('omits the header strip when neither header nor headerMark is given', () => {
    const { container } = render(
      <SectionCard>
        <div>only rows</div>
      </SectionCard>
    )
    // Body is the sole child of the content column (no header strip before it).
    const contentCol = container.querySelector('.flex-1')
    expect(contentCol.children.length).toBe(1)
  })

  it('applies the success tone to the rail and border', () => {
    const { container } = render(
      <SectionCard tone='success' header={<span>done</span>}>
        <div>row</div>
      </SectionCard>
    )
    const card = container.firstChild
    expect(card.className).toContain('border-success/30')
    const rail = card.querySelector('[aria-hidden]')
    expect(rail.className).toContain('bg-success-soft/60')
  })

  it('renders a footer below the body', () => {
    render(
      <SectionCard footer={<p>nothing articulated</p>}>
        <div>row</div>
      </SectionCard>
    )
    expect(screen.getByText('nothing articulated')).toBeTruthy()
  })
})
