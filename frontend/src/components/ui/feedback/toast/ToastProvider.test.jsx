// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider } from './ToastProvider'
import { useToast } from './ToastContext'

// Drives the public toast API through buttons, the way a real component would —
// no reaching into provider internals.
function Harness() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Saved!')}>success</button>
      <button onClick={() => toast.error('Boom')}>error</button>
      <button onClick={() => toast.info('Heads up')}>info</button>
    </div>
  )
}

function renderHarness() {
  return render(
    <ToastProvider>
      <Harness />
    </ToastProvider>
  )
}

const advance = (ms) => act(() => vi.advanceTimersByTime(ms))

describe('ToastProvider', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    act(() => vi.runOnlyPendingTimers())
    vi.useRealTimers()
  })

  it('shows a success toast and auto-dismisses it after 5s', () => {
    renderHarness()
    fireEvent.click(screen.getByText('success'))
    expect(screen.getByText('Saved!')).toBeInTheDocument()

    advance(5000) // auto-dismiss timer fires -> begins leaving
    advance(150) // leave transition completes -> unmounted
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
  })

  it('keeps an error toast until it is dismissed', () => {
    renderHarness()
    fireEvent.click(screen.getByText('error'))
    const toast = screen.getByRole('alert')
    expect(toast).toHaveTextContent('Boom')

    advance(10000) // errors have no auto-dismiss timer
    expect(screen.getByText('Boom')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Dismiss'))
    advance(150)
    expect(screen.queryByText('Boom')).not.toBeInTheDocument()
  })

  it('pauses the auto-dismiss timer while hovered', () => {
    renderHarness()
    fireEvent.click(screen.getByText('info'))
    const toast = screen.getByRole('status')

    fireEvent.mouseEnter(toast)
    advance(10000) // timer is cleared on hover, so it stays
    expect(screen.getByText('Heads up')).toBeInTheDocument()

    fireEvent.mouseLeave(toast) // timer restarts
    advance(5000)
    advance(150)
    expect(screen.queryByText('Heads up')).not.toBeInTheDocument()
  })

  it('stacks multiple toasts, newest first', () => {
    renderHarness()
    fireEvent.click(screen.getByText('info'))
    fireEvent.click(screen.getByText('error'))

    const messages = screen.getAllByText(/Heads up|Boom/).map((el) => el.textContent)
    expect(messages).toEqual(['Boom', 'Heads up'])
  })
})
