import React, { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, ArrowDownTrayIcon, ClipboardIcon } from '@heroicons/react/24/outline'
import { Button, Alert, Spinner, EmptyState, Stack, Tabs, Input, Select, LoadingLogo } from './components/ui'
import DatasetSummaryPanel from './components/DatasetSummaryPanel'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import DocHead from './pages/Audit/components/DocHead'
import { useCourseList } from './pages/Audit/hooks/useCourseList'
import { useAuditDoc } from '@frontend/query/hooks/useAudit'
import {
  useColleges, useSchools, useCcCourses, useUniversityCourses, useAgreementsBatch, useRawAssist,
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
          ]} />
      </div>
      <div className='flex-1 min-h-0 overflow-auto'>
        <div className='mx-auto max-w-screen-2xl px-6 py-6'>
          {tab === 'overview' && <DatasetSummaryPanel />}
          {tab === 'agreements' && <AgreementsBrowser />}
          {tab === 'cc' && <CcCoursesBrowser />}
          {tab === 'university' && <UniversityCoursesBrowser />}
        </div>
      </div>
    </div>
  )
}

// ───────── agreements ─────────

function AgreementsBrowser() {
  const colleges = useColleges()
  const schools = useSchools()
  const [collegeId, setCollegeId] = useState(null)
  const [schoolId, setSchoolId] = useState(null)
  const [selectedId, setSelectedId] = useState(null)

  const batch = useAgreementsBatch(collegeId, schoolId)
  const agreements = useMemo(() => {
    const group = (batch.data || []).find((g) => String(g.school_id) === String(schoolId))
    return (group?.agreements || []).slice().sort((a, b) => a.major.localeCompare(b.major))
  }, [batch.data, schoolId])

  const collegeOptions = (colleges.data || [])
    .slice().sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => ({ value: String(c.id), label: c.name }))
  const schoolOptions = (schools.data?.uc || [])
    .slice().sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ value: String(s.id), label: s.name }))

  return (
    <Stack gap='comfortable'>
      <div className='flex flex-wrap items-center gap-3'>
        <Select className='w-72' placeholder='Community college…' value={collegeId ?? ''}
          options={collegeOptions} onChange={(v) => { setCollegeId(v); setSelectedId(null) }} />
        <span className='text-caption text-ink-subtle'>→</span>
        <Select className='w-64' placeholder='UC campus…' value={schoolId ?? ''}
          options={schoolOptions} onChange={(v) => { setSchoolId(v); setSelectedId(null) }} />
        {batch.isLoading && collegeId && schoolId && <Spinner />}
      </div>

      {collegeId && schoolId && !batch.isLoading && (
        agreements.length ? (
          <div className='grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 items-start'>
            <div className='surface-card p-2 max-h-[70vh] overflow-auto'>
              {agreements.map((a) => (
                <button key={a._id} type='button' onClick={() => setSelectedId(a._id)}
                  className={`w-full text-left px-3 py-2 rounded-md border transition-colors mb-1 ${
                    a._id === selectedId ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-hover'}`}>
                  <span className='text-body break-words leading-snug'>{a.major}</span>
                </button>
              ))}
            </div>
            {selectedId
              ? <AgreementDetail agreementId={selectedId} />
              : <EmptyState title='Pick a major' description='Select an agreement from the list to inspect it.' />}
          </div>
        ) : (
          <EmptyState title='No agreements in scope'
            description='This college × campus pair has no agreements within your granted majors.' />
        )
      )}
      {!(collegeId && schoolId) && (
        <EmptyState title='Choose a pair'
          description='Pick a community college and a UC campus to list their articulation agreements.' />
      )}
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
