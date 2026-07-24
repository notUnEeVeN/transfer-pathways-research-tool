import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import MajorVerificationDots, {
  MajorVerificationLegend, VERIFICATION_STATE_META,
} from './MajorVerificationDots'

describe('MajorVerificationDots', () => {
  const states = [
    { slug: 'cs', label: 'Computer Science', state: 'verified' },
    { slug: 'bio', label: 'Biology', state: 'present' },
    { slug: 'econ', label: 'Economics', state: 'absent' },
  ]

  it('renders one labelled dot per major, in the given order', () => {
    render(<MajorVerificationDots states={states} />)
    const dots = screen.getAllByRole('img')
    expect(dots).toHaveLength(3)
    expect(dots[0]).toHaveAttribute('aria-label', 'Computer Science: verified')
    expect(dots[1]).toHaveAttribute('aria-label', 'Biology: present, unverified')
    expect(dots[2]).toHaveAttribute('aria-label', 'Economics: not offered')
  })

  it('colours each dot by its state tone', () => {
    render(<MajorVerificationDots states={states} />)
    const [cs, bio, econ] = screen.getAllByRole('img')
    expect(cs.className).toContain(VERIFICATION_STATE_META.verified.dot)
    expect(bio.className).toContain(VERIFICATION_STATE_META.present.dot)
    expect(econ.className).toContain(VERIFICATION_STATE_META.absent.dot)
  })

  it('falls back to a dash when there are no majors', () => {
    render(<MajorVerificationDots states={[]} />)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('legend decodes the colours and names the major order', () => {
    render(<MajorVerificationLegend majors={[
      { slug: 'cs', label: 'Computer Science' },
      { slug: 'bio', label: 'Biology' },
    ]} />)
    expect(screen.getByText('verified')).toBeTruthy()
    expect(screen.getByText('present, unverified')).toBeTruthy()
    expect(screen.getByText('not offered')).toBeTruthy()
    expect(screen.getByText(/Computer Science · Biology/)).toBeTruthy()
  })
})
