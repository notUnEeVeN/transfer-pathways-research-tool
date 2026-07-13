import React, { useEffect, useState } from 'react'
import { TrashIcon, CheckIcon, NoSymbolIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, EmptyState, Stack, Input, Select, SwitchField } from './components/ui'
import { ANALYSES } from './analyses/registry'
import {
  useAdminDataset, useAdminAccessList, useGrantAccess, useRevokeAccess,
  useVisibleMajors, useSetVisibleMajors,
  useAccessRequests, useBlockAccessRequest, useBlockedAccounts, useUnblockAccount,
  useVisualSettings, useSetPublishedVisuals, useSetHiddenVisuals,
  useTeam, useSetTeamName,
} from '@frontend/query/hooks/useAccess'

/**
 * Admin view (ADMIN_UIDS accounts only — the server enforces it; this page
 * simply isn't offered to partners).
 *
 * Dataset: what the research cluster currently holds — majors, counts, and
 * last refresh time. Data itself is ported from the admin's
 * machine with scripts/port.py; this view is the read-side.
 *
 * Access: grant/revoke partner accounts by Firebase UID.
 */
export default function AdminPage() {
  return (
    <div className='mx-auto max-w-screen-lg px-8 py-8'>
      <Stack gap='section'>
        <SignInRequestsPanel />
        <BlockedAccountsPanel />
        <TeamNamesPanel />
        <MajorAccessPanel />
        <VisualSettingsPanel />
        <DatasetPanel />
        <AccessPanel />
      </Stack>
    </div>
  )
}

// Accounts that signed in but aren't approved yet (filed automatically by
// the denied screen). Granting from here unlocks their open tab within
// seconds — their screen polls for access, no reload needed on either side.
function SignInRequestsPanel() {
  const list = useAccessRequests()
  const grant = useGrantAccess()
  const block = useBlockAccessRequest()
  const requests = list.data?.requests || []

  if (list.isLoading || (!requests.length && !list.isError)) {
    // Nothing pending is the steady state — keep the page quiet, not empty-boxed.
    return null
  }

  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Sign-in requests</h2>
        <p className='text-caption text-ink-muted mt-1'>
          These accounts signed in with Google but aren't approved yet. Grant
          gives them the partner role on the spot — their waiting screen unlocks
          within seconds. Reject blocks the account: it's removed here, any
          existing access is revoked, and it can't request again until you
          un-block it below.
        </p>
      </div>
      <div className='surface-card p-5'>
        {list.isError ? (
          <Alert type='error'>Failed to load sign-in requests.</Alert>
        ) : (
          <div className='divide-y divide-border/60'>
            {requests.map((r) => (
              <div key={r.uid} className='py-2.5 flex items-center gap-3 flex-wrap'>
                <div className='min-w-0'>
                  <p className='text-body-strong break-words'>{r.email || r.name || r.uid}</p>
                  <p className='text-caption text-ink-subtle break-words'>
                    {r.name && r.email ? `${r.name} · ` : ''}
                    <span className='font-mono'>{r.uid}</span>
                    {r.last_seen ? ` · last attempt ${new Date(r.last_seen).toLocaleString()}` : ''}
                    {r.attempts > 1 ? ` · ${r.attempts} attempts` : ''}
                  </p>
                </div>
                <div className='ml-auto flex items-center gap-2 shrink-0'>
                  <Button leadingIcon={CheckIcon} disabled={grant.isPending || block.isPending}
                    onClick={() => grant.mutate({ uid: r.uid, email: r.email || '', note: '' })}>
                    Grant access
                  </Button>
                  <Button variant='danger' leadingIcon={NoSymbolIcon} disabled={grant.isPending || block.isPending}
                    onClick={() => block.mutate({ uid: r.uid, email: r.email || '', name: r.name || '' })}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {grant.isError && (
          <Alert type='error' className='mt-3'>{grant.error?.response?.data?.error || 'Grant failed.'}</Alert>
        )}
        {block.isError && (
          <Alert type='error' className='mt-3'>{block.error?.response?.data?.error || 'Reject failed.'}</Alert>
        )}
      </div>
    </Stack>
  )
}

// Rejected accounts (the deny-list). Blocking clears the request and revokes
// any grant; the account can't get back in until un-blocked. Quiet when empty.
function BlockedAccountsPanel() {
  const list = useBlockedAccounts()
  const unblock = useUnblockAccount()
  const blocked = list.data?.blocked || []

  if (list.isLoading || (!blocked.length && !list.isError)) return null

  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Blocked accounts</h2>
        <p className='text-caption text-ink-muted mt-1'>
          Rejected accounts. They can't request access or sign in to the console.
          Un-block to let them request again (you still approve the request).
        </p>
      </div>
      <div className='surface-card p-5'>
        {list.isError ? (
          <Alert type='error'>Failed to load blocked accounts.</Alert>
        ) : (
          <div className='divide-y divide-border/60'>
            {blocked.map((b) => (
              <div key={b.uid} className='py-2.5 flex items-center gap-3 flex-wrap'>
                <div className='min-w-0'>
                  <p className='text-body-strong break-words'>{b.email || b.name || b.uid}</p>
                  <p className='text-caption text-ink-subtle break-words'>
                    {b.name && b.email ? `${b.name} · ` : ''}
                    <span className='font-mono'>{b.uid}</span>
                    {b.blocked_at ? ` · blocked ${new Date(b.blocked_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <Button variant='ghost' className='ml-auto' leadingIcon={ArrowUturnLeftIcon}
                  disabled={unblock.isPending}
                  onClick={() => unblock.mutate(b.uid)}>
                  Un-block
                </Button>
              </div>
            ))}
          </div>
        )}
        {unblock.isError && (
          <Alert type='error' className='mt-3'>{unblock.error?.response?.data?.error || 'Un-block failed.'}</Alert>
        )}
      </div>
    </Stack>
  )
}

// The working dataset contains exactly one major for each UC campus. Keep the
// form state keyed by campus so the UI cannot construct an invalid selection.
export function majorsBySchool(pairs = []) {
  const selected = new Map()
  for (const pair of pairs) {
    const key = String(Number(pair.school_id))
    if (!selected.has(key)) selected.set(key, pair.major)
  }
  return selected
}

function MajorAccessPanel() {
  const q = useVisibleMajors()
  const save = useSetVisibleMajors()
  const [selected, setSelected] = useState(null) // Map of school_id -> major; null until data loads

  useEffect(() => {
    if (q.data && selected === null) {
      setSelected(majorsBySchool(q.data.visible))
    }
  }, [q.data, selected])

  if (q.isLoading || selected === null) {
    return <div className='flex justify-center py-8'><Spinner /></div>
  }
  if (q.isError) return <Alert type='error'>Failed to load the major list.</Alert>

  const schools = q.data.schools || []
  const saved = majorsBySchool(q.data.visible)
  const dirty = selected.size !== saved.size || [...selected].some(([schoolId, major]) => saved.get(schoolId) !== major)
  const configuredCount = schools.filter((school) => selected.has(String(Number(school.school_id)))).length
  const complete = configuredCount === schools.length
  const chooseMajor = (schoolId, major) => setSelected((current) => {
    const next = new Map(current)
    const key = String(Number(schoolId))
    if (major) next.set(key, major)
    else next.delete(key)
    return next
  })
  const submit = () => {
    const pairs = schools.flatMap((school) => {
      const major = selected.get(String(Number(school.school_id)))
      return major ? [{ school_id: Number(school.school_id), major }] : []
    })
    save.mutate(pairs)
  }

  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Working major by campus</h2>
        <p className='text-caption text-ink-muted mt-1'>
          Choose one major for each UC included in the working dataset. The
          selection scopes browsing, audits, analyses, and visuals for everyone;
          the full ported dataset remains available in the admin inventory below.
        </p>
      </div>
      <div className='surface-card p-5'>
        <div className='flex items-center gap-3 mb-4'>
          <p className='text-label'>{configuredCount} of {schools.length} campuses configured</p>
          <div className='ml-auto flex items-center gap-2'>
            <Button onClick={submit} disabled={!complete || !dirty || save.isPending}>
              {save.isPending ? 'Saving…' : !complete ? 'Choose all campuses' : dirty ? 'Save' : 'Saved'}
            </Button>
          </div>
        </div>
        {!complete && (
          <p className='text-caption text-ink-muted mb-4'>Choose one major for every UC campus before saving.</p>
        )}
        {save.isError && <Alert type='error'>{save.error?.response?.data?.error || 'Save failed.'}</Alert>}
        <Stack gap='comfortable'>
          {schools.map((s) => {
            const schoolId = String(Number(s.school_id))
            const value = selected.get(schoolId) || ''
            const options = s.majors.map((major) => ({ value: major, label: major }))
            return (
              <div key={s.school_id} className='grid grid-cols-1 sm:grid-cols-[minmax(12rem,1fr)_minmax(16rem,28rem)] gap-3 items-center border-b border-border pb-4'>
                <div className='min-w-0'>
                  <p className='text-body-strong'>{s.school}</p>
                  <p className='text-caption text-ink-subtle'>{s.majors.length} available {s.majors.length === 1 ? 'major' : 'majors'}</p>
                </div>
                <Select value={value} options={options} placeholder='Choose a major…'
                  onChange={(major) => chooseMajor(s.school_id, major)}
                  aria-label={`${s.school} major`} />
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

// Two independent controls for each recovered built-in. Availability decides
// whether the card mounts in the admin gallery at all. Publishing decides
// whether partners see an available card; a hidden card always stays hidden.
function VisualSettingsPanel() {
  const settings = useVisualSettings()
  const setPublished = useSetPublishedVisuals()
  const setHidden = useSetHiddenVisuals()
  const published = new Set(settings.data?.released_ids || [])
  const hidden = new Set(settings.data?.disabled_ids || [])
  const saving = setPublished.isPending || setHidden.isPending

  const togglePublished = (id) => {
    const next = new Set(published)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPublished.mutate([...next])
  }

  const toggleHidden = (id) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setHidden.mutate([...next])
  }

  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Built-in visuals</h2>
        <p className='text-caption text-ink-muted mt-1'>
          Available controls your admin Visuals gallery. Published controls the
          team gallery; hidden visuals remain unpublished until they are made
          available again.
        </p>
      </div>
      <div className='surface-card p-5'>
        {settings.isLoading ? (
          <div className='flex justify-center py-4'><Spinner /></div>
        ) : settings.isError ? (
          <Alert type='error'>Failed to load visual settings.</Alert>
        ) : (
          <div className='divide-y divide-border/60'>
            {ANALYSES.map((analysis) => {
              const isHidden = hidden.has(analysis.id)
              const isPublished = published.has(analysis.id)
              return (
                <div key={analysis.id} className='py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5'>
                  <div className={`min-w-0 ${isHidden ? 'opacity-50' : ''}`}>
                    <p className='text-body-strong break-words'>{analysis.title}</p>
                    <p className='text-caption text-ink-subtle break-words'>{analysis.description}</p>
                  </div>
                  <div className='flex items-center gap-5 sm:ml-auto shrink-0'>
                    <SwitchField className='w-32 justify-end'
                      label={isHidden ? 'Hidden' : 'Available'}
                      srLabel={`Show ${analysis.title} in the admin Visuals gallery`}
                      checked={!isHidden} disabled={saving}
                      onChange={() => toggleHidden(analysis.id)} />
                    <SwitchField className='w-36 justify-end'
                      label={isPublished ? 'Published' : 'Admin only'}
                      srLabel={`Publish ${analysis.title} to the team`}
                      checked={isPublished} disabled={saving || isHidden}
                      onChange={() => togglePublished(analysis.id)} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {(setPublished.isError || setHidden.isError) && (
          <Alert type='error' className='mt-3'>Could not save the visual setting.</Alert>
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
          Updated {meta.updated_at ? new Date(meta.updated_at).toLocaleString() : '—'}
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
    </Stack>
  )
}

// Editable display name per account, so task assignees and figure authors read
// as real names instead of a mix of emails and short UIDs. One row per account
// (env admins + granted partners); the email/uid fallback is shown so you know
// who's who. Saving a blank name clears it (reverts to the fallback).
function TeamNameRow({ member, onSave, saving }) {
  const [name, setName] = useState(member.name || '')
  useEffect(() => { setName(member.name || '') }, [member.name])
  const dirty = name.trim() !== (member.name || '')
  return (
    <div className='py-2 flex items-center gap-3'>
      <div className='min-w-0 w-56 shrink-0'>
        <p className='text-body break-words'>{member.email || <span className='font-mono text-caption'>{member.uid}</span>}</p>
        <p className='text-tag text-ink-subtle'>{member.is_admin ? 'admin' : 'partner'}{member.email ? ` · ${member.uid.slice(0, 10)}…` : ''}</p>
      </div>
      <Input className='flex-1' value={name} onChange={(e) => setName(e.target.value)} placeholder='Display name' />
      <Button variant={dirty ? 'primary' : 'ghost'} disabled={!dirty || saving}
        onClick={() => onSave(member.uid, name.trim())}>Save</Button>
    </div>
  )
}

function TeamNamesPanel() {
  const team = useTeam()
  const setName = useSetTeamName()
  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Team names</h2>
        <p className='text-caption text-ink-muted mt-1'>
          Give each account a display name. It's what shows for task assignees
          and figure authors everywhere in the console — instead of the mix of
          emails and UIDs. Clear a name to fall back to the email/UID.
        </p>
      </div>
      <div className='surface-card p-5'>
        {team.isLoading ? <Spinner /> : team.isError ? (
          <Alert type='error'>Failed to load the team.</Alert>
        ) : !(team.data?.rows || []).length ? (
          <p className='text-caption text-ink-subtle'>No accounts yet — grant a partner or set ADMIN_UIDS.</p>
        ) : (
          <div className='divide-y divide-border/60'>
            {team.data.rows.map((m) => (
              <TeamNameRow key={m.uid} member={m} saving={setName.isPending}
                onSave={(uid, name) => setName.mutate({ uid, name })} />
            ))}
          </div>
        )}
        {setName.isError && <Alert type='error' className='mt-3'>Could not save the name.</Alert>}
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
          Granted accounts can audit and browse the research dataset. Normally
          you'll approve people from Sign-in requests (they appear there the
          moment they try to sign in); this form pre-grants a Firebase UID
          directly, e.g. before someone's first sign-in.
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
