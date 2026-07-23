import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AiAssistPanel, { _errorMessage } from './AiAssistPanel'

const mocks = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('../../shared/api/apiClient', () => ({
  default: { post: mocks.post },
}))

const current = {
  _id: 'as_degree:110:ast',
  degree_title_seen: 'Computer Science A.S.-T.',
  requirement_groups: [{
    group_id: 'core', label_seen: 'Core', source: 'extracted', confidence: 0.8,
    sections: [],
  }],
}

beforeEach(() => mocks.post.mockReset())

describe('AiAssistPanel', () => {
  it('shows a reviewable diff and approves through the editor save callback', async () => {
    const proposed = {
      ...current,
      requirement_groups: [{
        ...current.requirement_groups[0],
        label_seen: 'Required core', source: 'curated', confidence: null,
      }],
    }
    mocks.post.mockResolvedValue({
      data: {
        proposed_doc: proposed,
        changes: [{ group_id: 'core', kind: 'edit', summary: 'Renamed the core group.' }],
      },
    })
    const onApprove = vi.fn().mockResolvedValue(undefined)
    render(<AiAssistPanel doc={current} onApprove={onApprove} />)

    fireEvent.change(screen.getByLabelText('Describe the correction'), {
      target: { value: 'Rename the core group.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Propose changes' }))

    expect(await screen.findByText('Renamed the core group.')).toBeInTheDocument()
    expect(screen.getByText('Changed group')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Approve and save' }))

    await waitFor(() => expect(onApprove).toHaveBeenCalledTimes(1))
    expect(onApprove.mock.calls[0][0].requirement_groups[0]).toMatchObject({
      source: 'curated',
      confidence: null,
      curated_via: 'ai_assist',
      curated_by: null,
    })
  })

  it('explains when the server has no AI key configured', () => {
    const unavailable = {
      response: { status: 503, data: { error: 'ai_assist_unavailable' } },
    }
    expect(_errorMessage(unavailable)).toMatch(/AI assist is not configured/i)
  })

  it('blocks approval if the structured editor changed after proposing', async () => {
    const proposed = {
      ...current,
      requirement_groups: [{ ...current.requirement_groups[0], label_seen: 'Required core', source: 'curated', confidence: null }],
    }
    mocks.post.mockResolvedValue({ data: { proposed_doc: proposed, changes: [] } })
    const onApprove = vi.fn()
    const { rerender } = render(<AiAssistPanel doc={current} onApprove={onApprove} />)
    fireEvent.change(screen.getByLabelText('Describe the correction'), {
      target: { value: 'Rename the group.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Propose changes' }))
    await screen.findByText('Review before saving')

    rerender(<AiAssistPanel doc={{ ...current, degree_title_seen: 'Locally changed' }} onApprove={onApprove} />)

    expect(screen.getByText(/document changed after this proposal was created/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve and save' })).toBeDisabled()
    expect(onApprove).not.toHaveBeenCalled()
  })

  it('does not allow an empty proposal to be approved', async () => {
    mocks.post.mockResolvedValue({ data: { proposed_doc: current, changes: [] } })
    const onApprove = vi.fn()
    render(<AiAssistPanel doc={current} onApprove={onApprove} />)
    fireEvent.change(screen.getByLabelText('Describe the correction'), {
      target: { value: 'Inspect this record.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Propose changes' }))

    expect(await screen.findByText(/does not change the current document/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve and save' })).toBeDisabled()
  })

  it('blocks approval while the parent editor has unsaved manual work', async () => {
    const proposed = {
      ...current,
      requirement_groups: [{ ...current.requirement_groups[0], label_seen: 'Required core' }],
    }
    mocks.post.mockResolvedValue({ data: { proposed_doc: proposed, changes: [] } })
    const onApprove = vi.fn()
    const { rerender } = render(<AiAssistPanel doc={current} onApprove={onApprove} />)
    fireEvent.change(screen.getByLabelText('Describe the correction'), {
      target: { value: 'Rename the group.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Propose changes' }))
    await screen.findByText('Review before saving')

    rerender(
      <AiAssistPanel
        doc={current}
        onApprove={onApprove}
        disabled
        disabledReason='Save manual changes first.'
      />,
    )

    expect(screen.getByText('Save manual changes first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve and save' })).toBeDisabled()
  })

  it('shows group movement positions in a reorder proposal', async () => {
    const second = { group_id: 'math', label_seen: 'Math', source: 'extracted', confidence: 0.7, sections: [] }
    const base = { ...current, requirement_groups: [current.requirement_groups[0], second] }
    const proposed = {
      ...base,
      requirement_groups: [
        { ...second, source: 'curated', confidence: null },
        { ...current.requirement_groups[0], source: 'curated', confidence: null },
      ],
    }
    mocks.post.mockResolvedValue({ data: { proposed_doc: proposed, changes: [] } })
    render(<AiAssistPanel doc={base} onApprove={() => {}} />)
    fireEvent.change(screen.getByLabelText('Describe the correction'), {
      target: { value: 'Put math first.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Propose changes' }))

    expect(await screen.findByText('Position 2 → 1')).toBeInTheDocument()
    expect(screen.getByText('Position 1 → 2')).toBeInTheDocument()
  })

  it('rejects a response that changes human verification fields', async () => {
    const base = {
      ...current,
      verification: { verified: false, verified_by: null, verified_at: null, notes: 'Human note' },
    }
    mocks.post.mockResolvedValue({
      data: {
        proposed_doc: {
          ...base,
          verification: { ...base.verification, verified: true, verified_by: 'ai' },
        },
        changes: [],
      },
    })
    render(<AiAssistPanel doc={base} onApprove={() => {}} />)
    fireEvent.change(screen.getByLabelText('Describe the correction'), {
      target: { value: 'Mark it verified.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Propose changes' }))

    expect(await screen.findByText(/protected verification change/i)).toBeInTheDocument()
    expect(screen.queryByText('Review before saving')).not.toBeInTheDocument()
  })
})
