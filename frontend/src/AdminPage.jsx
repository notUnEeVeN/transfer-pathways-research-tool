import React, { useEffect, useState } from 'react'
import { TrashIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, EmptyState, Stack, Input, Checkbox } from './components/ui'
import {
  useAdminDataset, useAdminAccessList, useGrantAccess, useRevokeAccess,
  useVisibleMajors, useSetVisibleMajors,
} from '@frontend/query/hooks/useAccess'

/**
 * Admin view (ADMIN_UIDS accounts only — the server enforces it; this page
 * simply isn't offered to partners).
 *
 * Dataset: what the research cluster currently holds — version, majors,
 * counts, and the port changelog. Data itself is ported from the admin's
 * machine with scripts/port.py; this view is the read-side.
 *
 * Access: grant/revoke partner accounts by Firebase UID.
 */
export default function AdminPage() {
  return (
    <div className='mx-auto max-w-screen-lg px-8 py-8'>
      <Stack gap='section'>
        <MajorAccessPanel />
        <DatasetPanel />
        <AccessPanel />
      </Stack>
    </div>
  )
}

// Which ported (school, major) pairs partners can see, organized by campus —
// the same major name can exist at several UCs, so grants are per campus
// program, not per name. Deny-by-default: nothing is visible until checked.
// The server enforces the subset on every audit/read/analysis query, so
// partners' stats reflect exactly this selection.
const pairKey = (schoolId, major) => `${schoolId}|${major}`

function MajorAccessPanel() {
  const q = useVisibleMajors()
  const save = useSetVisibleMajors()
  const [selected, setSelected] = useState(null) // Set of "school_id|major", null until data loads

  useEffect(() => {
    if (q.data && selected === null) {
      setSelected(new Set((q.data.visible || []).map((p) => pairKey(p.school_id, p.major))))
    }
  }, [q.data, selected])

  if (q.isLoading || selected === null) {
    return <div className='flex justify-center py-8'><Spinner /></div>
  }
  if (q.isError) return <Alert type='error'>Failed to load the major list.</Alert>

  const schools = q.data.schools || []
  const allKeys = schools.flatMap((s) => s.majors.map((m) => pairKey(s.school_id, m)))
  const savedSet = new Set((q.data.visible || []).map((p) => pairKey(p.school_id, p.major)))
  const dirty = selected.size !== savedSet.size || [...selected].some((k) => !savedSet.has(k))
  const toggle = (k) => setSelected((s) => {
    const next = new Set(s)
    if (next.has(k)) next.delete(k); else next.add(k)
    return next
  })
  const setMany = (keys, on) => setSelected((s) => {
    const next = new Set(s)
    keys.forEach((k) => (on ? next.add(k) : next.delete(k)))
    return next
  })
  const submit = () => {
    const pairs = [...selected].map((k) => {
      const i = k.indexOf('|')
      return { school_id: Number(k.slice(0, i)), major: k.slice(i + 1) }
    })
    save.mutate(pairs)
  }

  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Partner major access</h2>
        <p className='text-caption text-ink-muted mt-1'>
          Partners can only see (audit, browse, analyze) the checked campus
          programs — their stats pages cover exactly this selection. Grants are
          per school + major, so checking UCSD's "Computer Science B.S." does
          not grant another campus's program with the same name. You always
          see everything.
        </p>
      </div>
      <div className='surface-card p-5'>
        <div className='flex items-center gap-3 mb-4'>
          <p className='text-label'>{selected.size} of {allKeys.length} programs visible to partners</p>
          <div className='ml-auto flex items-center gap-2'>
            <Button variant='ghost' onClick={() => setMany(allKeys, true)}>All</Button>
            <Button variant='ghost' onClick={() => setSelected(new Set())}>None</Button>
            <Button onClick={submit} disabled={!dirty || save.isPending}>
              {save.isPending ? 'Saving…' : dirty ? 'Save' : 'Saved'}
            </Button>
          </div>
        </div>
        {save.isError && <Alert type='error'>{save.error?.response?.data?.error || 'Save failed.'}</Alert>}
        <Stack gap='comfortable'>
          {schools.map((s) => {
            const keys = s.majors.map((m) => pairKey(s.school_id, m))
            const nOn = keys.filter((k) => selected.has(k)).length
            return (
              <div key={s.school_id}>
                <div className='flex items-center gap-3 border-b border-border pb-1.5 mb-2'>
                  <p className='text-body-strong'>{s.school}</p>
                  <span className='text-caption text-ink-subtle'>{nOn} / {keys.length} visible</span>
                  <div className='ml-auto flex items-center gap-1'>
                    <Button variant='ghost' onClick={() => setMany(keys, true)}>All</Button>
                    <Button variant='ghost' onClick={() => setMany(keys, false)}>None</Button>
                  </div>
                </div>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1'>
                  {s.majors.map((m) => {
                    const k = pairKey(s.school_id, m)
                    return <Checkbox key={k} checked={selected.has(k)} onChange={() => toggle(k)} label={m} />
                  })}
                </div>
              </div>
            )
          })}
        </Stack>
        {!schools.length && (
          <p className='text-caption text-ink-subtle'>
            Nothing ported yet — run <span className='font-mono'>python port.py add "…"</span> first.
          </p>
        )}
      </div>
    </Stack>
  )
}

function DatasetPanel() {
  const q = useAdminDataset()
  if (q.isLoading) return <div className='flex justify-center py-8'><Spinner /></div>
  if (q.isError) return <Alert type='error'>Failed to load the dataset status.</Alert>
  const meta = q.data?.meta
  if (!meta) {
    return (
      <EmptyState title='No dataset yet'
        description='Run `python port.py init` then `python port.py add "<major>"` from scripts/ to port the first majors.' />
    )
  }
  const majors = meta.majors || {}
  const counts = meta.counts || {}
  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Dataset</h2>
        <p className='text-caption text-ink-muted mt-1'>
          <span className='font-mono text-ink'>{meta.dataset_version}</span>
          {' '}· updated {meta.updated_at ? new Date(meta.updated_at).toLocaleString() : '—'}
          {' '}· ported with <span className='font-mono'>scripts/port.py</span> from the admin machine
        </p>
      </div>
      <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>
        {Object.entries(counts).map(([coll, n]) => (
          <div key={coll} className='surface-card p-4'>
            <p className='text-stat font-mono'>{Number(n).toLocaleString()}</p>
            <p className='text-caption text-ink-muted break-words'>{coll}</p>
          </div>
        ))}
      </div>
      {Object.entries(majors).map(([coll, names]) => (
        <div key={coll} className='surface-card p-5'>
          <p className='text-label mb-2'>{coll} — {names.length} major{names.length === 1 ? '' : 's'}</p>
          {names.length
            ? <ul className='text-body text-ink-muted list-disc pl-5 space-y-0.5'>{names.map((m) => <li key={m}>{m}</li>)}</ul>
            : <p className='text-caption text-ink-subtle'>none ported</p>}
        </div>
      ))}
      <div className='surface-card p-5'>
        <p className='text-label mb-2'>Recent changes</p>
        <div className='divide-y divide-border/60'>
          {(q.data?.changelog || []).map((e, i) => (
            <div key={i} className='py-2 flex items-baseline gap-3'>
              <span className='text-caption font-mono text-ink-muted shrink-0'>{e.dataset_version}</span>
              <span className='text-caption text-ink-subtle shrink-0'>{e.action}</span>
              <span className='text-caption break-words'>
                {Array.isArray(e.detail) ? e.detail.join(' · ') : String(e.detail ?? '')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Stack>
  )
}

function AccessPanel() {
  const list = useAdminAccessList()
  const grant = useGrantAccess()
  const revoke = useRevokeAccess()
  const [uid, setUid] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!uid.trim()) return
    await grant.mutateAsync({ uid: uid.trim(), email: email.trim(), note: note.trim() })
    setUid(''); setEmail(''); setNote('')
  }

  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Partner access</h2>
        <p className='text-caption text-ink-muted mt-1'>
          Granted accounts can audit and browse the research dataset. A partner
          finds their Firebase UID on the "No access" screen error… or you look
          it up in the Firebase console by their email after their first
          sign-in attempt.
        </p>
      </div>
      <form onSubmit={submit} className='surface-card p-5'>
        <Stack gap='cozy'>
          <p className='text-label'>Grant access</p>
          <div className='grid grid-cols-1 sm:grid-cols-3 gap-2'>
            <Input value={uid} onChange={(e) => setUid(e.target.value)} placeholder='Firebase UID (required)' className='font-mono' />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder='Email (label only)' />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder='Note (e.g. "MA analysis")' />
          </div>
          {grant.isError && <Alert type='error'>{grant.error?.response?.data?.error || 'Grant failed.'}</Alert>}
          <div><Button type='submit' disabled={grant.isPending || !uid.trim()}>{grant.isPending ? 'Granting…' : 'Grant'}</Button></div>
        </Stack>
      </form>
      <div className='surface-card p-5'>
        <p className='text-label mb-2'>Granted partners</p>
        {list.isLoading ? <Spinner /> : list.isError ? (
          <Alert type='error'>Failed to load grants.</Alert>
        ) : !(list.data?.partners || []).length ? (
          <p className='text-caption text-ink-subtle'>No partners granted yet.</p>
        ) : (
          <div className='divide-y divide-border/60'>
            {list.data.partners.map((p) => (
              <div key={p.uid} className='py-2 flex items-center gap-3'>
                <div className='min-w-0'>
                  <p className='text-body-strong break-words'>{p.email || p.uid}</p>
                  <p className='text-caption text-ink-subtle break-words'>
                    <span className='font-mono'>{p.uid}</span>
                    {p.note ? ` · ${p.note}` : ''}
                    {p.granted_at ? ` · granted ${new Date(p.granted_at).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <Button variant='ghost' className='ml-auto' leadingIcon={TrashIcon}
                  onClick={() => revoke.mutate(p.uid)} disabled={revoke.isPending}>
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Stack>
  )
}
