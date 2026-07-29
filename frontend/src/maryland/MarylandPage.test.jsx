import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MarylandPage from './MarylandPage'

// The page's shape is what these tests pin: California's tab vocabulary
// (Overview / Community Colleges / Universities), the college-first drill-in,
// and the university rail. Data access is fully mocked.

vi.mock('./useMaryland', () => ({
  useMdSummary: () => ({ isPending: false, isError: false, data: {
    state: 'MD', colleges: 16, universities: 12, agreements: 9072, programs: 700,
    courses: 40000, sending_courses: 25000, receiving_courses: 15000,
    imported_at: '2026-07-20T00:00:00Z',
    validation: { skeleton_mismatches: 0 },
  } }),
  useMdInstitutions: (kind) => ({ isPending: false, isError: false, data: {
    rows: kind === 'university'
      ? [{ _id: 'md:uni:1', name: 'Towson University' }, { _id: 'md:uni:2', name: 'University of Maryland' }]
      : [{ _id: 'md:cc:1', name: 'Montgomery College' }],
  } }),
  useMdPrograms: () => ({ isPending: false, isError: false, data: {
    rows: [
      { university_id: 'md:uni:1', university_name: 'Towson University',
        major: 'Computer Science, B.S.', colleges: 14, effective: 'Fall 2026' },
    ],
  } }),
  useMdAgreements: () => ({ isPending: false, isError: false, data: { rows: [
    { _id: 'md:agr:1', major: 'Computer Science, B.S.', university_name: 'Towson University',
      missing: 3, binding: 1, complete_path_exists: false },
  ] } }),
  useMdAgreement: () => ({ isPending: false, isError: false, data: null }),
  useMdCollegeRollup: () => ({ isPending: false, isError: false, data: { rows: [
    { college_id: 'md:cc:1', college_name: 'Montgomery College', agreements: 620,
      complete: 400, complete_rate: 0.645, binding_rate: 0.21, missing_entry_rate: 0.8 },
  ] } }),
}))

// The rail is California's component; its own behavior is tested with DataPage.
vi.mock('../DataPage', () => ({
  InstitutionRail: ({ items, onSelect }) => (
    <ul>{items.map((i) => (
      <li key={i.id}><button type='button' onClick={() => onSelect(i.id)}>{i.name}</button></li>
    ))}</ul>
  ),
}))

vi.mock('@frontend/components/requirements/RequirementsLedger', () => ({
  default: () => <div data-testid='ledger' />,
}))

describe('Maryland console, in California&apos;s organization', () => {
  it('carries the California tab vocabulary', () => {
    render(<MarylandPage />)
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Community Colleges' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Universities' })).toBeInTheDocument()
    // Tabs Maryland cannot back are absent, not stubbed.
    expect(screen.queryByRole('tab', { name: 'Prerequisites' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Districts' })).not.toBeInTheDocument()
  })

  it('opens on the overview with the corpus stat strip and university landscape', () => {
    render(<MarylandPage />)
    expect(screen.getByText('Agreements')).toBeInTheDocument()
    expect(screen.getByText('9,072')).toBeInTheDocument()
    expect(screen.getByText(/separate corpus/)).toBeInTheDocument()
    // The explainer/validation panels are gone; the landscape reports what the
    // corpus holds per receiving university.
    expect(screen.queryByText('What one agreement is')).not.toBeInTheDocument()
    expect(screen.queryByText('Import validation')).not.toBeInTheDocument()
    expect(screen.getByText('Programs on file, by receiving university')).toBeInTheDocument()
    expect(screen.getByText('Towson University')).toBeInTheDocument()
    expect(screen.getByText('programs')).toBeInTheDocument()
  })

  it('Community Colleges lands on the college list and drills into a college', () => {
    render(<MarylandPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Community Colleges' }))
    // Landing: per-college engine-verdict rates.
    expect(screen.getByText('Montgomery College')).toBeInTheDocument()
    expect(screen.getByText('64.5%')).toBeInTheDocument()
    // Drill in: back affordance and the receiving-university bubbles.
    fireEvent.click(screen.getByText('Montgomery College'))
    expect(screen.getByRole('button', { name: /All colleges/ })).toBeInTheDocument()
    expect(screen.getByText('Receiving university')).toBeInTheDocument()
    // Opening a college starts on the first university, already selected.
    expect(screen.getByRole('button', { name: 'Towson University' }))
      .toHaveAttribute('aria-pressed', 'true')
    // The agreements master-detail list is present, and the status filter
    // offers only the two kept states.
    expect(screen.getByText('1 agreement')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Complete path' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Has blocking gaps' })).not.toBeInTheDocument()
  })

  it('Universities shows the rail and per-university programs', () => {
    render(<MarylandPage />)
    fireEvent.click(screen.getByRole('tab', { name: 'Universities' }))
    expect(screen.getByText('Choose a university')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Towson University' }))
    expect(screen.getByText('Computer Science, B.S.')).toBeInTheDocument()
    expect(screen.getByText('Colleges with a guide')).toBeInTheDocument()
  })
})
