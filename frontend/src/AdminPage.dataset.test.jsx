import React from 'react'
import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const datasetQuery = vi.fn()

vi.mock('@frontend/query/hooks/useAccess', () => ({
  useAdminDataset: () => datasetQuery(),
  useAdminAccessList: vi.fn,
  useGrantAccess: vi.fn,
  useRevokeAccess: vi.fn,
  useAccessRequests: vi.fn,
  useBlockAccessRequest: vi.fn,
  useBlockedAccounts: vi.fn,
  useUnblockAccount: vi.fn,
  useVisualSettings: vi.fn,
  useSetPublishedVisuals: vi.fn,
  useSetHiddenVisuals: vi.fn,
  useTeam: vi.fn,
  useSetTeamName: vi.fn,
  useAuditPulse: vi.fn,
}))

vi.mock('./analyses/registry', () => ({ ANALYSES: [] }))

import { DatasetPanel } from './AdminPage'

function family(overrides = {}) {
  return {
    slug: 'cs',
    label: 'Computer Science',
    match: 'computer science',
    capabilities: { asDegrees: true, snapshots: ['transfer-pathways'] },
    category_count: 10,
    expected_programs: 9,
    available_programs: 9,
    agreement_count: 1035,
    programs: [{
      school_id: 79,
      school: 'UC Berkeley',
      source_program: 'Electrical Engineering & Computer Sciences, B.S.',
      available: true,
      agreements: 115,
      community_colleges: 115,
    }],
    ...overrides,
  }
}

function queryData(overrides = {}) {
  return {
    isLoading: false,
    isError: false,
    data: {
      meta: {
        updated_at: null,
        major_summary: {
          research_major_families: 3,
          configured_campus_programs: 27,
          available_campus_programs: 27,
          distinct_source_program_labels: 20,
          unmapped_campus_programs: 0,
        },
        major_families: [family()],
        unmapped_programs: [],
        collections: [{ name: 'assist_agreements', count: 3105 }],
        ...overrides,
      },
    },
  }
}

beforeEach(() => {
  datasetQuery.mockReset()
  datasetQuery.mockReturnValue(queryData())
})

describe('admin dataset major inventory', () => {
  it('distinguishes research majors, campus programs, and repeated source labels', () => {
    render(<DatasetPanel />)

    const labelsCard = screen.getByText('Distinct source labels').parentElement
    expect(within(labelsCard).getByText('20')).toBeInTheDocument()
    const programsCard = screen.getByText('Configured campus programs').parentElement
    expect(within(programsCard).getByText('27')).toBeInTheDocument()
    expect(screen.getByText(/Why 20 source labels can represent 27 programs/)).toBeInTheDocument()
    expect(screen.getByText('9 of 9 campus programs')).toBeInTheDocument()
    expect(screen.getByText('Electrical Engineering & Computer Sciences, B.S.')).toBeInTheDocument()
    expect(screen.getByText('Every imported campus program is mapped to a configured research major.')).toBeInTheDocument()
    expect(screen.getByText('assist_agreements')).toBeInTheDocument()
  })

  it('surfaces missing configured programs and newly imported unmapped programs', () => {
    datasetQuery.mockReturnValue(queryData({
      major_summary: {
        research_major_families: 3,
        configured_campus_programs: 27,
        available_campus_programs: 26,
        distinct_source_program_labels: 20,
        unmapped_campus_programs: 1,
      },
      major_families: [family({
        available_programs: 8,
        programs: [{
          school_id: 46,
          school: 'UC Riverside',
          source_program: 'Computer Science, B.S.',
          available: false,
          agreements: 0,
          community_colleges: 0,
        }],
      })],
      unmapped_programs: [{
        school_id: 79,
        school: 'UC Berkeley',
        source_program: 'Future Data Science, B.S.',
        agreements: 115,
        community_colleges: 115,
      }],
    }))

    render(<DatasetPanel />)

    expect(screen.getByText('8 of 9 campus programs')).toBeInTheDocument()
    expect(screen.getByText('Missing')).toBeInTheDocument()
    expect(screen.getByText('Future Data Science, B.S.')).toBeInTheDocument()
  })
})
