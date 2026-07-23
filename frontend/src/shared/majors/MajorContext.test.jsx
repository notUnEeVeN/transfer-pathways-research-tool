import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MajorProvider, useMajorChoice } from './MajorContext'

// Two independent majors so a change is observable.
const MAJORS = [
  { slug: 'cs', label: 'Computer Science', capabilities: {} },
  { slug: 'bio', label: 'Biology', capabilities: {} },
]

vi.mock('./useMajors', () => ({
  CS_FALLBACK: [{ slug: 'cs', label: 'Computer Science', capabilities: {} }],
  useMajors: () => ({
    majors: MAJORS,
    defaultSlug: 'cs',
    bySlug: new Map(MAJORS.map((m) => [m.slug, m])),
    isLoading: false,
    isError: false,
    error: null,
  }),
}))

// A picker and a separate reader, both on the same scope — the shape that used
// to drift: the picker wrote its choice while the reader kept a stale copy
// until it remounted.
function Picker() {
  const { setSlug } = useMajorChoice('colleges')
  return <button onClick={() => setSlug('bio')}>pick bio</button>
}
function Reader() {
  const { major } = useMajorChoice('colleges')
  return <span data-testid="reader">{major?.label}</span>
}
function OtherScope() {
  const { major } = useMajorChoice('campuses')
  return <span data-testid="other">{major?.label}</span>
}

beforeEach(() => {
  try { sessionStorage.clear() } catch { /* jsdom */ }
})

describe('useMajorChoice shared scope', () => {
  it('updates every consumer of a scope in the same render, without a remount', () => {
    render(
      <MajorProvider>
        <Picker />
        <Reader />
      </MajorProvider>,
    )
    expect(screen.getByTestId('reader')).toHaveTextContent('Computer Science')
    act(() => { fireEvent.click(screen.getByText('pick bio')) })
    // The separate reader — never remounted — reflects the picker's change.
    expect(screen.getByTestId('reader')).toHaveTextContent('Biology')
  })

  it('keeps a different scope independent', () => {
    render(
      <MajorProvider>
        <Picker />
        <Reader />
        <OtherScope />
      </MajorProvider>,
    )
    act(() => { fireEvent.click(screen.getByText('pick bio')) })
    expect(screen.getByTestId('reader')).toHaveTextContent('Biology')
    // The campuses scope did not follow the colleges change.
    expect(screen.getByTestId('other')).toHaveTextContent('Computer Science')
  })
})
