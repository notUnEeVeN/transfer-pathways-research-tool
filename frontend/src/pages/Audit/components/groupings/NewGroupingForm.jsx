import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Alert, Spinner } from '../../../../components/ui'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAuditSearch } from '@frontend/query/hooks/useAudit'

/**
 * "New grouping" composer.
 *   • Name field
 *   • Unified search bar (debounced 200ms) → school + pair results
 *   • Add/remove members list grouped by school
 */
export default function NewGroupingForm({ name, setName, members, setMembers, error, clearError, onCancel, onSubmit, busy }) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [expandedSchool, setExpandedSchool] = useState(null)    // { system, school_id }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 200)
    return () => clearTimeout(t)
  }, [q])

  const searchQ = useAuditSearch(debouncedQ, { enabled: true })

  const memberSet = useMemo(() => {
    const s = new Set()
    for (const m of members) s.add(`${m.system}|${m.school_id}|${m.major}`)
    return s
  }, [members])

  const addPair = (p) => {
    const k = `${p.system}|${p.school_id}|${p.major}`
    if (memberSet.has(k)) return
    setMembers([
      ...members,
      { system: p.system, school_id: p.school_id, school_name: p.name, major: p.major },
    ])
    clearError?.()
  }

  const removePair = (m) => {
    setMembers(members.filter((x) =>
      !(x.system === m.system && x.school_id === m.school_id && x.major === m.major)
    ))
  }

  const data = searchQ.data || { schools: [], pairs: [] }

  return (
    <div className='flex flex-col gap-3 min-h-0'>
      <div>
        <Input
          label='Name'
          value={name}
          onChange={(e) => { setName(e.target.value); clearError?.() }}
          placeholder='e.g. CS at all UCs'
          maxLength={100}
        />
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0'>
        {/* ────── Picker ────── */}
        <div className='flex flex-col gap-2 min-h-0'>
          <p className='text-label'>Search schools & majors</p>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder='Type a school or major…'
          />
          <div className='flex flex-col gap-3 overflow-y-auto max-h-[300px] -mx-1 px-1'>
            {searchQ.isFetching && q && (
              <div className='flex items-center gap-2 text-caption'><Spinner /> Searching…</div>
            )}
            {data.schools.length > 0 && (
              <div>
                <p className='text-caption text-ink-subtle mb-1'>Schools</p>
                <div className='flex flex-col'>
                  {data.schools.map((s) => {
                    const exp = expandedSchool && expandedSchool.school_id === s.school_id && expandedSchool.system === s.system
                    return (
                      <div key={`${s.system}|${s.school_id}`}>
                        <button
                          type='button'
                          onClick={() => setExpandedSchool(exp ? null : { system: s.system, school_id: s.school_id, name: s.name })}
                          className='flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-surface-hover text-left w-full'
                        >
                          <span>{s.name}</span>
                          <span className='text-caption text-ink-subtle'>{exp ? '−' : 'expand'}</span>
                        </button>
                        {exp && (
                          <SchoolMajorPicker
                            system={s.system}
                            schoolId={s.school_id}
                            schoolName={s.name}
                            memberSet={memberSet}
                            onAdd={addPair}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {data.pairs.length > 0 && (
              <div>
                <p className='text-caption text-ink-subtle mb-1'>Pairs</p>
                <div className='flex flex-col'>
                  {data.pairs.map((p) => {
                    const k = `${p.system}|${p.school_id}|${p.major}`
                    const inSet = memberSet.has(k)
                    return (
                      <button
                        key={k}
                        type='button'
                        disabled={inSet}
                        onClick={() => addPair(p)}
                        className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left ${
                          inSet ? 'text-ink-subtle' : 'hover:bg-surface-hover'
                        }`}
                      >
                        <span className='min-w-0'>
                          <span className='text-ink-subtle'>{p.name}</span>
                          <span className='text-ink-subtle mx-1'>·</span>
                          <span className='break-words'>{p.major}</span>
                        </span>
                        <span className='text-caption shrink-0'>{inSet ? 'added' : '+'}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {!searchQ.isFetching && q && data.schools.length === 0 && data.pairs.length === 0 && (
              <p className='text-caption text-ink-subtle italic'>No matches.</p>
            )}
            {!q && data.schools.length === 0 && (
              <p className='text-caption text-ink-subtle italic'>
                Start typing to search across schools and majors.
              </p>
            )}
          </div>
        </div>

        {/* ────── Selected pairs ────── */}
        <div className='flex flex-col gap-2 min-h-0'>
          <p className='text-label'>
            Members <span className='text-ink-subtle font-mono'>({members.length})</span>
          </p>
          {members.length === 0 ? (
            <p className='text-caption text-ink-subtle italic'>
              Add at least one pair from the picker.
            </p>
          ) : (
            <div className='flex flex-col gap-1 overflow-y-auto max-h-[300px] -mx-1 px-1'>
              {members.map((m) => (
                <div key={`${m.system}|${m.school_id}|${m.major}`}
                  className='flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-surface-muted'>
                  <span className='min-w-0 truncate'>
                    <span className='text-ink-subtle'>{m.school_name || `#${m.school_id}`}</span>
                    <span className='text-ink-subtle mx-1'>·</span>
                    <span>{m.major}</span>
                  </span>
                  <button
                    type='button'
                    onClick={() => removePair(m)}
                    className='shrink-0 text-ink-subtle hover:text-danger'
                    aria-label='Remove'
                  >
                    <XMarkIcon className='w-3.5 h-3.5' />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <Alert type='error'>{error}</Alert>}

      <div className='flex gap-2 hairline-t pt-3'>
        <Button onClick={onSubmit} disabled={busy}>{busy ? 'Saving…' : 'Save & apply'}</Button>
        <Button variant='ghost' onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

/**
 * When the user expands a school in the picker, this component fetches the
 * majors for that school. We hit /audit/search with q='' would return zero
 * pairs by design, so instead we use a special trick: pass the school name
 * as q. That brings up matching majors (because the regex matches the
 * school name field too) and we just filter the result client-side to that
 * school_id.
 */
function SchoolMajorPicker({ system, schoolId, schoolName, memberSet, onAdd }) {
  const q = useAuditSearch(schoolName, { enabled: true })
  const data = q.data || { pairs: [] }
  const pairs = data.pairs.filter((p) => p.system === system && p.school_id === schoolId)
  if (q.isFetching) {
    return <div className='pl-4 py-1 flex items-center gap-2 text-caption'><Spinner /> Loading majors…</div>
  }
  if (!pairs.length) {
    return <p className='pl-4 py-1 text-caption text-ink-subtle italic'>No majors found for this school.</p>
  }
  return (
    <div className='pl-4 flex flex-col py-1'>
      {pairs.map((p) => {
        const k = `${p.system}|${p.school_id}|${p.major}`
        const inSet = memberSet.has(k)
        return (
          <button
            key={p.major}
            type='button'
            disabled={inSet}
            onClick={() => onAdd(p)}
            className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left ${
              inSet ? 'text-ink-subtle' : 'hover:bg-surface-hover'
            }`}
          >
            <span className='break-words'>{p.major}</span>
            <span className='text-caption shrink-0'>{inSet ? 'added' : '+'}</span>
          </button>
        )
      })}
    </div>
  )
}
