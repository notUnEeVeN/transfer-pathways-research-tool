import React, { useMemo, useState, useEffect } from 'react'
import { MagnifyingGlassIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Alert, Button, Input, Modal, Select, Spinner } from '../components/ui'
import { useSaveRefRow, useUniversityCourses } from '@frontend/query/hooks/useData'
import { UC_SCHOOLS } from './refTablesRegistry'

const norm = (v) => String(v ?? '').toLowerCase()

// The matched-UC-course picker for transfer minimums: search the
// campus's university courses and link one.
function MatchedCourseField({ value = [], schoolId, onChange }) {
  const [query, setQuery] = useState('')
  const courses = useUniversityCourses(schoolId ?? null)
  const rows = courses.data || []
  const current = value[0] || null

  const results = useMemo(() => {
    const q = norm(query)
    if (!q) return []
    return rows.filter((c) => norm(`${c.prefix} ${c.number} ${c.title}`).includes(q)).slice(0, 12)
  }, [rows, query])

  const pick = (c) => {
    setQuery('')
    onChange?.([{ parent_id: c.parent_id, prefix: c.prefix, number: c.number, title: c.title }])
  }

  if (current) {
    return (
      <div className='flex items-center gap-2 surface-card px-3 py-2'>
        <span className='font-mono text-ink'>{current.prefix} {current.number}</span>
        {current.title && <span className='text-caption text-ink-muted truncate'>{current.title}</span>}
        <Button variant='ghost' className='ml-auto' leadingIcon={XMarkIcon} onClick={() => onChange?.([])}>Clear</Button>
      </div>
    )
  }
  if (schoolId == null) return <p className='text-caption text-ink-subtle'>Pick a UC campus first, then search its courses.</p>
  return (
    <div>
      <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Search UC courses to link…' leadingIcon={MagnifyingGlassIcon} />
      {courses.isLoading && <div className='py-2'><Spinner /></div>}
      {!!results.length && (
        <div className='surface-card mt-1 divide-y divide-border/60 max-h-56 overflow-auto'>
          {results.map((c) => (
            <button key={c.parent_id} type='button' onClick={() => pick(c)} className='w-full text-left px-3 py-1.5 hover:bg-surface-hover'>
              <span className='font-mono text-ink'>{c.prefix} {c.number}</span>
              {c.title && <span className='ml-2 text-caption text-ink-muted'>{c.title}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ field, value, draft, onChange }) {
  const set = (v) => onChange(field.key, v)
  if (field.type === 'select') return <Select value={value ?? ''} onChange={set} options={field.options} />
  if (field.type === 'number') {
    return <Input type='number' value={value ?? ''} placeholder={field.placeholder}
      onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} />
  }
  if (field.type === 'tags') {
    return <Input value={(Array.isArray(value) ? value : []).join(', ')} placeholder={field.placeholder}
      onChange={(e) => set(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
  }
  // Like tags, but an entry may be an OR-group written with '|'. Comma
  // separates AND requirements; 'calc_1 | bus_calc_1' is one OR-group stored
  // as an array. Round-trips array entries back to pipe text for editing.
  if (field.type === 'or-tags') {
    const toText = (Array.isArray(value) ? value : [])
      .map((e) => (Array.isArray(e) ? e.join(' | ') : e)).join(', ')
    const parse = (text) => text.split(',').map((s) => s.trim()).filter(Boolean).map((tok) => {
      const alts = tok.split('|').map((a) => a.trim()).filter(Boolean)
      return alts.length > 1 ? alts : alts[0]
    }).filter(Boolean)
    return <Input value={toText} placeholder={field.placeholder} onChange={(e) => set(parse(e.target.value))} />
  }
  if (field.type === 'matched-course') {
    return <MatchedCourseField value={Array.isArray(value) ? value : []}
      schoolId={UC_SCHOOLS[draft.uc_code]?.school_id ?? draft.school_id ?? null} onChange={(v) => set(v)} />
  }
  return <Input value={value ?? ''} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />
}

/**
 * Add/edit one row of a reference table, driven by the table's field schema.
 * `editing` is { row, isNew } or null. Saves through the curation ref CRUD.
 */
export default function RefRowModal({ config, editing, onClose }) {
  const save = useSaveRefRow(config.key)
  const [draft, setDraft] = useState({})
  const [error, setError] = useState(null)

  useEffect(() => {
    setDraft(editing ? { ...editing.row } : {})
    setError(null)
  }, [editing])

  const setField = (key, val) => setDraft((d) => ({ ...d, [key]: val }))

  const commit = async () => {
    setError(null)
    let row = { ...draft }
    if (config.derive) row = config.derive(row)
    const id = editing.isNew ? (config.makeId ? config.makeId(row) : row._id) : row._id
    if (id == null || String(id).trim() === '') { setError('An id/key is required for this row.'); return }
    row._id = id
    try {
      await save.mutateAsync(row)
      onClose()
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not save the row.')
    }
  }

  return (
    <Modal
      open={!!editing}
      onClose={onClose}
      title={editing?.isNew ? `Add — ${config.label}` : `Edit — ${config.label}`}
      actions={
        <>
          <Button variant='ghost' onClick={onClose}>Cancel</Button>
          <Button leadingIcon={CheckIcon} disabled={save.isPending} onClick={commit}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      {editing && (
        <div className='flex flex-col gap-3'>
          {error && <Alert type='error'>{error}</Alert>}
          {config.fields.map((field) => {
            const locked = field.idOnCreate && !editing.isNew
            return (
              <div key={field.key}>
                <label className='text-label block mb-1'>{field.label}{locked && <span className='text-ink-subtle'> (fixed)</span>}</label>
                {locked
                  ? <div className='font-mono text-caption text-ink-muted px-3 py-2 surface-card'>{String(draft[field.key])}</div>
                  : <Field field={field} value={draft[field.key]} draft={draft} onChange={setField} />}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}
