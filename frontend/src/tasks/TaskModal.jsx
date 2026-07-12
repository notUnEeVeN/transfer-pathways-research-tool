import React, { useMemo, useState } from 'react'
import {
  ArchiveBoxIcon, ArchiveBoxXMarkIcon, TrashIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Combobox, CompletionCheck, IconButton, Input, Modal, Select, Textarea,
} from '../components/ui'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import PortingWorkflow from './PortingWorkflow'
import { PORTING_STAGES, TASK_TYPE_OPTIONS, taskTypeLabel } from './taskWorkflow'

const OPEN_STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
]

const fmtWhen = (value) => (value
  ? new Date(value).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  : '')

export default function TaskModal({
  open, onClose, task = null, initialStatus = 'todo', roster = [],
  onCreate, onPatch, onAddStageNote, onCompleteStage, onReopenStage, onDelete, me,
}) {
  const editing = Boolean(task)
  const safeInitialStatus = initialStatus === 'done' ? 'todo' : initialStatus
  const [draft, setDraft] = useState(() => ({
    title: task?.title || '',
    description: task?.description || '',
    task_type: task?.task_type || 'porting',
    status: task?.status || safeInitialStatus,
    assignee_uid: task?.assignee_uid || '',
  }))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }))

  const rosterOptions = useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...roster.map((person) => ({ value: person.uid, label: person.label }))],
    [roster]
  )
  const notes = task?.notes || []
  const meLabel = roster.find((person) => person.uid === me?.uid)?.label || me?.displayName || me?.email || me?.uid

  const save = async () => {
    if (!draft.title.trim()) { setError('A title is required.'); return }
    const body = {
      title: draft.title.trim(),
      description: draft.description,
      task_type: draft.task_type,
      assignee_uid: draft.assignee_uid || null,
      assignee_label: roster.find((person) => person.uid === draft.assignee_uid)?.label || null,
    }
    if (!editing || task.status !== 'done') body.status = draft.status
    setSaving(true)
    setError(null)
    try {
      if (editing) await onPatch(task._id, body)
      else await onCreate(body)
      onClose()
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save the task.')
    } finally {
      setSaving(false)
    }
  }

  const postNote = async () => {
    const text = note.trim()
    if (!text || !editing) return
    await onPatch(task._id, {
      notes: [...notes, { uid: me?.uid, label: meLabel, text, at: new Date().toISOString() }],
    })
    setNote('')
  }

  const deleteNote = async (index) => onPatch(task._id, {
    notes: notes.filter((_, noteIndex) => noteIndex !== index),
  })

  const details = (
    <div className='space-y-4'>
      <Input label='Title' value={draft.title} onChange={(event) => set({ title: event.target.value })}
        placeholder='e.g. Recreate MA Fig 3 — transfer credit rate'
        error={error && !draft.title.trim() ? error : undefined} />
      <Textarea label='Description' value={draft.description}
        onChange={(event) => set({ description: event.target.value })}
        rows={3} placeholder='What does done look like?' />

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
        <div>
          <p className='field-label'>Task type</p>
          <Select value={draft.task_type} onChange={(value) => set({ task_type: value })}
            options={TASK_TYPE_OPTIONS} disabled={editing && (task?.progress || 0) > 0} />
        </div>
        <div>
          <p className='field-label'>Assignee</p>
          <Combobox value={draft.assignee_uid} onChange={(value) => set({ assignee_uid: value })}
            options={rosterOptions} placeholder='Unassigned' />
        </div>
      </div>

      <div>
        <p className='field-label'>Status</p>
        {editing && task.status === 'done' ? (
          <div className='input-field flex items-center gap-2 text-success'>
            <CompletionCheck size='sm' />
            <span>Done via team approval</span>
          </div>
        ) : (
          <Select value={draft.status} onChange={(value) => set({ status: value })} options={OPEN_STATUS_OPTIONS} />
        )}
      </div>

      {error && draft.title.trim() && <p className='text-caption text-danger'>{error}</p>}

      <div className='flex items-center justify-end gap-2'>
        <Button variant='ghost' onClick={onClose}>Cancel</Button>
        <Button onClick={save} loading={saving}>{editing ? 'Save details' : 'Create task'}</Button>
      </div>
    </div>
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={editing ? 'xl' : 'lg'}
      title={editing ? 'Task workflow' : 'New task'}
      subtitle={editing ? `${taskTypeLabel(task.task_type)} · ${task.progress || 0}% complete` : 'Porting'}
      actions={editing && (
        <span className='inline-flex items-center gap-1'>
          <IconButton
            icon={task.archived ? ArchiveBoxXMarkIcon : ArchiveBoxIcon}
            label={task.archived ? 'Unarchive task' : 'Archive task'}
            onClick={async () => { await onPatch(task._id, { archived: !task.archived }); onClose() }}
          />
          <IconButton icon={TrashIcon} label='Delete task' onClick={() => { onDelete(task); onClose() }} />
        </span>
      )}
    >
      {editing ? (
        <div className='grid grid-cols-1 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.35fr)] gap-6'>
          <div className='min-w-0'>
            <section aria-labelledby='task-details-title'>
              <div className='flex items-center justify-between gap-3 mb-4'>
                <h3 id='task-details-title' className='text-heading'>Task details</h3>
                <Badge variant='accent'>{taskTypeLabel(task.task_type)}</Badge>
              </div>
              {details}
            </section>

            <section className='mt-6 pt-5 border-t border-border' aria-labelledby='task-discussion-title'>
              <h3 id='task-discussion-title' className='text-body-strong'>General notes</h3>
              <div className='mt-3 space-y-3'>
                {notes.map((entry, index) => (
                  <div key={`${entry.at || 'note'}-${index}`} className='flex items-start gap-2 group'>
                    <UserInitialsAvatar email={entry.label || entry.uid} size='sm' className='!w-[24px] !h-[24px] mt-0.5' />
                    <div className='min-w-0 flex-1'>
                      <p className='text-tag text-ink-subtle'>{entry.label || entry.uid} · {fmtWhen(entry.at)}</p>
                      <p className='text-body whitespace-pre-wrap break-words'>{entry.text}</p>
                    </div>
                    <IconButton icon={XMarkIcon} label='Delete note' size='sm'
                      className='opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity'
                      onClick={() => deleteNote(index)} />
                  </div>
                ))}
                {notes.length === 0 && <p className='text-caption text-ink-subtle'>No general notes yet.</p>}
                <div className='flex items-end gap-2'>
                  <div className='flex-1'>
                    <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)}
                      placeholder='Add a general note…' />
                  </div>
                  <Button variant='secondary' onClick={postNote} disabled={!note.trim()}>Post</Button>
                </div>
              </div>
              <p className='text-tag text-ink-subtle mt-4'>
                Created {fmtWhen(task.created_at)}
                {task.completed_at ? ` · completed ${fmtWhen(task.completed_at)}` : ''}
              </p>
            </section>
          </div>

          <div className='min-w-0 lg:border-l lg:border-border lg:pl-6'>
            <PortingWorkflow task={task} me={me} roster={roster}
              onAddStageNote={onAddStageNote} onCompleteStage={onCompleteStage}
              onReopenStage={onReopenStage} />
          </div>
        </div>
      ) : (
        <div>
          {details}
          <section className='mt-6 pt-5 border-t border-border'>
            <div className='flex items-center justify-between gap-3'>
              <h3 className='text-body-strong'>Porting stages</h3>
              <span className='text-tag text-ink-subtle'>{PORTING_STAGES.length} stages</span>
            </div>
            <ol className='mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-5'>
              {PORTING_STAGES.map((stage, index) => (
                <li key={stage.key} className='flex items-center gap-2 py-2 border-t border-border first:border-t-0 sm:[&:nth-child(2)]:border-t-0'>
                  <span className='grid place-items-center w-5 h-5 rounded-full bg-surface-muted text-tag text-ink-subtle shrink-0'>{index + 1}</span>
                  <span className='text-caption text-ink-muted min-w-0 flex-1'>{stage.label}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Modal>
  )
}
