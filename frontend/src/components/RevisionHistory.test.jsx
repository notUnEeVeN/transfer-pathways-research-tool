import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

const mocks = {
  useAccessMe: vi.fn(),
  useRequirementRevisions: vi.fn(),
}
vi.mock('@frontend/query/hooks/useAccess', () => ({
  useAccessMe: (...a) => mocks.useAccessMe(...a),
}))
vi.mock('@frontend/query/hooks/useData', () => ({
  useRequirementRevisions: (...a) => mocks.useRequirementRevisions(...a),
}))

const { default: RevisionHistory } = await import('./RevisionHistory')

const revisions = {
  revisions: [
    {
      id: 'r2', at: '2026-07-02T00:00:00Z', by_label: 'Tybalt Mallet',
      created: false, verified: true,
      changes: [
        { path: 'degree_title_seen', from: 'CS, A.S.', to: 'Computer Science, A.S.' },
        { path: 'verification.verified', from: false, to: true },
      ],
    },
    { id: 'r1', at: '2026-07-01T00:00:00Z', by_label: 'AI Import', created: true, verified: false, changes: [] },
  ],
}

describe('RevisionHistory', () => {
  beforeEach(() => {
    mocks.useRequirementRevisions.mockReturnValue({ data: revisions, isLoading: false, isError: false })
  })

  it('renders nothing for a non-admin', () => {
    mocks.useAccessMe.mockReturnValue({ data: { role: 'partner' } })
    const { container } = render(<RevisionHistory kind='as_degree' id='as_degree:1:cs:ast' />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an admin the hand edits with who, verdict, and a field-level diff', () => {
    mocks.useAccessMe.mockReturnValue({ data: { role: 'admin' } })
    render(<RevisionHistory kind='as_degree' id='as_degree:1:cs:ast' />)

    // Collapsed by default — expand it.
    expect(screen.getByText(/2 edits/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Edit history/ }))

    expect(screen.getByText('Tybalt Mallet')).toBeInTheDocument()
    expect(screen.getByText('verified')).toBeInTheDocument()
    // The corrected title shows as from → to.
    expect(screen.getByText('degree_title_seen')).toBeInTheDocument()
    expect(screen.getByText('CS, A.S.')).toBeInTheDocument()
    expect(screen.getByText('Computer Science, A.S.')).toBeInTheDocument()
  })

  it('does not query when there is no document id', () => {
    mocks.useAccessMe.mockReturnValue({ data: { role: 'admin' } })
    const { container } = render(<RevisionHistory kind='as_degree' id={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})
