import React, { useMemo, useState } from 'react'
import {
  ArchiveBoxIcon, ArchiveBoxXMarkIcon, PlusIcon, TrashIcon, XMarkIcon,
} from '@heroicons/react/24/outline'
import {
  Badge, Button, Combobox, CompletionCheck, IconButton, Input, Modal, Select, Textarea,
} from '../components/ui'
import UserInitialsAvatar from '../components/display/UserInitialsAvatar'
import PortingWorkflow from './PortingWorkflow'
import VerificationChecklist from './VerificationChecklist'
import AuditFixInbox from './AuditFixInbox'
import {
  CREATABLE_TASK_TYPES, PORTING_STAGES, TASK_TYPE_OPTIONS, isChecklistTask,
  taskTypeBadgeVariant, taskTypeLabel,
} from './taskWorkflow'
import { useSchools } from '@frontend/query/hooks/useData'

const OPEN_STATUS_OPTIONS = [
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
  onCreate, onPatch, onAddStageNote, onCompleteStage, onReopenStage,
  onDeleteStageNote, onResolveStageNote, onDelete, me, admin = false,
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
  const [newItems, setNewItems] = useState([])
  const [itemDraft, setItemDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (patch) => setDraft((current) => ({ ...current, ...patch }))

  // Checklist types carry user-authored checkpoints; on create they're built
  // here (typed or quick-filled). Editing items later happens in the
  // verification panel, not here.
  const creatingChecklist = !editing && isChecklistTask({ task_type: draft.task_type })
  const schools = useSchools()
  const addDraftItem = () => {
    const label = itemDraft.trim()
    if (!label) return
    setNewItems((current) => [...current, label])
    setItemDraft('')
  }
  const prefillCampuses = () => {
    const names = (schools.data?.uc || []).map((row) => row.name).sort((a, b) => a.localeCompare(b))
    if (names.length) setNewItems(names)
  }

  const rosterOptions = useMemo(
    () => [{ value: '', label: 'Unassigned' }, ...roster.map((person) => ({ value: person.uid, label: person.label }))],
    [roster]
  )
  const notes = task?.notes || []
  const meLabel = roster.find((person) => person.uid === me?.uid)?.label || me?.displayName || me?.email || me?.uid

  const save = async () => {
    if (!draft.title.trim()) { setError('A title is required.'); return }
    if (creatingChecklist && !newItems.length) { setError('Add at least one checkpoint.'); return }
    const body = {
      title: draft.title.trim(),
      description: draft.description,
      task_type: draft.task_type,
      assignee_uid: draft.assignee_uid || null,
      assignee_label: roster.find((person) => person.uid === draft.assignee_uid)?.label || null,
    }
    if (creatingChecklist) body.checklist_items = newItems
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
          {editing ? (
            <Select value={draft.task_type} onChange={(value) => set({ task_type: value })}
              options={TASK_TYPE_OPTIONS}
              disabled={(task?.progress || 0) > 0 || task?.task_type === 'audit_fix'} />
          ) : (
            <div className='flex items-stretch gap-0.5 bg-surface-sunken rounded-pill p-[3px]'>
              {CREATABLE_TASK_TYPES.map((option) => {
                const active = draft.task_type === option.value
                return (
                  <button key={option.value} type='button'
                    onClick={() => set({ task_type: option.value })}
                    className={`flex-1 rounded-pill px-2.5 py-2 text-tag whitespace-nowrap cursor-pointer transition-colors ${
                      active ? 'bg-surface font-[650] shadow-xs' : 'text-ink-muted hover:text-ink'
                    }`}>
                    {option.label}
                  </button>
                )
              })}
            </div>
          )}
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
            <span>{isChecklistTask(task) ? 'Done — every item verified' : 'Done via team approval'}</span>
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
      subtitle={editing ? `${taskTypeLabel(task.task_type)} · ${task.progress || 0}% complete` : taskTypeLabel(draft.task_type)}
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
                <Badge variant={taskTypeBadgeVariant(task.task_type)}>{taskTypeLabel(task.task_type)}</Badge>
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
            {task.task_type === 'audit_fix' ? (
              <AuditFixInbox task={task} me={me}
                onCompleteStage={onCompleteStage} onReopenStage={onReopenStage} />
            ) : isChecklistTask(task) ? (
              <VerificationChecklist task={task} me={me} roster={roster}
                onCompleteStage={onCompleteStage} onReopenStage={onReopenStage}
                onAddStageNote={onAddStageNote} onDeleteStageNote={onDeleteStageNote}
                onPatch={onPatch} onClose={onClose} />
            ) : (
              <PortingWorkflow task={task} me={me} admin={admin} roster={roster}
                onAddStageNote={onAddStageNote} onCompleteStage={onCompleteStage}
                onReopenStage={onReopenStage} onDeleteStageNote={onDeleteStageNote}
                onResolveStageNote={onResolveStageNote} />
            )}
          </div>
        </div>
      ) : creatingChecklist ? (
        <div>
          {details}
          <section className='mt-6 pt-5 border-t border-border'>
            <div className='flex items-baseline justify-between gap-3'>
              <h3 className='text-body-strong'>Verification checkpoints</h3>
              <span className='text-tag text-ink-subtle'>
                {newItems.length === 1 ? '1 checkpoint' : `${newItems.length} checkpoints`}
              </span>
            </div>
            <p className='text-caption text-ink-subtle mt-2'>
              Checkpoints are this task's flexible progression — verify them in any order, and add more as you find them.
            </p>
            <div className='mt-3 flex flex-wrap items-center gap-2'>
              <span className='text-tag font-[600] text-ink-subtle'>Quick fill</span>
              <Button size='sm' variant='secondary' leadingIcon={PlusIcon}
                onClick={prefillCampuses} disabled={!(schools.data?.uc || []).length}>
                One per UC campus
              </Button>
              {newItems.length > 0 && (
                <Button size='sm' variant='ghost' className='hover:!bg-danger-soft hover:!text-danger'
                  onClick={() => setNewItems([])}>Clear all</Button>
              )}
            </div>
            {newItems.length > 0 && (
              <ol className='mt-2'>
                {newItems.map((name, index) => (
                  <li key={`${name}-${index}`} className='flex items-center gap-2.5 py-[6.5px] border-b border-border'>
                    <span className='grid place-items-center w-[22px] h-[22px] rounded-pill bg-surface-sunken text-[11px] font-[650] text-ink-muted shrink-0'>{index + 1}</span>
                    <span className='text-caption ink-default min-w-0 truncate'>{name}</span>
                    <IconButton icon={XMarkIcon} label={`Remove ${name}`} size='sm' className='ml-auto'
                      onClick={() => setNewItems((current) => current.filter((_, i) => i !== index))} />
                  </li>
                ))}
              </ol>
            )}
            <div className='mt-3 flex items-center gap-2.5'>
              <input value={itemDraft}
                onChange={(event) => setItemDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addDraftItem() } }}
                placeholder='Add a checkpoint — a campus, dataset, or spot-check…'
                className='flex-1 min-w-0 bg-surface border border-border rounded-pill px-4 py-[9px] text-[13px] outline-none placeholder:text-ink-subtle focus:border-primary' />
              <Button size='sm' variant='secondary' disabled={!itemDraft.trim()} onClick={addDraftItem}>Add</Button>
            </div>
            {error && !newItems.length && <p className='text-caption text-danger mt-2'>{error}</p>}
          </section>
        </div>
      ) : (
        <div>
          {details}
          <section className='mt-6 pt-5 border-t border-border'>
            <div className='flex items-center justify-between gap-3'>
              <h3 className='text-body-strong'>Porting stages</h3>
              <span className='text-tag text-ink-subtle'>{PORTING_STAGES.length} stages</span>
            </div>
            <p className='text-caption text-ink-subtle mt-2'>
              Porting tasks follow the same fixed pipeline, completed in order.
            </p>
            <ol className='mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6'>
              {PORTING_STAGES.map((stage, index) => (
                <li key={stage.key} className='flex items-center gap-2.5 py-[9px] border-b border-border'>
                  <span className='grid place-items-center w-[22px] h-[22px] rounded-pill bg-surface-sunken text-[11px] font-[650] text-ink-muted shrink-0'>{index + 1}</span>
                  <span className='text-caption ink-muted min-w-0 flex-1'>{stage.label}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Modal>
  )
}
