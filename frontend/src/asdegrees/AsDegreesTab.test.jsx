import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import AsDegreesTab from './AsDegreesTab'

const useAsDegreesMock = vi.fn(() => ({
  data: {
    n: 1,
    rows: [{
      _id: 'as_degree:1:cs:ast', community_college_id: 1, college_id: 'cc:1',
      college_name: 'Alpha College', degree_type: 'ast', status: 'found',
      degree_title_seen: 'Computer Science A.S.-T', coverage_pct: 100,
      units_accounted: 60, total_units: 60, unit_system: 'semester',
      confidence_min: 0.9, flags: [], verified: false,
    }],
  },
  isLoading: false,
  isError: false,
}))

vi.mock('../shared/query/hooks/useData', () => ({
  useAsDegreeAvailability: () => ({
    data: {
      counts: {
        total_colleges: 3,
        ast: { available: 1, data_gap: 1, confirmed_none: 1, duplicate_candidate: 0 },
        local_as: { available: 1, data_gap: 0, confirmed_none: 2, duplicate_candidate: 0 },
        local_other: { available: 0, data_gap: 0, confirmed_none: 2, duplicate_candidate: 1 },
      },
      rows: [
        {
          college_id: 'cc:1', community_college_id: 1, college_name: 'Alpha College',
          inventory_source_url: 'https://catalog.example/alpha',
          types: {
            ast: { status: 'available', record_id: 'as_degree:1:cs:ast', degree_title_seen: 'Computer Science A.S.-T', inventory_titles: [] },
            local_as: { status: 'available', record_id: 'as_degree:1:cs:local_as', degree_title_seen: 'Computer Science A.S.', inventory_titles: [] },
            local_other: { status: 'confirmed_none', record_id: null, inventory_titles: [] },
          },
        },
        {
          college_id: 'cc:2', community_college_id: 2, college_name: 'Beta College',
          types: {
            ast: { status: 'data_gap', record_id: null, inventory_titles: [] },
            local_as: { status: 'confirmed_none', record_id: null, inventory_titles: [] },
            local_other: { status: 'confirmed_none', record_id: null, inventory_titles: [] },
          },
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useAsDegrees: (...args) => useAsDegreesMock(...args),
}))

vi.mock('../DataReferences', () => ({
  DataTable: ({ rows, columns }) => (
    <div>
      {rows.map((row) => (
        <div key={row._id || row.college_id}>
          {columns.map((column) => (
            <div key={column.key}>{column.render ? column.render(row) : row[column.key]}</div>
          ))}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('./AsDegreeSchoolView', () => ({
  default: ({ collegeId, initialDegreeType }) => (
    <div>Degree detail {collegeId} {initialDegreeType}</div>
  ),
}))

describe('AsDegreesTab', () => {
  it('shows statewide coverage and preserves the selected type when inspecting a college', async () => {
    const onRoute = vi.fn()
    render(<AsDegreesTab onRoute={onRoute} />)

    expect(screen.getByText('A.S.-T analyzable')).toBeInTheDocument()
    expect(screen.getByText('Alpha College')).toBeInTheDocument()
    expect(screen.getByText('Beta College')).toBeInTheDocument()
    expect(screen.getByText('Data gap')).toBeInTheDocument()
    await waitFor(() => expect(onRoute).toHaveBeenCalledWith({
      path: '/api/curated/as-degree-availability',
    }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Inspect' })[0])
    expect(screen.getByText('Degree detail 1 ast')).toBeInTheDocument()
    await waitFor(() => expect(onRoute).toHaveBeenCalledWith({
      path: '/api/curated/as-degrees?college_id=cc:1',
    }))
  })

  it('defaults record QA to the server-filtered ast cohort and updates the route by type', async () => {
    const onRoute = vi.fn()
    render(<AsDegreesTab onRoute={onRoute} />)

    fireEvent.click(screen.getByRole('tab', { name: 'Degree records' }))
    expect(useAsDegreesMock).toHaveBeenCalledWith('ast')
    await waitFor(() => expect(onRoute).toHaveBeenCalledWith({
      path: '/api/curated/as-degrees?degree_type=ast',
    }))

    fireEvent.click(screen.getByRole('tab', { name: 'Local A.S.' }))
    expect(useAsDegreesMock).toHaveBeenLastCalledWith('local_as')
    await waitFor(() => expect(onRoute).toHaveBeenCalledWith({
      path: '/api/curated/as-degrees?degree_type=local_as',
    }))
  })
})
