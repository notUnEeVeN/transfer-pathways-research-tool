import React, { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, ArrowDownTrayIcon, ClipboardIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, EmptyState, Stack, Tabs, Input, Select, LoadingLogo } from './components/ui'
import DatasetSummaryPanel from './components/DatasetSummaryPanel'
import { ANALYSES } from './analyses/registry'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import DocHead from './pages/Audit/components/DocHead'
import { useCourseList } from './pages/Audit/hooks/useCourseList'
import { useAuditDoc } from '@frontend/query/hooks/useAudit'
import {
  useColleges, useSchools, useCcCourses, useUniversityCourses, useAgreementsBatch,
  useRawAssist, useDataSummary, useCoverage,
} from '@frontend/query/hooks/useData'

/**
 * Data explorer — the partners' access point into the research database.
 * Everything shown is server-scoped to the caller's granted subset.
 *
 *   Overview            — dataset version, counts, majors per school
 *   Agreements          — college × school × major browser; each agreement
 *                         viewable three ways: the PMT requirements ledger
 *                         (the website's own rendering), the JSON document
 *                         exactly as our database stores it, and the raw
 *                         ASSIST.org API payload the parser consumed.
 *   CC courses          — the community-college course catalog (referenced
 *                         by the ported agreements), searchable per college
 *   University courses  — the UC-side catalog, searchable per campus
 */
export default function DataPage() {
  const [tab, setTab] = useState('overview')
  return (
    <div className='h-full flex flex-col'>
      <div className='shrink-0 flex items-center px-4 h-11 border-b border-border'>
        <Tabs value={tab} onChange={setTab}
          options={[
            { value: 'overview',   label: 'Overview' },
            { value: 'agreements', label: 'Agreements' },
            { value: 'cc',         label: 'CC courses' },
            { value: 'university', label: 'University courses' },
            { value: 'analysis',   label: 'Analysis' },
          ]} />
      </div>
      <div className='flex-1 min-h-0 overflow-auto'>
        <div className='mx-auto max-w-screen-2xl px-6 py-6'>
          {tab === 'overview' && <DatasetSummaryPanel />}
          {tab === 'agreements' && <AgreementsBrowser />}
          {tab === 'cc' && <CcCoursesBrowser />}
          {tab === 'university' && <UniversityCoursesBrowser />}
          {tab === 'analysis' && <AnalysisTab />}
        </div>
      </div>
    </div>
  )
}

// ───────── agreements (program-first) ─────────
//
// Navigation follows the working set: pick one of the granted campus PROGRAMS
// (school + major — the exact things the admin selected), then a college list
// with live articulation coverage (the papers' heatmap column), then the
// agreement itself. No blind dropdown pairing.

const pKey = (schoolId, major) => `${schoolId}|${major}`

function AgreementsBrowser() {
  const summary = useDataSummary()
  const coverage = useCoverage()
  const [program, setProgram] = useState(null) // { school_id, school, major }
  const [collegeId, setCollegeId] = useState(null)

  const programsBySchool = summary.data?.schools || []
  const nPrograms = programsBySchool.reduce((s, g) => s + g.majors.length, 0)

  // Coverage rows for the active program, keyed by college.
  const coverageByCc = useMemo(() => {
    const m = new Map()
    if (!program) return m
    for (const r of coverage.data?.rows || []) {
      if (Number(r.school_id) === Number(program.school_id) && r.major === program.major) {
        m.set(Number(r.community_college_id), r)
      }
    }
    return m
  }, [coverage.data, program])

  if (summary.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (summary.isError) return <Alert type='error'>Failed to load your dataset summary.</Alert>
  if (!nPrograms) {
    return <EmptyState title='No programs in scope'
      description='No majors are selected for your account yet — the project admin picks the subset.' />
  }

  // Auto-select when there's exactly one program.
  if (!program && nPrograms === 1) {
    const g = programsBySchool.find((s) => s.majors.length)
    setProgram({ school_id: g.school_id, school: g.school, major: g.majors[0] })
    return null
  }

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start'>
      {/* Program rail — the granted school+major pairs, grouped by campus */}
      <div className='surface-card p-3 lg:max-h-[75vh] overflow-auto'>
        <p className='text-label mb-2'>Programs in your subset · {nPrograms}</p>
        <Stack gap='cozy'>
          {programsBySchool.map((g) => (
            <div key={g.school_id}>
              <p className='text-caption text-ink-subtle mb-1'>{g.school}</p>
              {g.majors.map((m) => {
                const active = program && pKey(program.school_id, program.major) === pKey(g.school_id, m)
                return (
                  <button key={m} type='button'
                    onClick={() => { setProgram({ school_id: g.school_id, school: g.school, major: m }); setCollegeId(null) }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-md border transition-colors mb-0.5 ${
                      active ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-hover'}`}>
                    <span className='text-body break-words leading-snug'>{m}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </Stack>
      </div>

      {/* College coverage list → agreement detail */}
      {!program ? (
        <EmptyState title='Pick a program'
          description='Choose a campus program on the left to see how every community college articulates to it.' />
      ) : collegeId == null ? (
        <ProgramColleges program={program} coverageByCc={coverageByCc}
          coverageLoading={coverage.isLoading} onPick={setCollegeId} />
      ) : (
        <ProgramAgreement program={program} collegeId={collegeId} onBack={() => setCollegeId(null)} />
      )}
    </div>
  )
}

// Every college's articulation coverage for one program — one column of the
// papers' heatmap, doubling as navigation.
function ProgramColleges({ program, coverageByCc, coverageLoading, onPick }) {
  const colleges = useColleges()
  const [q, setQ] = useState('')

  const rows = useMemo(() => {
    const all = (colleges.data || [])
      .map((c) => ({ ...c, cov: coverageByCc.get(Number(c.id)) || null }))
      .sort((a, b) => (b.cov?.pct_articulated ?? -1) - (a.cov?.pct_articulated ?? -1) || a.name.localeCompare(b.name))
    if (!q.trim()) return all
    const s = q.toLowerCase()
    return all.filter((c) => c.name.toLowerCase().includes(s))
  }, [colleges.data, coverageByCc, q])

  const withAgreement = rows.filter((r) => r.cov).length

  return (
    <Stack gap='cozy'>
      <div>
        <p className='text-body-strong'>{program.major}</p>
        <p className='text-caption text-ink-muted'>
          {program.school} · {withAgreement} of {rows.length || 115} colleges have an agreement in scope — sorted by coverage
        </p>
      </div>
      <Input className='w-72' value={q} onChange={(e) => setQ(e.target.value)}
        placeholder='Find a college…' leadingIcon={MagnifyingGlassIcon} />
      {colleges.isLoading || coverageLoading ? (
        <div className='flex justify-center py-8'><Spinner /></div>
      ) : (
        <div className='surface-card overflow-auto max-h-[65vh]'>
          <table className='w-full text-left'>
            <thead className='sticky top-0 bg-surface border-b border-border'>
              <tr>
                <th className='px-3 py-2 text-label'>Community college</th>
                <th className='px-3 py-2 text-label whitespace-nowrap'>Coverage</th>
                <th className='px-3 py-2 text-label whitespace-nowrap'>Receivers</th>
                <th className='px-3 py-2 text-label' />
              </tr>
            </thead>
            <tbody className='divide-y divide-border/60'>
              {rows.map((c) => (
                <tr key={c.id}
                  className={c.cov ? 'hover:bg-surface-hover cursor-pointer' : 'opacity-50'}
                  onClick={() => c.cov && onPick(Number(c.id))}>
                  <td className='px-3 py-1.5 text-body'>{c.name}</td>
                  <td className='px-3 py-1.5'>
                    {c.cov ? <CoverageBar pct={c.cov.pct_articulated} full={c.cov.fully_articulated} /> :
                      <span className='text-caption text-ink-subtle'>no agreement in scope</span>}
                  </td>
                  <td className='px-3 py-1.5 text-caption font-mono tabular-nums text-ink-muted'>
                    {c.cov ? `${c.cov.receivers_articulated}/${c.cov.receivers_required}` : '—'}
                  </td>
                  <td className='px-3 py-1.5 text-caption text-ink-subtle text-right'>{c.cov ? 'view →' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Stack>
  )
}

function CoverageBar({ pct, full }) {
  const v = Math.max(0, Math.min(100, pct ?? 0))
  return (
    <span className='inline-flex items-center gap-2'>
      <span className='inline-block w-24 h-1.5 rounded-pill bg-surface-muted border border-border overflow-hidden'>
        <span className={`block h-full ${full ? 'bg-success/70' : 'bg-primary/60'}`} style={{ width: `${v}%` }} />
      </span>
      <span className='text-caption font-mono tabular-nums text-ink'>{pct != null ? `${pct}%` : '—'}</span>
    </span>
  )
}

// The agreement for (program × college): resolve its _id from the batch
// endpoint, then reuse the three-representation detail view.
function ProgramAgreement({ program, collegeId, onBack }) {
  const batch = useAgreementsBatch(collegeId, program.school_id)
  const agreement = useMemo(() => {
    const group = (batch.data || []).find((g) => Number(g.school_id) === Number(program.school_id))
    return (group?.agreements || []).find((a) => a.major === program.major) || null
  }, [batch.data, program])

  return (
    <Stack gap='cozy'>
      <div>
        <Button variant='ghost' leadingIcon={ArrowLeftIcon} onClick={onBack}>All colleges</Button>
      </div>
      {batch.isLoading ? (
        <div className='flex justify-center py-10'><LoadingLogo size={48} /></div>
      ) : !agreement ? (
        <EmptyState title='No agreement' description='This college has no agreement for the selected program in your scope.' />
      ) : (
        <AgreementDetail agreementId={agreement._id} />
      )}
    </Stack>
  )
}

// ───────── analysis (registry-driven; populated over time) ─────────

function AnalysisTab() {
  if (!ANALYSES.length) {
    return (
      <div className='mx-auto max-w-screen-md'>
        <EmptyState title='Analyses land here'
          description='This tab hosts statistical interpretations computed from the live, scoped API — the papers&apos; figures first (coverage heatmaps, credit-loss decomposition, choice cost), then new ones. Each analysis is a component registered in frontend/src/analyses/registry.js; because they read the live endpoints, a dataset refresh or subset change updates every figure automatically.' />
      </div>
    )
  }
  return (
    <Stack gap='section'>
      {ANALYSES.map(({ id, title, description, source, Component }) => (
        <section key={id}>
          <div className='mb-3'>
            <h2 className='text-heading'>{title}</h2>
            <p className='text-caption text-ink-muted'>
              {description}{source ? <> · <span className='text-ink-subtle'>{source}</span></> : null}
            </p>
          </div>
          <Component />
        </section>
      ))}
    </Stack>
  )
}

const downloadJson = (obj, filename) => {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function JsonPanel({ data, filename }) {
  return (
    <div className='surface-card'>
      <div className='flex items-center gap-2 px-3 py-2 border-b border-border'>
        <span className='text-caption text-ink-subtle font-mono'>{filename}</span>
        <div className='ml-auto flex gap-1'>
          <Button variant='ghost' leadingIcon={ClipboardIcon}
            onClick={() => navigator.clipboard.writeText(JSON.stringify(data, null, 2))}>Copy</Button>
          <Button variant='ghost' leadingIcon={ArrowDownTrayIcon}
            onClick={() => downloadJson(data, filename)}>Download</Button>
        </div>
      </div>
      <pre className='p-3 text-[11px] leading-relaxed font-mono overflow-auto max-h-[65vh] whitespace-pre'>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

function AgreementDetail({ agreementId }) {
  const [view, setView] = useState('ledger') // ledger | stored | raw
  const docQ = useAuditDoc(agreementId, 'uc')
  const raw = useRawAssist(agreementId, { enabled: view === 'raw' })
  const courses = useCourseList(docQ.data?.course_names)

  if (docQ.isLoading) return <div className='flex justify-center py-10'><LoadingLogo size={48} /></div>
  if (docQ.isError) return <Alert type='error'>Failed to load the agreement.</Alert>
  const doc = docQ.data?.doc
  if (!doc) return null

  const slug = `${doc.uc_school}-${doc.community_college}-${doc.major}`.replace(/[^a-z0-9]+/gi, '_')

  return (
    <Stack gap='cozy'>
      <DocHead doc={doc} assistUrl={docQ.data?.assist_url} />
      <Tabs value={view} onChange={setView}
        options={[
          { value: 'ledger', label: 'Rendered' },
          { value: 'stored', label: 'Stored JSON' },
          { value: 'raw',    label: 'Raw ASSIST API' },
        ]} />
      {view === 'ledger' && (
        <div className='uui-scope'>
          <RequirementsLedger major={doc} courses={courses}
            universityCoursesById={docQ.data?.university_courses || null} preserveOrder />
        </div>
      )}
      {view === 'stored' && <JsonPanel data={doc} filename={`${slug}.stored.json`} />}
      {view === 'raw' && (
        raw.isLoading ? <div className='flex justify-center py-10'><Spinner /></div>
        : raw.isError ? <Alert type='error'>{raw.error?.response?.data?.error || 'assist.org fetch failed.'}</Alert>
        : raw.data ? <JsonPanel data={raw.data} filename={`${slug}.assist-raw.json`} /> : null
      )}
    </Stack>
  )
}

// ───────── course catalogs ─────────

function CourseTable({ rows, columns }) {
  return (
    <div className='surface-card overflow-auto max-h-[70vh]'>
      <table className='w-full text-left'>
        <thead className='sticky top-0 bg-surface border-b border-border'>
          <tr>{columns.map((c) => <th key={c.key} className='px-3 py-2 text-label whitespace-nowrap'>{c.label}</th>)}</tr>
        </thead>
        <tbody className='divide-y divide-border/60'>
          {rows.map((r, i) => (
            <tr key={r._id || i} className='hover:bg-surface-hover'>
              {columns.map((c) => (
                <td key={c.key} className='px-3 py-1.5 text-caption text-ink-muted align-top'>
                  {c.render ? c.render(r) : (r[c.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const courseSearch = (rows, q, fields) => {
  if (!q.trim()) return rows
  const s = q.toLowerCase()
  return rows.filter((r) => fields.some((f) => String(r[f] ?? '').toLowerCase().includes(s)))
}

function CcCoursesBrowser() {
  const colleges = useColleges()
  const [collegeId, setCollegeId] = useState(null)
  const [q, setQ] = useState('')
  const coursesQ = useCcCourses(collegeId)

  const options = (colleges.data || [])
    .slice().sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: String(c.id), label: c.name }))
  const rows = useMemo(
    () => courseSearch(coursesQ.data || [], q, ['prefix', 'number', 'title'])
      .slice().sort((a, b) => `${a.prefix} ${a.number}`.localeCompare(`${b.prefix} ${b.number}`)),
    [coursesQ.data, q]
  )

  return (
    <Stack gap='cozy'>
      <p className='text-caption text-ink-muted'>
        Community-college catalog — only courses referenced by the ported agreements are in the research database.
      </p>
      <div className='flex flex-wrap items-center gap-3'>
        <Select className='w-72' placeholder='Community college…' value={collegeId ?? ''}
          options={options} onChange={setCollegeId} />
        <Input className='w-64' value={q} onChange={(e) => setQ(e.target.value)}
          placeholder='Search prefix / number / title…' leadingIcon={MagnifyingGlassIcon} />
        {collegeId && !coursesQ.isLoading && <span className='text-caption text-ink-subtle'>{rows.length} courses</span>}
      </div>
      {coursesQ.isLoading && collegeId && <div className='flex justify-center py-8'><Spinner /></div>}
      {collegeId && !coursesQ.isLoading && (rows.length ? (
        <CourseTable rows={rows} columns={[
          { key: 'course', label: 'Course', render: (r) => <span className='font-mono text-ink'>{r.prefix} {r.number}</span> },
          { key: 'title', label: 'Title' },
          { key: 'units', label: 'Units', render: (r) => <span className='font-mono tabular-nums'>{r.units ?? '—'}</span> },
          { key: 'course_id', label: 'course_id', render: (r) => <span className='font-mono'>{r.course_id}</span> },
        ]} />
      ) : <EmptyState title='No courses' description='No catalog rows for this college in your scope.' />)}
      {!collegeId && <EmptyState title='Choose a college' description='Pick a community college to browse its catalog.' />}
    </Stack>
  )
}

function UniversityCoursesBrowser() {
  const schools = useSchools()
  const [schoolId, setSchoolId] = useState(null)
  const [q, setQ] = useState('')
  const coursesQ = useUniversityCourses(schoolId)

  const options = (schools.data?.uc || [])
    .slice().sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ value: String(s.id), label: s.name }))
  const rows = useMemo(
    () => courseSearch(coursesQ.data || [], q, ['prefix', 'number', 'title', 'department'])
      .slice().sort((a, b) => `${a.prefix} ${a.number}`.localeCompare(`${b.prefix} ${b.number}`)),
    [coursesQ.data, q]
  )

  return (
    <Stack gap='cozy'>
      <p className='text-caption text-ink-muted'>
        UC-side catalog — the receiving courses the ported agreements articulate to.
      </p>
      <div className='flex flex-wrap items-center gap-3'>
        <Select className='w-64' placeholder='UC campus…' value={schoolId ?? ''}
          options={options} onChange={setSchoolId} />
        <Input className='w-64' value={q} onChange={(e) => setQ(e.target.value)}
          placeholder='Search prefix / number / title…' leadingIcon={MagnifyingGlassIcon} />
        {schoolId && !coursesQ.isLoading && <span className='text-caption text-ink-subtle'>{rows.length} courses</span>}
      </div>
      {coursesQ.isLoading && schoolId && <div className='flex justify-center py-8'><Spinner /></div>}
      {schoolId && !coursesQ.isLoading && (rows.length ? (
        <CourseTable rows={rows} columns={[
          { key: 'course', label: 'Course', render: (r) => <span className='font-mono text-ink'>{r.prefix} {r.number}</span> },
          { key: 'title', label: 'Title' },
          { key: 'units', label: 'Units', render: (r) => <span className='font-mono tabular-nums'>{r.min_units ?? '—'}{r.max_units != null && r.max_units !== r.min_units ? `–${r.max_units}` : ''}</span> },
          { key: 'department', label: 'Department' },
          { key: 'parent_id', label: 'parent_id', render: (r) => <span className='font-mono'>{r.parent_id}</span> },
        ]} />
      ) : <EmptyState title='No courses' description='No catalog rows for this campus in your scope.' />)}
      {!schoolId && <EmptyState title='Choose a campus' description='Pick a UC campus to browse its receiving courses.' />}
    </Stack>
  )
}
