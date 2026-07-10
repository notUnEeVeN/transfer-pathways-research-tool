import React, { useMemo, useState } from 'react'
import { TrashIcon, XMarkIcon, ArchiveBoxIcon, ArchiveBoxXMarkIcon } from '@heroicons/react/24/outline'
import {
  Modal, Input, Textarea, Select, Combobox, Button, IconButton, Divider,
} from '../components/ui'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
]

const fmtWhen = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

/**
 * TaskModal — create + edit in one. Local draft for the fields, one Save press
 * builds the patch; notes post immediately (they're a running conversation, not
 * a draft). Everyone can edit everything (the 3-person-team decision), with
 * who/when stamped server-side.
 */
export default function TaskModal({
  open, onClose, task = null, initialStatus = 'todo', roster = [],
  onCreate, onPatch, onDelete, me,
}) {
  const editing = !!task
  const [draft, setDraft] = useState(() => ({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || initialStatus,
    assignee_uid: task?.assignee_uid || '',
    progress: task?.progress ?? 0,
  }))
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const rosterOptions = useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...roster.map((r) => ({ value: r.uid, label: r.label }))],
    [roster]
  )
  const notes = task?.notes || []

  const save = async () => {
    if (!draft.title.trim()) { setError('A title is required.'); return }
    const body = {
      title: draft.title.trim(),
      description: draft.description,
      status: draft.status,
      progress: Number(draft.progress) || 0,
      assignee_uid: draft.assignee_uid || null,
      assignee_label: roster.find((r) => r.uid === draft.assignee_uid)?.label || null,
    }
    try {
      if (editing) await onPatch(task._id, body)
      else await onCreate(body)
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save the task.')
    }
  }

  const postNote = async () => {
    const text = note.trim()
    if (!text || !editing) return
    const next = [...notes, { uid: me?.uid, label: me?.email, text, at: new Date().toISOString() }]
    await onPatch(task._id, { notes: next })
    setNote('')
  }
  const deleteNote = async (i) => onPatch(task._id, { notes: notes.filter((_, j) => j !== i) })

  return (
    <Modal
      open={open}
      onClose={onClose}
      size='lg'
      title={editing ? 'Edit task' : 'New task'}
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
      <div className='space-y-4'>
        <Input label='Title' value={draft.title} onChange={(e) => set({ title: e.target.value })}
          placeholder='e.g. Recreate MA Fig 3 — transfer credit rate'
          error={error && !draft.title.trim() ? error : undefined} />
        <Textarea label='Description' value={draft.description} onChange={(e) => set({ description: e.target.value })}
          rows={3} placeholder='What does done look like?' />

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
          <div>
            <p className='field-label'>Status</p>
            <Select value={draft.status} onChange={(v) => set({ status: v })} options={STATUS_OPTIONS} />
          </div>
          <div>
            <p className='field-label'>Assignee</p>
            <Combobox value={draft.assignee_uid} onChange={(v) => set({ assignee_uid: v })} options={rosterOptions} placeholder='Unassigned' />
          </div>
        </div>

        <div>
          <div className='flex items-center justify-between'>
            <p className='field-label'>Progress</p>
            <span className='text-caption text-ink-subtle tabular-nums'>{draft.progress}%</span>
          </div>
          <input
            type='range' min={0} max={100} step={5} value={draft.progress}
            onChange={(e) => set({ progress: Number(e.target.value) })}
            aria-label='Progress percent'
            className='w-full accent-[var(--color-primary)] cursor-pointer'
          />
        </div>

        {error && <p className='text-caption text-danger'>{error}</p>}

        <div className='flex items-center justify-end gap-2'>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{editing ? 'Save' : 'Create task'}</Button>
        </div>

        {editing && (
          <>
            <Divider />
            <div>
              <p className='field-label'>Notes</p>
              <p className='text-caption text-ink-subtle -mt-1 mb-2'>
                Leave tips for whoever picks this up — how you'd approach it, gotchas, links.
              </p>
              <div className='space-y-3'>
                {notes.map((n, i) => (
                  <div key={i} className='flex items-start gap-2 group'>
                    <UserInitialsAvatar email={n.label || n.uid} size='sm' className='!w-[24px] !h-[24px] mt-0.5' />
                    <div className='min-w-0 flex-1'>
                      <p className='text-tag text-ink-subtle'>{n.label || n.uid} · {fmtWhen(n.at)}</p>
                      <p className='text-body whitespace-pre-wrap break-words'>{n.text}</p>
                    </div>
                    <IconButton icon={XMarkIcon} label='Delete note' size='sm'
                      className='opacity-0 group-hover:opacity-100 transition-opacity'
                      onClick={() => deleteNote(i)} />
                  </div>
                ))}
                {notes.length === 0 && <p className='text-caption text-ink-subtle'>No notes yet.</p>}
                <div className='flex items-end gap-2'>
                  <div className='flex-1'>
                    <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                      placeholder='Add a note…' />
                  </div>
                  <Button variant='secondary' onClick={postNote} disabled={!note.trim()}>Post</Button>
                </div>
              </div>
              <p className='text-tag text-ink-subtle mt-3'>
                Created {fmtWhen(task.created_at)}
                {task.completed_at ? ` — completed ${fmtWhen(task.completed_at)}` : ''}
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
