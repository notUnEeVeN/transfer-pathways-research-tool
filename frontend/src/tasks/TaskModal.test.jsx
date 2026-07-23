import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskModal from './TaskModal'

window.scrollTo = vi.fn()

vi.mock('@frontend/query/hooks/useData', () => ({
  useSchools: () => ({ data: { uc: [{ id: 7, name: 'UC Davis' }] }, isLoading: false }),
  useColleges: () => ({ data: [{ id: 4, name: 'Sacramento City College' }], isLoading: false }),
}))

const baseProps = (onCreate) => ({
  open: true,
  onClose: vi.fn(),
  roster: [],
  onCreate,
  onPatch: vi.fn(),
  onAddStageNote: vi.fn(),
  onCompleteStage: vi.fn(),
  onReopenStage: vi.fn(),
  onDeleteStageNote: vi.fn(),
  onResolveStageNote: vi.fn(),
  onDelete: vi.fn(),
  me: { uid: 'uid-1' },
})

describe('TaskModal presets and general tasks', () => {
  it('keeps the task type locked for a completed bare general task', () => {
    render(<TaskModal {...baseProps(vi.fn())} task={{
      _id: 'done-general',
      title: 'Write results section',
      description: '',
      task_type: 'general',
      status: 'done',
      progress: 0,
      checklist_items: [],
      workflow_stages: {},
      workflow_log: [],
      notes: [],
      archived: false,
      created_at: '2026-07-20T12:00:00.000Z',
      updated_at: '2026-07-20T12:00:00.000Z',
    }} />)

    expect(screen.getByRole('button', { name: 'General' })).toBeDisabled()
    expect(screen.getByText('General · Done')).toBeInTheDocument()
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument()
    expect(screen.getByText(/This simple task is done/)).toBeInTheDocument()
  })

  it('creates a bare general task without sending an empty checklist', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<TaskModal {...baseProps(onCreate)} />)

    fireEvent.click(screen.getByRole('button', { name: /Custom \(blank\)/ }))
    expect(screen.getByLabelText('Title')).toHaveFocus()
    expect(screen.getByRole('textbox', { name: 'New task checkpoint' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Write results section' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Write results section',
      task_type: 'general',
    }))
    expect(onCreate.mock.calls[0][0]).not.toHaveProperty('checklist_items')
  })

  it('creates one broad data-validation task with selected schools as checkpoints', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<TaskModal {...baseProps(onCreate)} />)

    fireEvent.click(screen.getByRole('button', { name: /Data validation/ }))
    expect(screen.getByLabelText('Title')).toHaveValue('Data validation — <scope>')
    expect(screen.getByLabelText('Title')).toHaveFocus()

    const checkpoint = screen.getByRole('combobox', { name: 'New verification checkpoint' })
    expect(checkpoint).toHaveAttribute('list', 'task-school-options')
    expect(document.querySelector('option[value="UC Davis"]')).toBeInTheDocument()
    expect(document.querySelector('option[value="Sacramento City College"]')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'One per UC campus' }))
    fireEvent.change(checkpoint, { target: { value: 'UC Davis' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.change(checkpoint, { target: { value: 'Sacramento City College' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    fireEvent.click(screen.getByRole('button', { name: 'Create task' }))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({
      task_type: 'data_verification',
      checklist_items: ['UC Davis', 'Sacramento City College'],
    }))
  })

  it('requires at least one school or checkpoint for data validation', () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<TaskModal {...baseProps(onCreate)} />)

    fireEvent.click(screen.getByRole('button', { name: /Data validation/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }))

    expect(onCreate).not.toHaveBeenCalled()
    expect(screen.getAllByText('Add at least one checkpoint.').length).toBeGreaterThan(0)
  })

  it('starts a porting task without sending checklist items', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<TaskModal {...baseProps(onCreate)} />)

    fireEvent.click(screen.getByRole('button', { name: /^Porting/ }))
    expect(screen.getByLabelText('Title')).toHaveValue('Port visual — <name>')
    expect(screen.getByText('7 stages')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Create task' }))

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    expect(onCreate.mock.calls[0][0]).toEqual(expect.objectContaining({ task_type: 'porting' }))
    expect(onCreate.mock.calls[0][0]).not.toHaveProperty('checklist_items')
  })

  it('keeps school suggestions available when adding to an existing validation task', () => {
    render(<TaskModal {...baseProps(vi.fn())} task={{
      _id: 'validation-task',
      title: 'Validate selected schools',
      description: '',
      task_type: 'data_verification',
      status: 'in_progress',
      progress: 0,
      checklist_items: [{ key: 'uc_davis', label: 'UC Davis' }],
      workflow_stages: {},
      workflow_log: [],
      notes: [],
      archived: false,
      created_at: '2026-07-20T12:00:00.000Z',
      updated_at: '2026-07-20T12:00:00.000Z',
    }} />)

    const checkpoint = screen.getByRole('combobox', { name: 'New verification checkpoint' })
    expect(checkpoint).toHaveAttribute('list', 'verification-school-options')
    expect(document.querySelector('option[value="Sacramento City College"]')).toBeInTheDocument()
  })
})
