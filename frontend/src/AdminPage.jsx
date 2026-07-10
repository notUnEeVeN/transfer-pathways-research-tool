import React, { useEffect, useState } from 'react'
import { TrashIcon, CheckIcon, NoSymbolIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, EmptyState, Stack, Input, Checkbox, SwitchField } from './components/ui'
import { useQueryClient } from '@tanstack/react-query'
import { ANALYSES } from './analyses/registry'
import {
  useAdminDataset, useAdminAccessList, useGrantAccess, useRevokeAccess,
  useVisibleMajors, useSetVisibleMajors, useRefreshStatus, useStartRefresh,
  useAccessRequests, useBlockAccessRequest, useBlockedAccounts, useUnblockAccount,
  useAnalysisReleases, useSetAnalysisReleases, useSetAnalysisDisabled,
  useFigureRunner, useSetFigureRunner, useTeam, useSetTeamName,
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
        <SignInRequestsPanel />
        <BlockedAccountsPanel />
        <TeamNamesPanel />
        <MajorAccessPanel />
        <AnalysisReleasePanel />
        <FigureRunnerPanel />
        <RefreshPanel />
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

// Re-port the currently ported majors from the source DB (where the parser
// writes) — for after parser updates. Background job on the server; this
// panel polls until it finishes. Note: the parser rebuild regenerates
// agreement _ids, so verdicts recorded on replaced docs are orphaned.
function RefreshPanel() {
  const qc = useQueryClient()
  const status = useRefreshStatus()
  const start = useStartRefresh()
  const s = status.data
  const running = !!s?.running

  // When a run finishes, every dataset-derived view is stale — refetch broadly.
  const wasRunning = React.useRef(false)
  useEffect(() => {
    if (wasRunning.current && !running) qc.invalidateQueries()
    wasRunning.current = running
  }, [running, qc])

  if (!s) return null
  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Refresh dataset</h2>
        <p className='text-caption text-ink-muted mt-1'>
          Re-ports every currently ported major from the source database (where
          the parser writes) — use after parser updates. Agreements are
          replaced wholesale with fresh parser output; verdicts recorded on
          replaced agreements are retired with them.
        </p>
      </div>
      <div className='surface-card p-5'>
        {!s.configured ? (
          <Alert type='info'>
            No source database configured on this server (SOURCE_MONGO_URI) —
            refresh with <span className='font-mono'>python port.py</span> from the admin machine instead.
          </Alert>
        ) : (
          <Stack gap='cozy'>
            <div className='flex items-center gap-3'>
              <Button onClick={() => start.mutate()} disabled={running || start.isPending}>
                {running ? 'Refreshing…' : 'Refresh from source'}
              </Button>
              {running && (
                <span className='inline-flex items-center gap-2 text-caption text-ink-muted'>
                  <Spinner /> {s.step || 'working'}…
                </span>
              )}
            </div>
            {start.isError && (
              <Alert type='error'>{start.error?.response?.data?.error || 'Could not start the refresh.'}</Alert>
            )}
            {!running && s.error && <Alert type='error'>Last refresh failed: {s.error}</Alert>}
            {!running && s.result && (
              <div className='text-caption text-ink-muted'>
                <p>
                  Last refresh → <span className='font-mono text-ink'>{s.result.dataset_version}</span>
                  {s.finishedAt ? ` · ${new Date(s.finishedAt).toLocaleString()}` : ''}
                </p>
                <p className='mt-1'>
                  {Number(s.result.agreements_after).toLocaleString()} agreements
                  {' '}(was {Number(s.result.agreements_before).toLocaleString()})
                  {' '}· {s.result.majors_refreshed} majors
                  {' '}· courses +{s.result.courses_upserted}/−{s.result.courses_pruned}
                  {' '}· university courses +{s.result.university_courses_upserted}/−{s.result.university_courses_pruned}
                </p>
                {(s.result.majors_missing_in_source || []).length > 0 && (
                  <Alert type='warning' className='mt-2'>
                    Majors no longer found in the source (renamed by the parser?):{' '}
                    {s.result.majors_missing_in_source.join(' · ')} — port their new names
                    with <span className='font-mono'>port.py add</span> or check the parser output.
                  </Alert>
                )}
              </div>
            )}
          </Stack>
        )}
      </div>
    </Stack>
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

// Which live analyses partners see on Data → Analysis, and which are enabled
// at all. Enabled off = disabled: hidden from EVERYONE (you included) and
// never mounted, so nothing is fetched or computed — park work-in-progress
// analyses and bring them back one at a time. Released off = hidden from
// partners only (you still preview it, badged Draft). Toggling sends the full
// id set; switches disable briefly during the save so quick flips can't race
// a stale set.
function AnalysisReleasePanel() {
  const q = useAnalysisReleases()
  const save = useSetAnalysisReleases()
  const saveDisabled = useSetAnalysisDisabled()
  const released = new Set(q.data?.released_ids || [])
  const disabled = new Set(q.data?.disabled_ids || [])
  const saving = save.isPending || saveDisabled.isPending

  const toggleReleased = (id) => {
    const next = new Set(released)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    save.mutate([...next])
  }
  const toggleDisabled = (id) => {
    const next = new Set(disabled)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    saveDisabled.mutate([...next])
  }

  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Analysis releases</h2>
        <p className='text-caption text-ink-muted mt-1'>
          Enabled off removes the analysis from the Visuals tab for everyone —
          you included — and skips its computation entirely, until you switch it
          back on to work on it. Of the enabled ones, Released controls what
          partners see (off = you preview it, badged Draft).
        </p>
      </div>
      <div className='surface-card p-5'>
        {q.isLoading ? (
          <div className='flex justify-center py-4'><Spinner /></div>
        ) : q.isError ? (
          <Alert type='error'>Failed to load analysis releases.</Alert>
        ) : !ANALYSES.length ? (
          <p className='text-caption text-ink-subtle'>No analyses registered yet.</p>
        ) : (
          <div className='divide-y divide-border/60'>
            {ANALYSES.map((a) => {
              const off = disabled.has(a.id)
              const on = released.has(a.id)
              return (
                <div key={a.id} className='py-2.5 flex items-center gap-5'>
                  <div className={`min-w-0 ${off ? 'opacity-50' : ''}`}>
                    <p className='text-body-strong break-words'>{a.title}</p>
                    <p className='text-caption text-ink-subtle break-words'>{a.description || a.source || a.id}</p>
                  </div>
                  <SwitchField className='ml-auto shrink-0' label={off ? 'Disabled' : 'Enabled'}
                    srLabel={`Enable ${a.title} on the Visuals tab`} checked={!off}
                    disabled={saving} onChange={() => toggleDisabled(a.id)} />
                  <SwitchField className='shrink-0' label={on ? 'Released' : 'Draft'}
                    srLabel={`Release ${a.title} to partners`} checked={on}
                    disabled={saving || off} onChange={() => toggleReleased(a.id)} />
                </div>
              )
            })}
          </div>
        )}
        {(save.isError || saveDisabled.isError) && (
          <Alert type='error' className='mt-3'>Could not save the change. Try again.</Alert>
        )}
      </div>
    </Stack>
  )
}

// Global stop button for scheduled live-figure refreshes (partner scripts the
// server re-runs on data changes). Paused stops the scheduler only —
// publish_script and per-figure Refresh still work — and pending version
// bumps/curation drift are caught up after resuming.
function FigureRunnerPanel() {
  const q = useFigureRunner()
  const save = useSetFigureRunner()
  const paused = !!q.data?.paused

  return (
    <Stack gap='comfortable'>
      <div>
        <h2 className='text-heading'>Live figure runner</h2>
        <p className='text-caption text-ink-muted mt-1'>
          Live figures re-run their scripts automatically after dataset ports and
          curation changes. Pause this if a script misbehaves or during heavy
          audit sessions — nothing is lost; refreshes catch up when resumed.
        </p>
      </div>
      <div className='surface-card p-5'>
        {q.isLoading ? (
          <div className='flex justify-center py-4'><Spinner /></div>
        ) : q.isError ? (
          <Alert type='error'>Failed to load the runner state.</Alert>
        ) : (
          <div className='flex items-center gap-5'>
            <div className='min-w-0'>
              <p className='text-body-strong'>Scheduled refreshes</p>
              <p className='text-caption text-ink-subtle'>
                {paused ? 'Paused — live figures keep their last render.' : 'Running — refreshes on version bumps and curation drift.'}
              </p>
            </div>
            <SwitchField className='ml-auto shrink-0' label={paused ? 'Paused' : 'Running'}
              srLabel='Pause scheduled live-figure refreshes' checked={!paused}
              disabled={save.isPending} onChange={() => save.mutate(!paused)} />
          </div>
        )}
        {save.isError && <Alert type='error' className='mt-3'>Could not save the change. Try again.</Alert>}
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
