import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import VerificationQueue from './VerificationQueue'
import { PORTING_STAGES } from './taskWorkflow'

const complete = (keys) => Object.fromEntries(keys.map((key) => [key, { completed: true }]))
const preApproval = PORTING_STAGES.slice(0, -1).map((s) => s.key)

const task = (over) => ({
  _id: 'x', title: 'A task', task_type: 'porting', status: 'in_progress',
  workflow_stages: {}, workflow_log: [], archived: false, updated_at: new Date(0).toISOString(), ...over,
})

// Awaiting team approval (everything before the peer step is done).
const awaitingA = task({ _id: 'a', title: 'Alpha', workflow_stages: complete(preApproval) })
const awaitingB = task({ _id: 'b', title: 'Beta', workflow_stages: complete(preApproval) })
// Mid-flow: not awaiting verification, must be filtered out.
const midFlow = task({ _id: 'm', title: 'Mid', workflow_stages: complete(['understand', 'research']) })

describe('VerificationQueue', () => {
  it('lists only tasks awaiting verification', () => {
    render(<VerificationQueue tasks={[awaitingA, awaitingB, midFlow]} />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Mid')).not.toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument() // the count chip
  })

  it('shows an empty state when nothing awaits verification', () => {
    render(<VerificationQueue tasks={[midFlow]} />)
    expect(screen.getByText('Nothing awaiting verification')).toBeInTheDocument()
  })

  it('approves one task via its row action', () => {
    const onApprove = vi.fn()
    render(<VerificationQueue tasks={[awaitingA]} onApprove={onApprove} />)
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ _id: 'a' }))
  })

  it('sends the selected rows to a batch approve', () => {
    const onApproveMany = vi.fn(() => Promise.resolve())
    render(<VerificationQueue tasks={[awaitingA, awaitingB]} onApproveMany={onApproveMany} />)
    fireEvent.click(screen.getByLabelText('Select all'))
    fireEvent.click(screen.getByRole('button', { name: /Approve 2/ }))
    expect(onApproveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ _id: 'a' }),
        expect.objectContaining({ _id: 'b' }),
      ])
    )
  })

  it('routes "needs work" to the task rather than approving it', () => {
    const onNeedsWork = vi.fn()
    const onApprove = vi.fn()
    render(<VerificationQueue tasks={[awaitingA]} onNeedsWork={onNeedsWork} onApprove={onApprove} />)
    const row = screen.getByText('Alpha').closest('tr')
    fireEvent.click(within(row).getByRole('button', { name: 'Needs work' }))
    expect(onNeedsWork).toHaveBeenCalledWith(expect.objectContaining({ _id: 'a' }))
    expect(onApprove).not.toHaveBeenCalled()
  })
})
