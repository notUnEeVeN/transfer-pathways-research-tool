import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockMajors = vi.fn()
vi.mock('./useMajors', async (importOriginal) => ({
  ...(await importOriginal()),
  useMajors: (...a) => mockMajors(...a),
}))

const { default: MajorPicker } = await import('./MajorPicker')
const { MajorProvider } = await import('./MajorContext')

// The picker reads the shared selection, so it renders inside the provider.
const renderPicker = (props) =>
  render(<MajorProvider><MajorPicker {...props} /></MajorProvider>)

const cs = {
  slug: 'cs',
  label: 'Computer Science',
  capabilities: { asDegrees: true, paperBaselines: true },
}
const bio = {
  slug: 'bio',
  label: 'Biology',
  capabilities: { asDegrees: false, paperBaselines: false },
}

const state = (majors) => ({
  majors,
  defaultSlug: majors[0].slug,
  bySlug: new Map(majors.map((m) => [m.slug, m])),
  isLoading: false,
})

beforeEach(() => vi.clearAllMocks())

describe('MajorPicker', () => {
  it('renders nothing when only one major is onboarded', () => {
    mockMajors.mockReturnValue(state([cs]))
    const { container } = renderPicker({ value: 'cs', onChange: () => {} })
    expect(container).toBeEmptyDOMElement()
  })

  it('offers every major once a second is onboarded', () => {
    mockMajors.mockReturnValue(state([cs, bio]))
    renderPicker({ value: 'cs', onChange: () => {} })
    expect(screen.getByLabelText('Major')).toBeTruthy()
    expect(screen.getByText('Computer Science')).toBeTruthy()
  })

  it('pins to the capable major and explains why', () => {
    mockMajors.mockReturnValue(state([cs, bio]))
    renderPicker({
      value: 'cs',
      onChange: () => {},
      capability: 'asDegrees',
      caption: 'Requires the AS-degree data layer.',
    })
    // bio lacks the capability, so there is nothing to choose between.
    expect(screen.queryByLabelText('Major')).toBeNull()
    expect(screen.getByText('Computer Science')).toBeTruthy()
    expect(screen.getByText('Requires the AS-degree data layer.')).toBeTruthy()
  })

  it('stays silent for a capability gate when only one major exists at all', () => {
    mockMajors.mockReturnValue(state([cs]))
    const { container } = renderPicker({
      value: 'cs', onChange: () => {}, capability: 'asDegrees', caption: '…',
    })
    expect(container).toBeEmptyDOMElement()
  })
})
