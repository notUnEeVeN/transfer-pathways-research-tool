import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import DistrictsTab from './DataReferences'
import { districtIncome, formatIncome } from './shared/countyIncome'

const COLLEGES = [
  {
    _id: 'cc:110',
    community_college: 'Allan Hancock College',
    district: 'Allan Hancock Joint Community College District',
    region: 'South Central',
    counties_served: ['San Luis Obispo', 'Santa Barbara', 'Ventura'],
  },
  {
    _id: 'cc:1',
    community_college: 'Los Angeles City College',
    district: 'Los Angeles Community College District',
    region: 'Los Angeles',
    counties_served: ['Los Angeles'],
  },
]

vi.mock('./shared/query/hooks/useData', () => ({
  useRefTable: () => ({ data: { rows: COLLEGES }, isLoading: false, isError: false }),
  useDeleteRefRow: () => ({ mutate: vi.fn(), isPending: false }),
  useSaveRefRow: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUniversityCourses: () => ({ data: [], isLoading: false }),
}))

describe('districts tab service-area income', () => {
  it('shows the weighted district figure, its counties, and a checkable source', () => {
    render(<DistrictsTab />)
    const card = document.querySelector('[data-district-income]')

    expect(card).toBeTruthy()
    const expected = districtIncome(['San Luis Obispo', 'Santa Barbara', 'Ventura'])
    expect(within(card).getByText(formatIncome(expected.meanAgiPerReturn))).toBeTruthy()
    // Multi-county districts break out the counties behind the roll-up.
    expect(within(card).getByText('San Luis Obispo')).toBeTruthy()
    expect(within(card).getByText('Ventura')).toBeTruthy()

    const source = within(card).getByRole('link', { name: /Franchise Tax Board/i })
    expect(source.getAttribute('href')).toContain('data.ca.gov')
    expect(within(card).getByRole('link', { name: 'download' }).getAttribute('href'))
      .toContain('data.ca.gov')
    expect(card).toHaveTextContent(/not median household income/i)
  })

  it('drops the per-county breakdown for a single-county district', () => {
    render(<DistrictsTab />)
    fireEvent.click(screen.getByRole('button', { name: /Los Angeles Community College District/i }))

    const card = document.querySelector('[data-district-income]')
    const expected = districtIncome(['Los Angeles'])
    expect(within(card).getByText(formatIncome(expected.meanAgiPerReturn))).toBeTruthy()
    expect(within(card).queryByRole('table')).not.toBeInTheDocument()
  })
})
