import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockMajors = vi.fn()
vi.mock('./useMajors', async (importOriginal) => ({
  ...(await importOriginal()),
  useMajors: (...a) => mockMajors(...a),
}))

const { default: MajorPicker } = await import('./MajorPicker')
const { MajorProvider, useMajorChoice } = await import('./MajorContext')

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
  isError: false,
  error: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  window.history.replaceState({}, '', '/')
})

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

function ChoiceProbe() {
  const { slug, setSlug } = useMajorChoice('visuals', { urlParam: 'major' })
  return (
    <div>
      <output aria-label='Selected major'>{slug}</output>
      <button type='button' onClick={() => setSlug('cs')}>Choose CS</button>
      <button type='button' onClick={() => setSlug('bio')}>Choose Biology</button>
    </div>
  )
}

const renderChoice = () => render(<MajorProvider><ChoiceProbe /></MajorProvider>)

describe('URL-backed major choice', () => {
  it('lets a valid URL major override session state and preserves the rest of the URL', async () => {
    mockMajors.mockReturnValue(state([cs, bio]))
    window.sessionStorage.setItem('major-choice:visuals', JSON.stringify('cs'))
    window.history.replaceState({}, '', '/?major=bio&review=open#figure')

    renderChoice()
    expect(screen.getByLabelText('Selected major')).toHaveTextContent('bio')

    fireEvent.click(screen.getByRole('button', { name: 'Choose CS' }))
    await waitFor(() => expect(new URL(window.location.href).searchParams.get('major')).toBe('cs'))
    expect(new URL(window.location.href).searchParams.get('review')).toBe('open')
    expect(window.location.hash).toBe('#figure')
  })

  it('does not erase a deep link while the configured majors are still loading', async () => {
    mockMajors.mockReturnValue({ ...state([cs]), isLoading: true })
    window.history.replaceState({}, '', '/?major=bio')
    const view = renderChoice()

    expect(new URL(window.location.href).searchParams.get('major')).toBe('bio')

    mockMajors.mockReturnValue(state([cs, bio]))
    view.rerender(<MajorProvider><ChoiceProbe /></MajorProvider>)
    await waitFor(() => expect(screen.getByLabelText('Selected major')).toHaveTextContent('bio'))
    expect(new URL(window.location.href).searchParams.get('major')).toBe('bio')
  })

  it('follows browser Back and Forward major changes', async () => {
    mockMajors.mockReturnValue(state([cs, bio]))
    window.history.replaceState({}, '', '/?major=cs')
    renderChoice()

    act(() => {
      window.history.pushState({}, '', '/?major=bio')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitFor(() => expect(screen.getByLabelText('Selected major')).toHaveTextContent('bio'))
  })

  it('canonicalizes an unknown major only after validation', async () => {
    mockMajors.mockReturnValue(state([cs, bio]))
    window.history.replaceState({}, '', '/?major=unknown&review=open#figure')
    renderChoice()

    await waitFor(() => expect(new URL(window.location.href).searchParams.get('major')).toBe('cs'))
    expect(new URL(window.location.href).searchParams.get('review')).toBe('open')
    expect(window.location.hash).toBe('#figure')
  })

  it('preserves a deep-linked major when the registry request fails', () => {
    mockMajors.mockReturnValue({
      ...state([cs]),
      isError: true,
      error: new Error('registry unavailable'),
    })
    window.history.replaceState({}, '', '/?view=visuals&major=bio#figure')

    renderChoice()

    const url = new URL(window.location.href)
    expect(url.searchParams.get('major')).toBe('bio')
    expect(url.searchParams.get('view')).toBe('visuals')
    expect(url.hash).toBe('#figure')
  })
})
