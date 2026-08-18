import React, { useState } from 'react'
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Button, Textarea } from '../components/ui'
import { fmtDate } from '../shared/fmtDate'

/**
 * The notes rail — the reason the rest of this exists. The tool's job is to
 * put the number physically next to the sentence Tybalt wrote about it.
 *
 * NOTES ARE USER-AUTHORED, ABSOLUTELY. Nothing here seeds, pre-fills,
 * templates, summarizes, rewrites or removes a note; the store ships with zero
 * rows. The only example wording in this file is the compose box's
 * `placeholder` attribute, which is never stored.
 *
 * Shaped after DegreeVerificationNotes so one note primitive reads identically
 * across the console, plus an `anchor` (the delta cell a note is about) and
 * author-only edit.
 */

const shortAuthorUid = (uid) => (uid ? `UID ${String(uid).slice(0, 8)}` : 'unknown author')

function AnchorChip({ anchor, onSelect }) {
  if (!anchor) return null
  const label = anchor.label || [anchor.rowKey, anchor.colKey].filter(Boolean).join(' × ')
  if (!label) return null
  return (
    <button type='button' onClick={() => onSelect?.(anchor)}
      className='inline-flex max-w-full items-center rounded-pill bg-surface-sunken px-2.5
        py-[3px] text-tag text-ink-muted hover:text-ink'>
      <span className='truncate'>{label}</span>
    </button>
  )
}

function NoteRow({ note, canEdit, busy, onEdit, onDelete, onSelectAnchor }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.text)

  const commit = async () => {
    // Byte-exact: the text goes up exactly as typed, with no trim into storage.
    // A failed write leaves the editor open with the prose still in it.
    if (!draft.trim()) return
    if (await onEdit(note.id, draft) !== false) setEditing(false)
  }

  return (
    <li className='flex flex-col gap-1.5 border-b border-border pb-3 last:border-0'>
      {editing ? (
        <>
          <Textarea rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} />
          <div className='flex items-center gap-2'>
            <Button size='sm' onClick={commit} disabled={busy || !draft.trim()}>Save</Button>
            <Button size='sm' variant='ghost'
              onClick={() => { setDraft(note.text); setEditing(false) }}>Cancel</Button>
          </div>
        </>
      ) : (
        <>
          <p className='text-caption ink-default whitespace-pre-wrap break-words'>{note.text}</p>
          <AnchorChip anchor={note.anchor} onSelect={onSelectAnchor} />
          <div className='flex items-center gap-2'>
            <p className='min-w-0 flex-1 truncate text-caption text-ink-subtle'>
              {note.author_label || shortAuthorUid(note.author_uid)}
              {note.created_at ? ` · ${fmtDate(note.created_at)}` : ''}
            </p>
            {canEdit && (
              <>
                <Button variant='ghost' size='sm' leadingIcon={PencilSquareIcon}
                  title='Edit note' aria-label='Edit note'
                  onClick={() => setEditing(true)} />
                <Button variant='ghost' size='sm' leadingIcon={TrashIcon} disabled={busy}
                  title='Delete note' aria-label='Delete note'
                  onClick={() => { if (window.confirm('Delete this note?')) onDelete(note.id) }} />
              </>
            )}
          </div>
        </>
      )}
    </li>
  )
}

export default function ComparisonNotes({
  notes = [],
  canEditNote = () => false,
  pendingAnchor = null,
  onClearAnchor = () => {},
  onSelectAnchor = () => {},
  onAdd,
  onEdit,
  onDelete,
  busy = false,
  error = null,
}) {
  const [text, setText] = useState('')

  // The compose box is cleared only on a confirmed write. Losing someone's
  // typed argument to a failed request is the one failure this rail may not have.
  const add = async () => {
    if (!text.trim()) return
    if (await onAdd(text, pendingAnchor) !== false) setText('')
  }

  return (
    <section className='surface-card flex flex-col gap-3 p-5' data-export-exclude>
      <div className='flex items-baseline justify-between gap-3'>
        <h2 className='text-heading'>Notes</h2>
        {!!notes.length && <span className='text-caption ink-subtle tabular'>{notes.length}</span>}
      </div>

      {notes.length ? (
        <ul className='flex flex-col gap-3'>
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} canEdit={canEditNote(note)} busy={busy}
              onEdit={onEdit} onDelete={onDelete} onSelectAnchor={onSelectAnchor} />
          ))}
        </ul>
      ) : (
        <p className='text-caption ink-subtle'>No notes yet.</p>
      )}

      <div className='flex flex-col gap-2 border-t border-border pt-3'>
        {pendingAnchor && (
          <div className='flex items-center gap-2'>
            <span className='text-tag ink-subtle'>About</span>
            <AnchorChip anchor={pendingAnchor} />
            <button type='button' onClick={onClearAnchor}
              className='text-tag ink-subtle hover:text-ink'>clear</button>
          </div>
        )}
        <Textarea rows={3} value={text} onChange={(event) => setText(event.target.value)}
          aria-label='Add a note'
          placeholder='e.g. what this difference means, and what we do about it before the meeting' />
        <div className='flex items-center gap-2'>
          <Button variant='secondary' size='sm' onClick={add} disabled={busy || !text.trim()}>
            {busy ? 'Saving…' : 'Add note'}
          </Button>
          {error && <span className='text-caption text-danger'>{error}</span>}
        </div>
      </div>
    </section>
  )
}
