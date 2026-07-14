import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Task 9 — Judge dock + shortcuts. Renders the exported JudgeTab directly with
// the audit query hooks mocked (idiom from App.chrome.test.jsx): a single
// template variant + its doc so the ledger + verdict dock render, plus a
// mutateAsync spy standing in for useVerifyDoc.

const h = vi.hoisted(() => {
  const TEMPLATES = [{
    system: 'uc', school_id: 's1', major: 'Test Major, B.S.', fp_hash: 'h1',
    n_docs: 5, result: null, sample_doc_id: 'doc1',
  }]
  const DOC_RESULT = {
    doc: {
      _id: 'doc1', major: 'Test Major, B.S.', school: 'UC Test', community_college: 'Test College',
      requirement_groups: [{
        is_required: true,
        sections: [{ receivers: [
          { receiving: { kind: 'course', parent_id: 1 }, articulation_status: 'articulated', options: [{ course_ids: [10] }] },
        ] }],
      }],
    },
    course_names: { 10: { code: 'CC 100', title: 'Intro', units: 3 } },
    university_courses: { 1: { prefix: 'UNI', number: '1', title: 'Req One', min_units: 4, max_units: 4 } },
    assist_url: undefined,
  }
  return {
    TEMPLATES, DOC_RESULT,
    // isPending flag the mocked useVerifyDoc reads. Tests that need an in-flight
    // submit flip it true from inside a hanging mutateAsync.
    state: { pending: false },
    // Per-test override of the template list (reset to TEMPLATES each test).
    variants: TEMPLATES,
    mutateAsyncSpy: vi.fn().mockResolvedValue({}),
  }
})

vi.mock('@frontend/lib/firebase', () => ({ auth: {} }))
vi.mock('@frontend/hooks/useAuth', () => ({
  useAuth: () => ({ user: { email: 'a@b.edu', uid: 'u1' }, loading: false }),
}))
vi.mock('@frontend/query/hooks/useAccess', () => ({
  useAccessMe: () => ({ data: { role: 'admin' }, isPending: false, isError: false }),
  useRequestAccess: () => ({ mutate: vi.fn(), data: undefined }),
}))
vi.mock('@frontend/query/hooks/useAudit', () => ({
  useAuditBootstrap: () => ({ data: undefined, isLoading: false }),
  useAuditNext: () => ({ data: undefined, isLoading: false, isError: false }),
  useVerifyDoc: () => ({ mutateAsync: h.mutateAsyncSpy, isPending: h.state.pending }),
  useAuditTemplateVariants: () => ({ data: h.variants, isLoading: false, isError: false }),
  useAuditDoc: () => ({ data: h.DOC_RESULT, isLoading: false, isError: false }),
  filterToParams: (f) => f,
}))
// Stub the sibling page modules (imported by App.jsx) so this file only pulls
// in JudgeTab, mirroring App.chrome.test.jsx.
vi.mock('./DataPage', () => ({ default: () => null }))
vi.mock('./visuals/VisualsPage', () => ({ default: () => null }))
vi.mock('./DataApiDocs', () => ({ default: () => null }))
vi.mock('./tasks/TasksPage', () => ({ default: () => null }))
vi.mock('./AdminPage', () => ({ default: () => null }))

import { JudgeTab } from './App'

const FILTER = { scope: 'all', schoolIds: [], majorContains: '', groupingId: null }

function renderJudge(props = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <JudgeTab filter={FILTER} setFilter={() => {}} mode='template' setMode={() => {}} {...props} />
    </QueryClientProvider>
  )
}

describe('JudgeTab — dock + keyboard', () => {
  beforeEach(() => {
    h.mutateAsyncSpy.mockReset()
    h.mutateAsyncSpy.mockResolvedValue({})
    h.state.pending = false
    h.variants = h.TEMPLATES
  })

  it("(a) pressing 'e' submits with result:'error'", async () => {
    renderJudge()
    // sanity: the doc rendered
    expect(screen.getByText('Test Major, B.S.')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'e' })
    await waitFor(() => expect(h.mutateAsyncSpy).toHaveBeenCalled())
    expect(h.mutateAsyncSpy).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'error', doc_id: 'doc1' })
    )
  })

  it('(b) clicking a ledger row shows the marked count in the dock', () => {
    renderJudge()
    expect(screen.getByText('0 cells in error')).toBeInTheDocument()
    fireEvent.click(screen.getByText('UNI 1'))
    expect(screen.getByText('1 cells in error')).toBeInTheDocument()
  })

  it('(c) typing in the notes input suppresses shortcuts', () => {
    renderJudge()
    const notes = document.querySelector('[data-flag-notes]')
    fireEvent.change(notes, { target: { value: 'looks off' } })
    fireEvent.keyDown(notes, { key: 'c' })
    expect(h.mutateAsyncSpy).not.toHaveBeenCalled()
  })

  // Fix wave 1 — regressions caught in review.

  it('(d) ignores shortcuts when active is false (hidden sub-tab)', async () => {
    renderJudge({ active: false })
    // JudgeTab still renders while hidden; only its shortcuts must stay dormant.
    expect(screen.getByText('Test Major, B.S.')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'e' })
    await Promise.resolve()
    expect(h.mutateAsyncSpy).not.toHaveBeenCalled()
  })

  it('(e) does not double-submit while a verdict is in flight', async () => {
    // Hang the mutation and flip isPending so the dock's disabled guard engages.
    h.mutateAsyncSpy.mockImplementation(() => { h.state.pending = true; return new Promise(() => {}) })
    renderJudge()
    fireEvent.keyDown(document.body, { key: 'c' })
    await waitFor(() => expect(h.mutateAsyncSpy).toHaveBeenCalledTimes(1))
    fireEvent.keyDown(document.body, { key: 'c' })
    expect(h.mutateAsyncSpy).toHaveBeenCalledTimes(1)
  })

  it('(f) session caption never shows a negative done count', () => {
    // One n_docs:0 unresulted template pushed `left` past `total` before the fix
    // (done = 1 − 2 = −1); both counts now share the n_docs>0 population.
    h.variants = [
      { system: 'uc', school_id: 's0', major: 'Zero Major, B.S.', fp_hash: 'h0', n_docs: 0, result: null, sample_doc_id: 'docZero' },
      ...h.TEMPLATES,
    ]
    renderJudge()
    expect(screen.getByText(/Doc 0 of 1/)).toBeInTheDocument()
    expect(screen.queryByText(/Doc -1/)).toBeNull()
  })

  it('(g) shows the pending selection ring on the in-flight verdict pill', async () => {
    h.mutateAsyncSpy.mockImplementation(() => { h.state.pending = true; return new Promise(() => {}) })
    renderJudge()
    fireEvent.keyDown(document.body, { key: 'c' })
    await waitFor(() => expect(h.mutateAsyncSpy).toHaveBeenCalled())
    expect(screen.getByText('Correct').getAttribute('style') || '').toContain('var(--color-primary-ring)')
    // a verdict that wasn't submitted carries no ring
    expect(screen.getByText('Error').getAttribute('style') || '').not.toContain('var(--color-primary-ring)')
  })

  it('(h) gives every verdict an explicit, tone-specific hover and focus state', () => {
    renderJudge()
    const correct = screen.getByRole('button', { name: 'Correct' })
    const conservative = screen.getByRole('button', { name: 'Conservative' })
    const error = screen.getByRole('button', { name: 'Error' })
    const flag = screen.getByRole('button', { name: 'Flag' })

    expect(correct.className).toContain('hover:bg-primary-hover')
    expect(conservative.className).toContain('hover:bg-conservative-hover')
    expect(error.className).toContain('hover:bg-danger-hover')
    expect(flag.className).toContain('hover:bg-primary-soft')
    expect(flag.className).toContain('hover:border-primary')

    for (const button of [correct, conservative, error, flag]) {
      expect(button.className).toContain('focus-visible:ring-primary-ring')
      expect(button.className).toContain('active:translate-y-px')
    }
  })
})
