import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@frontend/query/hooks/useData', () => ({
  usePmtPy: () => ({ data: '# generated starter client', isLoading: false, isError: false }),
  useApiTokens: () => ({ data: { tokens: [] }, isLoading: false }),
  useCreateApiToken: () => ({ mutate: vi.fn(), isPending: false }),
  useRevokeApiToken: () => ({ mutate: vi.fn(), isPending: false }),
}))

import ApiPage from './DataApiDocs'

describe('API starter examples', () => {
  it('keeps one client and switches between the two researcher scripts', () => {
    render(<ApiPage />)

    expect(screen.getByText('starter.py')).toBeInTheDocument()
    expect(screen.getByText('simple_figure.py')).toBeInTheDocument()
    expect(screen.getAllByText(/pmt\.publish\(fig/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Copy for AI' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Multiple states' }))

    expect(screen.getByText('variant_figure.py')).toBeInTheDocument()
    expect(screen.getByText(/variants=\[/)).toBeInTheDocument()
    expect(screen.queryByText('simple_figure.py')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Data guide' }))
    expect(screen.getByRole('button', { name: 'Copy for AI' })).toBeInTheDocument()
  })
})
