// Deliberately runs under the default jsdom environment (not this
// directory's usual `happy-dom` pragma): happy-dom's `navigator.clipboard`
// is a getter-only accessor, so `Object.assign(navigator, { clipboard })`
// throws there. jsdom leaves `clipboard` unset, so the assignment below is a
// plain own-property add.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import RouteHint from './RouteHint'

beforeEach(() => {
  vi.useFakeTimers()
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

afterEach(() => {
  act(() => vi.runOnlyPendingTimers())
  vi.useRealTimers()
})

describe('RouteHint', () => {
  it('renders the method + path chip as a button', () => {
    render(<RouteHint path='/api/assist/coverage' />)
    expect(screen.getByRole('button', { name: 'GET /api/assist/coverage' })).toBeInTheDocument()
  })

  it('shows a long query route in full and keeps it copyable', () => {
    const path = '/api/curated/requirement-comparison?school_id=79&major=Computer%20Science&community_college_id=110'
    render(<RouteHint path={path} />)

    const button = screen.getByRole('button', { name: `GET ${path}` })
    expect(button).toHaveTextContent(`GET ${path}`)
    fireEvent.click(button)
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'pmt.get("curated/requirement-comparison", school_id="79", major="Computer Science", community_college_id="110")'
    )
  })

  it('copies a bare pmt.get(...) snippet when the path has no query string', () => {
    render(<RouteHint path='/api/assist/coverage' />)
    fireEvent.click(screen.getByRole('button'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('pmt.get("assist/coverage")')
  })

  it('promotes identifier-safe query params to kwargs', () => {
    render(<RouteHint path='/api/assist/courses?institution_id=cc:110' />)
    fireEvent.click(screen.getByRole('button'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'pmt.get("assist/courses", institution_id="cc:110")'
    )
  })

  it('shows "Copied!" for ~1.2s after a click, then reverts', () => {
    render(<RouteHint path='/api/assist/coverage' />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toHaveTextContent('Copied!')

    act(() => vi.advanceTimersByTime(1300))
    expect(screen.getByRole('button', { name: 'GET /api/assist/coverage' })).toBeInTheDocument()
  })

  it('falls back to a single quoted path when a query key is not a Python identifier', () => {
    render(<RouteHint path='/api/assist/courses?a-b=1' />)
    fireEvent.click(screen.getByRole('button'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('pmt.get("assist/courses?a-b=1")')
  })

  it('copies plain "METHOD path" text for non-GET methods, skipping pmt.get', () => {
    render(<RouteHint method='POST' path='/api/audit/doc/abc123' />)
    fireEvent.click(screen.getByRole('button'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('POST /api/audit/doc/abc123')
  })

  it('escapes double quotes in query param values', () => {
    render(<RouteHint path='/api/assist/courses?q=say%20%22hi%22' />)
    fireEvent.click(screen.getByRole('button'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'pmt.get("assist/courses", q=' + JSON.stringify('say "hi"') + ')'
    )
  })

  it('renders nothing when path is missing', () => {
    const { container } = render(<RouteHint />)
    expect(container).toBeEmptyDOMElement()
  })
})
