import React, { useMemo, useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Alert, Badge, EmptyState, FullScreenPanel, PageContainer, Panel, Spinner, Stack, StatStrip, Tabs } from '../components/ui'
import SubNav from '../components/SubNav'
import { InstitutionRail, CourseTable, courseSearch, TieredDegreeLedger } from '../DataPage'
import AsDegreeSchoolView from '../asdegrees/AsDegreeSchoolView'
import { BuiltInAnalysisCard, VisualThumbnailCard, itemDetails } from '../visuals/VisualsPage'
import { getAnalysisById } from '../analyses/registry'
import { useMajors } from '../shared/majors/useMajors'
import {
  useColleges, useSchools, useCcCourses, useUniversityCourses,
  useDegreeRequirementDocuments, useMaBaselines,
} from '@frontend/query/hooks/useData'
import MaComparisonPanel from './MaComparisonPanel'

/**
 * Massachusetts: the "Lost in Transfer" paper's state, imported into our
 * structures and rendered by the SAME components California uses — that
 * identity is the point. The course-level data come from the paper's older
 * repository (part recovered from git history; see server/data/ma/PROVENANCE.md),
 * while the final-PDF figure matrices are separate immutable baselines. The
 * Overview keeps those source vintages visible instead of treating the older
 * repository as the final paper.
 *
 * The page follows the layout every state tab shares — Overview, Community
 * Colleges, Universities, Prerequisites, Visuals — adapted to what this
 * corpus has: AS programs are flat course lists (that is how the paper
 * records them), and prerequisites are not modeled.
 */
const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'colleges', label: 'Community Colleges' },
  { value: 'universities', label: 'Universities' },
  { value: 'prerequisites', label: 'Prerequisites' },
  { value: 'visuals', label: 'Visuals' },
]

const TAB_ROUTES = {
  overview: { path: '/api/ma/baselines' },
  colleges: { path: '/api/assist/institutions?kind=community_college&state=ma' },
  universities: { path: '/api/assist/institutions?kind=university&state=ma' },
  prerequisites: null,
  visuals: { path: '/api/analysis/coverage?majorSlug=ma-cs&requirements=degree&groupBy=college' },
}

export default function MassachusettsPage() {
  const [tab, setTab] = useState('overview')
  const [route, setRoute] = useState(TAB_ROUTES.overview)

  const changeTab = (next) => {
    setTab(next)
    setRoute(TAB_ROUTES[next])
  }

  return (
    <div className='h-full flex flex-col'>
      <SubNav tabs={{ value: tab, onChange: changeTab, options: TABS }} route={route} />
      <div className='flex-1 min-h-0 overflow-auto'>
        <PageContainer>
          {tab === 'overview' && <OverviewTab />}
          {tab === 'colleges' && <CollegesPane onRoute={setRoute} />}
          {tab === 'universities' && <UniversitiesPane onRoute={setRoute} />}
          {tab === 'prerequisites' && (
            <EmptyState
              title='No prerequisite graph for Massachusetts'
              description='The recovered repository workbooks carry course sequences, but nobody has modeled them into the prerequisite concept graph the California and Virginia tabs use. They predate the final PDF and should not be mistaken for its complete underlying corpus.' />
          )}
          {tab === 'visuals' && <VisualsTab />}
        </PageContainer>
      </div>
    </div>
  )
}

/* ── Overview ────────────────────────────────────────────────────────────── */

function OverviewTab() {
  const colleges = useColleges({ state: 'ma' })
  const schools = useSchools({ state: 'ma' })
  const baselines = useMaBaselines()
  const studiedPairs = baselines.data?.measures?.pct_as_pdf?.cells?.length
    ?? baselines.data?.measures?.pct_as?.cells?.length

  if (colleges.isLoading || schools.isLoading) {
    return <div className='py-10 flex justify-center'><Spinner /></div>
  }
  if (colleges.isError || schools.isError) {
    return <Alert type='error'>Could not load the Massachusetts corpus.</Alert>
  }
  if (!colleges.data?.length) {
    return (
      <EmptyState title='Massachusetts is not in this database'
        description='Run the importer (node scripts/ma/importMassachusetts.js --apply) to load the recovered paper corpus.' />
    )
  }

  return (
    <Stack gap='page'>
      <Panel>
        <h1 className='text-title'>Massachusetts</h1>
        <p className='mt-2 text-body text-ink-muted max-w-4xl'>
          The state studied by &ldquo;Lost in Transfer&rdquo; (SIGCSE), imported into the
          same data structures California uses and rendered by the same figure
          components — 11 public universities, 15 community colleges, 165
          articulation pairs, and 61 studied transfer pathways, recovered from the
          paper&rsquo;s repository (13 workbook files exist only in its git history:
          two aggregate workbooks and 11 university pathway workbooks).
          Each figure keeps only two readings: the final paper and our direct
          recalculation from the authors&rsquo; source files.
        </p>
        <div className='mt-4'>
          <StatStrip tiles={[
            { label: 'Public universities', value: schools.data?.uc?.length ?? '—' },
            { label: 'Community colleges', value: colleges.data?.length ?? '—' },
            { label: 'Studied pathways', value: studiedPairs ?? '—' },
          ]} />
        </div>
      </Panel>

      <MaComparisonPanel />
    </Stack>
  )
}

/* ── Community Colleges ──────────────────────────────────────────────────── */

const MA_CC_COURSE_COLUMNS = [
  { key: 'code', label: 'Course', width: '130px', variant: 'code', render: (r) => `${r.prefix} ${r.number}`.trim() },
  { key: 'title', label: 'Title', variant: 'title' },
  { key: 'units', label: 'Credits', width: '80px', align: 'right', variant: 'num', render: (r) => r.units ?? '—' },
]

const CC_SUB_ROUTES = {
  degree: (id) => ({ path: `/api/curated/as-degrees?college_id=ma:cc:${id}&major=ma-cs` }),
  courses: (id) => ({ path: `/api/assist/courses?institution_id=ma:cc:${id}` }),
}

function CollegesPane({ onRoute }) {
  const colleges = useColleges({ state: 'ma' })
  const [selected, setSelected] = useState(null)
  const [subTab, setSubTab] = useState('degree')
  const items = colleges.data ?? []
  const current = items.find((item) => String(item.id) === String(selected))

  const select = (id) => {
    setSelected(id)
    onRoute(CC_SUB_ROUTES[subTab](id))
  }
  const changeSubTab = (next) => {
    setSubTab(next)
    if (current) onRoute(CC_SUB_ROUTES[next](current.id))
  }

  if (colleges.isLoading) return <div className='py-10 flex justify-center'><Spinner /></div>
  if (colleges.isError) return <Alert type='error'>Failed to load the community colleges.</Alert>

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start'>
      <InstitutionRail items={items} selectedId={selected} title='Community colleges'
        onSelect={select} />
      {!current ? (
        <EmptyState title='Choose a college'
          description='Pick one to see its associate degree and the courses it carries.' />
      ) : (
        <Stack gap='cozy'>
          <h2 className='text-heading'>{current.name}</h2>
          <Tabs value={subTab} onChange={changeSubTab} options={[
            { value: 'degree', label: 'Associate Degree' },
            { value: 'courses', label: 'Courses' },
          ]} />
          {subTab === 'degree' && (
            // The same per-college degree view California's console renders,
            // pointed at the imported paper corpus.
            <AsDegreeSchoolView collegeId={current.id} state='ma' major='ma-cs'
              onlyDegreeType='local_as' showDegreeTitle={false} />
          )}
          {subTab === 'courses' && <MaCourseList collegeId={current.id} />}
        </Stack>
      )}
    </div>
  )
}

function MaCourseList({ collegeId }) {
  const { data, isLoading, isError } = useCcCourses(collegeId, { state: 'ma' })
  const [q, setQ] = useState('')
  const rows = useMemo(
    () => (data ?? []).map((row) => ({ ...row, code: `${row.prefix} ${row.number}`.trim() })),
    [data]
  )
  const visible = useMemo(() => courseSearch(rows, q, ['code', 'title']), [rows, q])
  const totalCredits = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.units) || 0), 0),
    [rows]
  )

  return (
    <Stack gap='cozy'>
      <p className='text-caption text-ink-subtle'>
        The associate program&rsquo;s course list as the paper&rsquo;s workbook records it —
        this flat list is the AS degree; Massachusetts does not publish it in
        requirement groups the way California A.S.-T templates do.
      </p>
      <div className='flex flex-wrap items-center gap-3.5'>
        <label className='flex-none w-[340px] flex items-center gap-2 bg-surface border border-border rounded-pill px-[15px] py-[9px]'>
          <MagnifyingGlassIcon className='w-[14px] h-[14px] text-ink-subtle shrink-0' />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label='Search courses'
            placeholder='Search code / title…'
            className='flex-1 min-w-0 bg-transparent outline-none border-none text-caption ink-default placeholder:text-ink-subtle' />
        </label>
        {!isLoading && (
          <span className='text-caption text-ink-subtle'>
            {visible.length} courses · {totalCredits.toFixed(1)} credits total
          </span>
        )}
      </div>
      {isLoading ? <div className='flex justify-center py-8'><Spinner /></div>
        : isError ? <Alert type='error'>Failed to load courses.</Alert>
        : visible.length ? <CourseTable rows={visible} columns={MA_CC_COURSE_COLUMNS} />
        : <EmptyState title='No courses' description='No workbook rows here.' />}
    </Stack>
  )
}

/* ── Universities ────────────────────────────────────────────────────────── */

function UniversitiesPane({ onRoute }) {
  const schools = useSchools({ state: 'ma' })
  const [selected, setSelected] = useState(null)
  const items = schools.data?.uc ?? []
  const current = items.find((item) => String(item.id) === String(selected))

  const select = (id) => {
    setSelected(id)
    onRoute({ path: '/api/curated/requirements?kind=degree' })
  }

  if (schools.isLoading) return <div className='py-10 flex justify-center'><Spinner /></div>
  if (schools.isError) return <Alert type='error'>Failed to load the universities.</Alert>

  return (
    <div className='grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 items-start'>
      <InstitutionRail items={items} selectedId={selected} title='Public universities'
        onSelect={select} />
      {!current ? (
        <EmptyState title='Choose a university'
          description='Pick one to see its Computer Science B.S. requirements as the paper recorded them.' />
      ) : (
        <UniversityDegree school={current} />
      )}
    </div>
  )
}

function UniversityDegree({ school }) {
  const documents = useDegreeRequirementDocuments()
  const receiving = useUniversityCourses(school.id, { state: 'ma' })
  const doc = useMemo(
    () => (documents.data?.rows ?? []).find(
      (row) => row.major_slug === 'ma-cs' && row.school_id === school.id
    ),
    [documents.data, school.id]
  )
  // Receiver rows in the ledger resolve their course identity through this
  // map (parent_id → catalog row), same as the California degree views.
  const universityCoursesById = useMemo(
    () => Object.fromEntries((receiving.data ?? []).map((row) => [row.parent_id, row])),
    [receiving.data]
  )

  if (documents.isLoading) return <div className='py-10 flex justify-center'><Spinner /></div>
  if (documents.isError) return <Alert type='error'>Failed to load the degree documents.</Alert>
  if (!doc) {
    return <EmptyState title='No degree document'
      description='This university has no imported Computer Science B.S. template.' />
  }

  return (
    <Stack gap='cozy'>
      <div>
        <h2 className='text-heading'>{school.name}</h2>
        <p className='mt-1 text-caption text-ink-muted max-w-3xl'>
          {doc.program} · {doc.total_units} credits stated · catalog {doc.catalog_year}.
          Imported from the paper&rsquo;s workbooks; upper-division work is marked
          non-articulable because the paper&rsquo;s analysis treats community-college
          credit as landing in the lower division.
        </p>
      </div>
      <TieredDegreeLedger groups={doc.requirement_groups ?? []}
        universityCoursesById={universityCoursesById} />
    </Stack>
  )
}

/* ── Visuals ─────────────────────────────────────────────────────────────── */

// The paper's figures, straight from the shared analyses registry —
// rendered through the same thumbnail-gallery + full-screen detail the
// California Visuals tab uses, so the two states read identically. The
// heatmap's page-level extra: the MA-paper lens is this corpus's native
// state, so it opens toggled on. Figures with readable final-PDF matrices open
// on those transcriptions; archive/model readings remain explicit controls.
// Figure 1 is the course-level reconstruction that exactly reproduces 38.2%.
const MA_FIGURE_IDS = [
  'coverage-heatmap', 'course-type-coverage', 'transfer-credit-rate',
  'transfer-extra-units', 'transfer-extra-cost', 'pathway-complexity',
]
const MA_COMPONENT_PROPS = {
  'coverage-heatmap': { defaultMaEquivalent: true },
}
const NO_RELEASES = new Set()

function VisualsTab() {
  const { majors, isLoading, isError } = useMajors({ state: 'ma' })
  const maMajor = majors[0] || null
  const [selectedKey, setSelectedKey] = useState(null)

  const gallery = useMemo(() => MA_FIGURE_IDS
    .map((id) => getAnalysisById(id))
    .filter(Boolean)
    .map((analysis) => ({ kind: 'analysis', key: `analysis:${analysis.id}`, at: analysis.published_at, analysis }))
    .sort((a, b) => (a.analysis.figureNo ?? 99) - (b.analysis.figureNo ?? 99)), [])

  if (isLoading) return <div className='py-10 flex justify-center'><Spinner /></div>
  if (isError || !maMajor) {
    return <Alert type='error'>Could not load the Massachusetts major registry.</Alert>
  }

  const selectedItem = gallery.find((item) => item.key === selectedKey) || null
  const selectedDetails = selectedItem
    ? itemDetails(selectedItem, { isAdmin: false, releasedSet: NO_RELEASES, selectedMajor: maMajor })
    : null

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex items-end justify-between gap-6'>
        <div>
          <h1 className='text-heading'>Visual library</h1>
          <p className='mt-1 text-body text-ink-muted'>
            The paper&rsquo;s six figures on one source-aware surface. Final-PDF values
            are the default wherever a matrix or plotted points can be transcribed;
            older repository and recomputed readings remain separate controls. Every
            card uses the same interactive component as the California library.
          </p>
        </div>
        <Badge variant='neutral'>{gallery.length} visuals</Badge>
      </div>
      <section className='surface-card flex items-center gap-3 px-[22px] py-4'>
        <p className='text-label shrink-0'>Major</p>
        <div className='ml-auto min-w-52'>
          <p className='text-body-strong'>{maMajor.label}</p>
        </div>
      </section>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {gallery.map((item) => (
          <VisualThumbnailCard key={item.key} item={item}
            selectedMajor={maMajor}
            componentProps={MA_COMPONENT_PROPS[item.analysis.id] || null}
            onOpen={() => setSelectedKey(item.key)} />
        ))}
      </div>

      <FullScreenPanel open={!!selectedItem} onClose={() => setSelectedKey(null)}
        title={selectedDetails?.title} subtitle={selectedDetails?.source}
        contentOwnsHeader
        ariaLabel={selectedDetails ? `${selectedDetails.title} visual detail` : 'Visual detail'}>
        {selectedItem && (
          <BuiltInAnalysisCard analysis={selectedItem.analysis} selectedMajor={maMajor}
            componentProps={MA_COMPONENT_PROPS[selectedItem.analysis.id] || null} />
        )}
      </FullScreenPanel>
    </div>
  )
}
