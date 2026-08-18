import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function Boom() { throw new Error('coverage rows were not an array') }

describe('ErrorBoundary', () => {
  it('shows the failure and its message instead of unmounting the page', () => {
    // The boundary logs by design; keep the run output clean.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <div>
        <p>the rest of the page</p>
        <ErrorBoundary scope='The coverage figure'><Boom /></ErrorBoundary>
      </div>
    )

    expect(screen.getByText('The coverage figure could not be displayed.')).toBeInTheDocument()
    expect(screen.getByText('coverage rows were not an array')).toBeInTheDocument()
    // The point: everything around it survives.
    expect(screen.getByText('the rest of the page')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders its children when nothing throws', () => {
    render(<ErrorBoundary scope='x'><p>fine</p></ErrorBoundary>)
    expect(screen.getByText('fine')).toBeInTheDocument()
  })
})
