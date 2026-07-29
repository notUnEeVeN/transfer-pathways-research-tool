import React, { useMemo, useState } from 'react'
import {
  AcademicCapIcon, ArrowLeftIcon, ArrowRightIcon, ArrowTopRightOnSquareIcon,
  BuildingLibraryIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import {
  Panel, StatStrip, Badge, Button, Select, Input, Spinner, Alert, EmptyState, Stack,
  PageContainer, Tabs, Switch,
} from '../components/ui'
import SubNav from '../components/SubNav'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import { InstitutionRail } from '../DataPage'
import {
  useMdSummary, useMdInstitutions, useMdPrograms, useMdAgreements, useMdAgreement,
  useMdCollegeRollup,
} from './useMaryland'
import { toLedgerMajor, courseLookups, COLLAPSE_ABOVE } from './toLedger'

/**
 * Maryland (ARTSYS) explorer — the second state, kept deliberately apart.
 *
 * Organized to mirror the California Data page so a reader familiar with one
 * console finds the same information in the same place in the other:
 *
 *   Overview            — corpus counts and import validation (California's
 *                          dataset summary, minus what Maryland doesn't have)
 *   Community Colleges  — college list → college drill-in → agreements through
 *                          the shared RequirementsLedger (California's
 *                          college-first browser)
 *   Universities        — receiving-institution rail → per-university programs
 *                          (California's UC Campuses hub)
 *
 * Tabs California has and Maryland cannot back (Prerequisites, Districts) are
 * omitted rather than stubbed. Data lives in its own artsys_* collections and
 * id namespace; nothing here reads or writes California records. Read-only:
 * the corpus is script-imported, not hand-curated.
 */

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'articulation', label: 'Community Colleges' },
  { value: 'institutions', label: 'Universities' },
]

const ROUTES = {
  overview: { path: '/api/md/summary' },
  articulation: { path: '/api/md/college-rollup' },
  institutions: { path: '/api/md/institutions?kind=university' },
}

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)
const num = (v) => (v == null ? '—' : Number(v).toLocaleString())

export default function MarylandPage() {
  const [tab, setTab] = useState('overview')
  return (
    <div className='h-full flex flex-col'>
      <SubNav tabs={{ value: tab, onChange: setTab, options: TABS }} route={ROUTES[tab]} />
      <div className='flex-1 min-h-0 overflow-auto'>
        <PageContainer>
          {tab === 'overview' && <Overview />}
          {tab === 'articulation' && <CommunityColleges />}
          {tab === 'institutions' && <Universities />}
        </PageContainer>
      </div>
    </div>
  )
}

// ───────── overview ─────────

/** Corpus counts, straight from stored documents — no derived rates. Tile
 *  order mirrors the California overview strip (refreshed first, then the
 *  corpus counts, largest primitive to smallest). */
function Overview() {
  const summary = useMdSummary()
  if (summary.isPending) return <Loading label='Loading Maryland corpus…' />
  if (summary.isError) return <LoadFailed error={summary.error} what='the Maryland summary' />
  const d = summary.data

  return (
    <Stack gap='comfortable'>
      <Alert type='info'>
        <strong>Maryland is a separate corpus.</strong> It lives in its own
        {' '}<code>artsys_*</code> collections with its own id namespace
        {' '}(<code>md:cc:</code>, <code>md:uni:</code>) and shares no data with the
        California/ASSIST console. Nothing on this page reads or writes California records.
      </Alert>

      <StatStrip tiles={[
        { label: 'Imported', value: d.imported_at ? new Date(d.imported_at).toLocaleDateString() : '—' },
        { label: 'Agreements', value: num(d.agreements) },
        { label: 'Programs', value: num(d.programs) },
        { label: 'Universities', value: num(d.universities) },
        { label: 'Colleges', value: num(d.colleges) },
        { label: 'Courses', value: num(d.courses), sub: `${num(d.sending_courses)} sending · ${num(d.receiving_courses)} receiving` },
      ]} />

      <UniversityLandscape />
    </Stack>
  )
}

/** What the corpus actually holds, per receiving university: how many programs
 *  each publishes transfer guides for, how many rendered guides that is, and
 *  how widely the average program is written — the Maryland analog of
 *  California's associate-degree landscape rows. */
function UniversityLandscape() {
  const programs = useMdPrograms()
  if (programs.isError) return null
  const loading = programs.isPending
  const rows = programs.data?.rows || []

  const byUniversity = new Map()
  for (const r of rows) {
    const u = byUniversity.get(r.university_id) || { name: r.university_name, programs: 0, guides: 0 }
    u.programs += 1
    u.guides += r.colleges || 0
    byUniversity.set(r.university_id, u)
  }
  const universities = [...byUniversity.values()].sort((a, b) => b.programs - a.programs)
  const avgPrograms = universities.length
    ? Math.round(rows.length / universities.length)
    : null

  return (
    <section aria-label='University landscape'>
      <div className='flex flex-wrap items-baseline gap-2.5 mb-2.5'>
        <p className='text-label'>Programs on file, by receiving university</p>
        {!loading && avgPrograms != null && (
          <span className='text-tag text-ink-subtle'>
            {universities.length} universities · {avgPrograms} programs each on average
          </span>
        )}
      </div>
      <div className='surface-card overflow-hidden'>
        {loading ? (
          <div className='px-[22px] py-6 flex justify-center'><Spinner /></div>
        ) : !universities.length ? (
          <p className='px-[22px] py-5 text-caption text-ink-subtle'>No programs on file yet.</p>
        ) : universities.map((u, i) => (
          <div key={u.name}
            className={`grid grid-cols-[minmax(0,1.6fr)_1fr_1fr_1.2fr] gap-3.5 items-center px-[22px] py-3 ${i ? 'border-t border-border' : ''}`}>
            <p className='text-body-strong truncate min-w-0'>{u.name}</p>
            <span className='text-caption text-ink-muted whitespace-nowrap'>
              <span className='tabular text-ink font-[550]'>{num(u.programs)}</span> programs
            </span>
            <span className='text-caption text-ink-muted whitespace-nowrap'>
              <span className='tabular text-ink font-[550]'>{num(u.guides)}</span> guides
            </span>
            <span className='text-caption text-ink-muted whitespace-nowrap'>
              <span className='tabular text-ink font-[550]'>{u.programs ? Math.round(u.guides / u.programs) : '—'}</span> colleges per program
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ───────── community colleges (college-first, like California) ─────────

export function CommunityColleges() {
  const [collegeId, setCollegeId] = useState(null)
  return collegeId != null
    ? <CollegeAgreements collegeId={collegeId} onBack={() => setCollegeId(null)} />
    : <CollegeList onPick={setCollegeId} />
}

// The college table's grid columns — shared by the header row and every data
// row so the two can never drift out of alignment (California's idiom).
const COLLEGE_TABLE_COLS = 'grid grid-cols-[minmax(0,1fr)_110px_130px_150px_68px] gap-3.5'

/** Landing list: every Maryland college with its engine-verdict rates —
 *  the analog of California's college list with verification dots. */
function CollegeList({ onPick }) {
  const [q, setQ] = useState('')
  const [major, setMajor] = useState('')
  const rollup = useMdCollegeRollup({ major: major.trim() || null })

  const rows = useMemo(() => {
    const all = rollup.data?.rows || []
    const s = q.trim().toLowerCase()
    return s ? all.filter((r) => String(r.college_name).toLowerCase().includes(s)) : all
  }, [rollup.data, q])

  return (
    <Stack gap='comfortable'>
      <div className='flex items-center gap-2.5'>
        <label className='flex-1 flex items-center gap-3 bg-surface border-[1.5px] border-border-strong rounded-pill px-5 py-3'>
          <MagnifyingGlassIcon className='w-[17px] h-[17px] text-ink-muted shrink-0' />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label='Search colleges'
            placeholder='Search colleges…'
            className='flex-1 bg-transparent outline-none border-none text-body text-ink placeholder:text-ink-subtle' />
        </label>
        <label className='w-[280px] flex items-center gap-3 bg-surface border-[1.5px] border-border-strong rounded-pill px-5 py-3'>
          <input value={major} onChange={(e) => setMajor(e.target.value)}
            aria-label='Scope rates to a program'
            placeholder='Scope rates to a program…'
            className='flex-1 bg-transparent outline-none border-none text-body text-ink placeholder:text-ink-subtle' />
        </label>
      </div>

      {rollup.isPending && <Loading label='Computing per-college verdicts…' />}
      {rollup.isError && <LoadFailed error={rollup.error} what='the college rollup' />}

      {rollup.data && (
        <div className='surface-card overflow-auto max-h-[65vh]'>
          <div className={`${COLLEGE_TABLE_COLS} px-5 py-3 border-b border-border sticky top-0 bg-surface`}>
            <span className='text-label'>Community college</span>
            <span className='text-label text-right'>Agreements</span>
            <span className='text-label text-right'>Complete rate</span>
            <span className='text-label text-right'>Blocking-gap rate</span>
            <span className='text-label' />
          </div>
          {rows.map((r) => (
            <div key={r.college_id}
              className={`${COLLEGE_TABLE_COLS} items-center px-5 py-3 border-b border-border last:border-0 hover:bg-surface-hover cursor-pointer`}
              onClick={() => onPick(r.college_id)}>
              <p className='text-body-strong truncate min-w-0'>{r.college_name}</p>
              <span className='text-body text-right tabular-nums'>{num(r.agreements)}</span>
              <span className='text-body text-right tabular-nums font-medium'>{pct(r.complete_rate)}</span>
              <span className='text-body text-right tabular-nums'>{pct(r.binding_rate)}</span>
              <span className='flex items-center justify-end gap-1 text-caption font-[550] text-success'>
                view <ArrowRightIcon className='w-[13px] h-[13px]' />
              </span>
            </div>
          ))}
          {!rows.length && (
            <p className='px-5 py-8 text-body text-ink-muted text-center'>
              No colleges match these filters.
            </p>
          )}
          {rows.length > 0 && (
            <p className='px-5 py-3 border-t border-border sticky bottom-0 bg-surface text-caption text-ink-subtle'>
              <strong>Complete rate</strong> is the eligibility-engine verdict and respects
              choose-N logic. <strong>Blocking-gap rate</strong> counts only requirements with
              no equivalent inside groups the engine reports unsatisfied.
            </p>
          )}
        </div>
      )}
    </Stack>
  )
}

/** Receiving-university bubbles — California's ReceivingCampusPicker, with the
 *  same classes, over Maryland's university list. */
function ReceivingUniversityPicker({ universities, universityId, onSelect }) {
  return (
    <div className='min-w-0'>
      <span className='text-label'>Receiving university</span>
      {/* Maryland has more receiving institutions than California has campuses,
          so free-wrapping pills read as clutter. A fixed-min column grid keeps
          every pill the same width and the rows aligned. */}
      <div className='mt-2 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1.5'>
        {universities.map((candidate) => {
          const active = String(candidate._id) === String(universityId)
          return (
            <button key={candidate._id} type='button' aria-pressed={active}
              onClick={() => onSelect(candidate._id)} title={candidate.name}
              className={`px-[15px] py-[7px] rounded-pill text-caption truncate text-center border transition-colors ${
                active
                  ? 'bg-primary hover:bg-primary-hover text-on-primary border-primary font-[650]'
                  : 'bg-surface ink-muted border-border-strong font-medium hover:border-primary'
              }`}>
              {candidate.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Filter on the engine verdict and on BINDING gaps, never on the raw
// not-articulated count: every Maryland agreement has a nonzero raw count
// (unchosen alternatives in choose-one lists), so "has gaps" on that basis
// selects everything and tells the reader nothing.
const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'complete', label: 'Complete path' },
]

/** One college opened: back affordance, university bubbles, then the filtered
 *  agreement list beside the full requirement tree. Master-detail rather than
 *  California's stacked cards because a Maryland college can hold hundreds of
 *  program guides per university. */
function CollegeAgreements({ collegeId, onBack }) {
  const colleges = useMdInstitutions('community_college')
  const universities = useMdInstitutions('university')
  const [universityId, setUniversityId] = useState('')
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')
  const [agreementId, setAgreementId] = useState(null)

  const college = (colleges.data?.rows || []).find((r) => String(r._id) === String(collegeId))
  const universityRows = universities.data?.rows || []
  // A university is always selected, like California's receiving-campus
  // picker: opening a college starts on the first university rather than an
  // unscoped all-universities listing.
  const activeUniversityId = universityId || universityRows[0]?._id || null

  // verdicts=1 so the status filter and the per-row gap counts are real engine
  // output rather than a guess from the header projection.
  const agreements = useMdAgreements({
    collegeId,
    universityId: activeUniversityId,
    verdicts: true,
  })

  const filtered = useMemo(() => {
    let rows = agreements.data?.rows || []
    const needle = q.trim().toLowerCase()
    if (needle) rows = rows.filter((r) => `${r.major} ${r.university_name}`.toLowerCase().includes(needle))
    if (status === 'complete') rows = rows.filter((r) => r.complete_path_exists)
    return rows
  }, [agreements.data, q, status])

  return (
    <Stack gap='cozy'>
      <div className='flex items-center'>
        <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={onBack}>All colleges</Button>
      </div>
      <div className='surface-card px-6 py-5'>
        <p className='text-label'>Community college</p>
        <h2 className='mt-1.5 heading-card'>{college?.name || 'Community college'}</h2>
      </div>
      <ReceivingUniversityPicker universities={universityRows}
        universityId={activeUniversityId}
        onSelect={(id) => {
          setUniversityId(id)
          setAgreementId(null)
        }} />
      <div className='flex flex-wrap items-end gap-3'>
        <div className='min-w-[240px] flex-1'>
          <Input label='Program or university contains' value={q}
            onChange={(e) => setQ(e.target.value)} placeholder='e.g. Computer Science' />
        </div>
        <div>
          <label className='field-label'>Status</label>
          <Tabs value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        </div>
      </div>

      {agreements.isPending && <Loading label='Loading agreements…' />}
      {agreements.isError && <LoadFailed error={agreements.error} what='these agreements' />}

      {agreements.data && (
        <div className='grid grid-cols-1 xl:grid-cols-[minmax(340px,420px)_1fr] gap-5 items-start'>
          <Panel title={`${filtered.length} agreement${filtered.length === 1 ? '' : 's'}`} padded={false}>
            <div className='max-h-[62vh] overflow-auto'>
              {filtered.map((row) => (
                <button key={row._id} type='button' onClick={() => setAgreementId(row._id)}
                  className={`w-full text-left px-5 py-3 border-b border-border last:border-b-0 hover:bg-surface-hover ${
                    agreementId === row._id ? 'bg-surface-hover' : ''}`}>
                  <div className='text-body font-medium truncate'>{row.major}</div>
                  <div className='text-caption truncate'>{row.university_name}</div>
                  {row.missing != null && (
                    <div className='mt-1 flex items-center gap-1.5'>
                      <Badge variant={row.complete_path_exists ? 'success' : 'neutral'}>
                        {row.complete_path_exists ? 'complete' : 'incomplete'}
                      </Badge>
                      {row.binding > 0 && <Badge variant='danger'>{row.binding} blocking</Badge>}
                    </div>
                  )}
                </button>
              ))}
              {!filtered.length && <p className='text-caption px-5 py-4'>No agreement matches that filter.</p>}
            </div>
          </Panel>
          <AgreementDetail id={agreementId} />
        </div>
      )}
    </Stack>
  )
}

function AgreementDetail({ id }) {
  const [onlyGaps, setOnlyGaps] = useState(false)
  const [expandLists, setExpandLists] = useState(false)
  const agreement = useMdAgreement(id)

  const ledger = useMemo(() => {
    if (!agreement.data) return null
    return {
      major: toLedgerMajor(agreement.data, {
        onlyGaps,
        collapseAbove: expandLists ? Infinity : COLLAPSE_ABOVE,
      }),
      ...courseLookups(agreement.data.courses || []),
    }
  }, [agreement.data, onlyGaps, expandLists])

  // How many rows the collapse is actually hiding, so the toggle says what it
  // does rather than being a mystery switch.
  const collapsedRows = useMemo(() => {
    if (!agreement.data) return 0
    return toLedgerMajor(agreement.data, {})?.requirement_groups
      .flatMap((g) => g.sections.flatMap((s) => s.receivers))
      .filter((r) => r.collapsed_count).length ?? 0
  }, [agreement.data])

  if (!id) {
    return <EmptyState icon={AcademicCapIcon} title='Select an agreement'
      description='The full requirement tree appears here, in the same ASSIST-style layout the California console uses.' />
  }
  if (agreement.isPending) return <Loading label='Loading requirement tree…' />
  if (agreement.isError) return <LoadFailed error={agreement.error} what='this agreement' />

  const d = agreement.data
  const s = d.summary

  return (
    <Stack gap='cozy'>
      <Panel title={d.major} icon={AcademicCapIcon}
        action={<div className='flex items-center gap-2'>
          {d.source_url && (
            // Straight to the ARTSYS page this document was parsed from, so any
            // row can be checked against the source without reconstructing a URL.
            <a href={d.source_url} target='_blank' rel='noreferrer noopener'
              className='inline-flex items-center gap-1 text-caption underline hover:no-underline'>
              View on ARTSYS
              <ArrowTopRightOnSquareIcon className='w-3.5 h-3.5' />
            </a>
          )}
          <Badge variant={d.complete_path_exists ? 'success' : 'neutral'}>
            {d.complete_path_exists ? 'Complete path exists' : 'Incomplete'}
          </Badge>
        </div>}>
        <Stack gap='cozy'>
          <p className='text-caption'>
            {d.college_name} → {d.university_name}
            {d.effective ? ` · effective ${d.effective}` : ''}
          </p>
          <StatStrip bare tiles={[
            { label: 'Requirement groups', value: num(s.groups) },
            { label: 'Receivers', value: num(s.receivers) },
            { label: 'Blocking gaps', value: num(s.binding), tone: s.binding ? 'danger' : undefined },
            { label: 'No equivalent (raw)', value: num(s.missing) },
          ]} />
          <div className='flex flex-wrap items-center gap-x-6 gap-y-2'>
            <label className='flex items-center gap-2 cursor-pointer'>
              <Switch checked={onlyGaps} onChange={setOnlyGaps} />
              <span className='text-caption'>Only requirements with no equivalent</span>
            </label>
            {collapsedRows > 0 && (
              <label className='flex items-center gap-2 cursor-pointer'>
                <Switch checked={expandLists} onChange={setExpandLists} />
                <span className='text-caption'>
                  List every course in {collapsedRows} broad requirement{collapsedRows === 1 ? '' : 's'}
                </span>
              </label>
            )}
          </div>
          <p className='text-caption'>
            <strong>Blocking gaps</strong> are requirements with no equivalent inside a group
            the eligibility engine reports unsatisfied — the ones that actually stop this
            student. <strong>No equivalent (raw)</strong> counts every not-articulated
            receiver, including unchosen alternatives in satisfied choose-one lists (a
            language requirement listing fifteen options marks fourteen), so it runs several
            times higher and is shown only because it is what the document literally says.
          </p>
        </Stack>
      </Panel>

      {/* The same renderer the California agreement views use. showCompletion is
          off because there is no student here — completion ticks would assert a
          transcript that does not exist. preserveOrder keeps ARTSYS's own
          ordering rather than sorting required-first. */}
      {ledger?.major ? (
        <RequirementsLedger
          major={ledger.major}
          courses={ledger.sending}
          universityCoursesById={ledger.universityCoursesById}
          showCompletion={false}
          preserveOrder
        />
      ) : (
        <EmptyState icon={AcademicCapIcon} title='No requirements without an equivalent'
          description='Every requirement in this guide has at least one qualifying course at this college.' />
      )}
    </Stack>
  )
}

// ───────── universities (receiving-institution hub, like UC Campuses) ─────────

export function Universities() {
  const universities = useMdInstitutions('university')
  const [selectedId, setSelectedId] = useState(null)

  if (universities.isPending) return <Loading label='Loading universities…' />
  if (universities.isError) return <LoadFailed error={universities.error} what='the universities' />

  const items = (universities.data?.rows || []).map((r) => ({ id: r._id, name: r.name }))
  const selected = items.find((i) => String(i.id) === String(selectedId)) || null

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start'>
      <InstitutionRail items={items} selectedId={selectedId} title='Universities'
        onSelect={setSelectedId} />
      {!selected ? (
        <EmptyState icon={BuildingLibraryIcon} title='Choose a university'
          description='Pick one from the list to see the programs it publishes transfer guides for.' />
      ) : (
        <UniversityPrograms university={selected} />
      )}
    </div>
  )
}

/** Every program the selected university publishes guides for, with how many
 *  colleges each guide is rendered for. */
function UniversityPrograms({ university }) {
  const programs = useMdPrograms({ universityId: university.id })

  if (programs.isPending) return <Loading label='Loading programs…' />
  if (programs.isError) return <LoadFailed error={programs.error} what='these programs' />
  const rows = programs.data?.rows || []

  return (
    <Stack gap='cozy'>
      <div className='surface-card px-6 py-5'>
        <p className='text-label'>Receiving university</p>
        <h2 className='mt-1.5 heading-card'>{university.name}</h2>
        <p className='mt-1 text-body text-ink-muted'>
          {rows.length} program{rows.length === 1 ? '' : 's'} with published transfer guides
        </p>
      </div>
      <Panel title={`${rows.length} program${rows.length === 1 ? '' : 's'}`} padded={false}>
        <div className='overflow-auto max-h-[65vh]'>
          <table className='w-full text-body'>
            <thead className='surface-sunken sticky top-0'>
              <tr className='text-label'>
                <th className='text-left px-5 py-2.5'>Program</th>
                <th className='text-right px-5 py-2.5'>Colleges with a guide</th>
                <th className='text-right px-5 py-2.5'>Effective</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.university_id}:${r.major}`} className='border-t border-border'>
                  <td className='px-5 py-2.5 truncate'>{r.major}</td>
                  <td className='px-5 py-2.5 text-right tabular-nums'>{num(r.colleges)}</td>
                  <td className='px-5 py-2.5 text-right text-ink-subtle'>{r.effective || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className='text-caption px-5 py-4'>No programs found for this university.</p>
          )}
        </div>
      </Panel>
    </Stack>
  )
}

function Loading({ label }) {
  return (
    <div className='flex items-center gap-3 py-10 justify-center'>
      <Spinner /> <span className='text-caption'>{label}</span>
    </div>
  )
}

function LoadFailed({ error, what }) {
  const status = error?.response?.status
  return (
    <Alert type='error'>
      Could not load {what}
      {status ? ` (HTTP ${status})` : ''}. If the Maryland collections have not been imported
      yet, run <code>npm run artsys:import:local</code> in <code>server/</code>.
    </Alert>
  )
}
