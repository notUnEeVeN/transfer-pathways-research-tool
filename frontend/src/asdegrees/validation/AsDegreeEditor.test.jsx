import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AsDegreeEditor from './AsDegreeEditor'

const mocks = vi.hoisted(() => ({
  detail: null,
  detailError: null,
  coursesError: null,
  save: vi.fn(),
  refetch: vi.fn(),
  invalidate: vi.fn(),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal()),
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}))

vi.mock('../../shared/query/hooks/useData', () => ({
  useAsDegreeDetail: () => ({
    data: mocks.detail,
    isLoading: false,
    isError: Boolean(mocks.detailError),
    error: mocks.detailError,
    refetch: mocks.refetch,
  }),
  useSaveAsDegree: () => ({ mutateAsync: mocks.save, isPending: false }),
  useCcCourses: () => ({
    data: [
      { _id: 'cc:101', course_id: 101, prefix: 'CS', number: '101', title: 'Programming I', units: 4 },
      { _id: 'cc:102', course_id: 102, prefix: 'CS', number: '102', title: 'Programming II', units: 4 },
    ],
    isLoading: false,
    isError: Boolean(mocks.coursesError),
    error: mocks.coursesError,
  }),
}))

vi.mock('../../shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'partner-1' } }),
}))

vi.mock('./AiAssistPanel', () => ({
  default: () => <div>AI assist placeholder</div>,
}))

const validDoc = () => ({
  _id: 'as_degree:110:ast',
  legacy_id: '110:ast',
  kind: 'as_degree',
  community_college_id: 110,
  college_id: 'cc:110',
  degree_type: 'ast',
  major_slug: 'cs',
  template_ref: null,
  status: 'found',
  degree_title_seen: 'Computer Science, A.S.-T.',
  catalog_url: 'https://catalog.example.edu/cs-ast',
  catalog_year: '2025-2026',
  unit_system: 'semester',
  total_units: 60,
  verification: { verified: false, verified_by: null, verified_at: null, notes: null },
  updated_at: '2026-07-22T10:00:00.000Z',
  requirement_groups: [{
    group_id: 'core',
    template_group: 'core',
    label_seen: 'Required core',
    source: 'extracted',
    confidence: 0.88,
    ge_area: null,
    units_fill: false,
    unresolved_courses_seen: [],
    sections: [{
      section_advisement: null,
      unit_advisement: null,
      receivers: [{
        receiving: null,
        articulation_status: 'articulated',
        options_conjunction: 'and',
        options: [{ course_ids: [101], course_keys: ['cc:101'], course_conjunction: 'and' }],
      }],
    }],
  }],
})

function detailFor(doc = validDoc()) {
  return {
    college_name: 'Alpha College',
    degrees: [{ degree_type: 'ast', doc, courses_by_id: {} }],
  }
}

beforeEach(() => {
  window.scrollTo = vi.fn()
  window.confirm = vi.fn(() => true)
  mocks.detail = detailFor()
  mocks.detailError = null
  mocks.coursesError = null
  mocks.save.mockReset()
  mocks.save.mockResolvedValue({ ok: true })
  mocks.refetch.mockReset()
  mocks.refetch.mockImplementation(async () => ({ data: mocks.detail, isError: false }))
  mocks.invalidate.mockReset()
  mocks.invalidate.mockResolvedValue(undefined)
})

describe('AsDegreeEditor', () => {
  it('saves group edits with curated provenance through the existing save hook', async () => {
    render(<AsDegreeEditor collegeId={110} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Group label core'), {
      target: { value: 'Programming core' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    const payload = mocks.save.mock.calls[0][0]
    expect(payload.requirement_groups[0]).toMatchObject({
      label_seen: 'Programming core',
      source: 'curated',
      confidence: null,
      curated_by: null,
    })
    expect(mocks.invalidate).toHaveBeenCalledWith({
      queryKey: ['as-degree-validation-cohort'],
    })
    const analysisInvalidation = mocks.invalidate.mock.calls
      .map(([options]) => options)
      .find((options) => typeof options.predicate === 'function')
    expect(analysisInvalidation.predicate({ queryKey: ['analysis-transfer-credit-rate'] })).toBe(true)
    expect(analysisInvalidation.predicate({ queryKey: ['as-degree-detail'] })).toBe(false)
  })

  it('warns instead of silently replacing dirty work when the server version changes', async () => {
    const { rerender } = render(<AsDegreeEditor collegeId={110} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Group label core'), {
      target: { value: 'Locally edited title' },
    })

    const changed = validDoc()
    changed.updated_at = '2026-07-22T11:00:00.000Z'
    changed.requirement_groups[0].label_seen = 'Someone else changed this'
    mocks.detail = detailFor(changed)
    rerender(<AsDegreeEditor collegeId={110} onClose={() => {}} />)

    expect(await screen.findByText(/newer version of this record is available/i)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Locally edited title')).toBeInTheDocument()
  })

  it('writes explicit verifier identity and preserves user-authored notes', async () => {
    render(<AsDegreeEditor collegeId={110} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Verified' }))
    fireEvent.change(screen.getByLabelText('Verification notes'), {
      target: { value: 'Checked against the live catalog.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0][0].verification).toMatchObject({
      verified: true,
      verified_by: 'partner-1',
      notes: 'Checked against the live catalog.',
    })
    expect(mocks.save.mock.calls[0][0].verification.verified_at).toEqual(expect.any(String))
  })

  it('refetches before save and blocks an overwrite when the server version is newer', async () => {
    const latest = validDoc()
    latest.updated_at = '2026-07-22T12:00:00.000Z'
    mocks.refetch.mockResolvedValue({ data: detailFor(latest) })
    render(<AsDegreeEditor collegeId={110} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Group label core'), {
      target: { value: 'My unsaved change' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/reload it before saving/i)).toBeInTheDocument()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('preserves evidence metadata when unresolved course codes are edited', async () => {
    const doc = validDoc()
    doc.requirement_groups[0].unresolved_courses_seen = [{
      course_code_seen: 'CS 099',
      source_page: 42,
      raw_text: 'CS-099 Introductory Topics',
    }]
    mocks.detail = detailFor(doc)
    render(<AsDegreeEditor collegeId={110} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Unresolved catalog course codes'), {
      target: { value: 'CS 099\nMATH 001' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0][0].requirement_groups[0].unresolved_courses_seen).toEqual([
      {
        course_code_seen: 'CS 099',
        source_page: 42,
        raw_text: 'CS-099 Introductory Topics',
      },
      { course_code_seen: 'MATH 001' },
    ])
  })

  it('guards closing the panel when there are unsaved changes', () => {
    const onClose = vi.fn()
    window.confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<AsDegreeEditor collegeId={110} onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('Degree title'), {
      target: { value: 'An unsaved title' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the group ID field mounted while normalizing the ID', () => {
    render(<AsDegreeEditor collegeId={110} onClose={() => {}} />)
    const input = screen.getByLabelText('Group ID core')
    input.focus()

    fireEvent.change(input, { target: { value: 'programming_' } })
    expect(screen.getByLabelText('Group ID programming_')).toBe(input)
    expect(input).toHaveFocus()

    fireEvent.change(input, { target: { value: 'Programming Core' } })
    expect(screen.getByLabelText('Group ID Programming Core')).toBe(input)
    expect(input).toHaveFocus()
    fireEvent.blur(input)

    expect(screen.getByLabelText('Group ID programming_core')).toBe(input)
  })

  it('renders a missing degree record as an actionable empty state', () => {
    mocks.detail = null
    mocks.detailError = { response: { status: 404, data: { error: 'not_found' } } }
    render(<AsDegreeEditor collegeId={999} onClose={() => {}} />)

    expect(screen.getByText('No AS-degree records for this college')).toBeInTheDocument()
    expect(screen.queryByText('not_found')).not.toBeInTheDocument()
  })

  it('blocks saving when the freshness check fails or the record disappeared', async () => {
    mocks.refetch.mockResolvedValueOnce({
      data: mocks.detail,
      isError: true,
      error: new Error('offline'),
    })
    render(<AsDegreeEditor collegeId={110} onClose={() => {}} />)
    fireEvent.change(screen.getByLabelText('Degree title'), {
      target: { value: 'A corrected title' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText(/could not confirm the latest server version/i)).toBeInTheDocument()
    expect(mocks.save).not.toHaveBeenCalled()

    mocks.refetch.mockResolvedValueOnce({ data: { ...mocks.detail, degrees: [] }, isError: false })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/record no longer exists on the server/i)).toBeInTheDocument()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('clears an old verification stamp after a structural edit', async () => {
    const doc = validDoc()
    doc.verification = {
      verified: true,
      verified_by: 'partner-2',
      verified_at: '2026-07-21T10:00:00.000Z',
      notes: 'Previously checked.',
    }
    mocks.detail = detailFor(doc)
    render(<AsDegreeEditor collegeId={110} onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('Group label core'), {
      target: { value: 'Corrected core' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1))
    expect(mocks.save.mock.calls[0][0].verification).toEqual({
      verified: false,
      verified_by: null,
      verified_at: null,
      notes: 'Previously checked.',
    })
  })

  it('requires confirmation before a units-fill toggle removes course sections', () => {
    window.confirm = vi.fn().mockReturnValue(false)
    render(<AsDegreeEditor collegeId={110} onClose={() => {}} />)

    fireEvent.click(screen.getByRole('switch', { name: 'Units-fill group' }))

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/removes all of its sections/i))
    expect(screen.getByText('Section 1')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Units-fill group' })).not.toBeChecked()
  })
})
