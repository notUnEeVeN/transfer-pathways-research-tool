import React, { useState, useEffect, useMemo } from 'react'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { Stack, Tabs, Spinner, EmptyState } from '../components/ui'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import { useAsDegreeDetail } from '../shared/query/hooks/useData'
import GroupCourseEditor from './validation/GroupCourseEditor'
import { DEGREE_TYPE_DESCRIPTION as TYPE_DESCRIPTION, DEGREE_TYPE_LABEL as TYPE_TAB } from '../shared/lib/asDegreeTypes'

// Per-college associate-degree view, shown as the Associate degrees sub-tab in
// the Community Colleges catalog. The requirement groups render through the shared
// RequirementsLedger — the same treatment as ASSIST Transfer Requirements,
// Curated Transfer Minimums, and Graduation Requirements Coverage — which the
// as_degree kind's agreement-skeleton storage makes possible with no
// translation (receivers just have no university side). GE-pattern and
// electives groups carry no course structure, so they stay one-line notes.

// GE pattern identifiers → the section title shown on the pattern's card.
const GE_PATTERN_NAME = {
  calgetc: 'Approved courses from the Cal-GETC pattern',
  igetc: 'Approved courses from the IGETC pattern',
  csu_ge: 'Approved courses from the CSU GE pattern',
  local_pattern: 'Approved courses from the college GE pattern',
}

// Parent-area clusters for the statewide patterns: one ledger section per
// top-level area, so sibling sub-areas (1A/1B/1C) read as one card and
// standalone areas (2, 4…) stand alone. Keys are area-code prefixes; the
// college's local pattern has no sub-area structure, so it stays one card.
const GE_PATTERN_SHORT = { calgetc: 'Cal-GETC', igetc: 'IGETC', csu_ge: 'CSU GE' }
const GE_AREA_CLUSTERS = {
  calgetc: [
    ['1', 'English Communication'],
    ['2', 'Mathematical Concepts & Quantitative Reasoning'],
    ['3', 'Arts & Humanities'],
    ['4', 'Social & Behavioral Sciences'],
    ['5', 'Physical & Biological Sciences'],
    ['6', 'Ethnic Studies'],
  ],
  igetc: [
    ['1', 'English Communication'],
    ['2', 'Mathematical Concepts & Quantitative Reasoning'],
    ['3', 'Arts & Humanities'],
    ['4', 'Social & Behavioral Sciences'],
    ['5', 'Physical & Biological Sciences'],
    ['6', 'Language Other Than English'],
    ['7', 'Ethnic Studies'],
  ],
  csu_ge: [
    ['A', 'English Language Communication & Critical Thinking'],
    ['B', 'Scientific Inquiry & Quantitative Reasoning'],
    ['C', 'Arts & Humanities'],
    ['D', 'Social Sciences'],
    ['E', 'Lifelong Learning & Self-Development'],
    ['F', 'Ethnic Studies'],
  ],
}

// Split a pattern's area receivers into one section per parent-area cluster.
// An area whose code matches no cluster (unexpected data) gets its own card
// rather than disappearing.
function geClusterSections(pattern, areaReceivers) {
  const clusters = GE_AREA_CLUSTERS[pattern]
  // No cluster map (local pattern) or no breakdown to cluster (a stale cached
  // payload) — callers fall back to the flat single-card render.
  if (!clusters || !areaReceivers.length) return null
  const inCluster = (code, key) => String(code || '').startsWith(key)
  const sections = clusters
    .map(([key, name]) => ({
      title: `Area ${key} · ${name}`,
      receivers: areaReceivers.filter((r) => inCluster(r.receiving.code, key)),
    }))
    .filter((s) => s.receivers.length)
  const orphans = areaReceivers.filter((r) => !clusters.some(([key]) => inCluster(r.receiving.code, key)))
  for (const r of orphans) sections.push({ title: r.receiving.name || `Area ${r.receiving.code}`, receivers: [r] })
  return sections.map((s) => ({ ...s, section_advisement: s.receivers.length, unit_advisement: null }))
}

// Build the GE group's ledger rows from the server's per-area breakdown: one
// receiver per GE area (receiving side = the area), with a category_match so
// the sending side reads "N qualifying courses" — the same treatment the
// Graduation Requirements Coverage tab gives GE/breadth slots. Local
// associate-degree patterns have no course tags in the dataset, so their
// areas render as the assumed variant (verify the college's approved list).
function geAreaReceivers(breakdown) {
  if (!breakdown || !Array.isArray(breakdown.areas)) return []
  return breakdown.areas.map((a) => ({
    receiving: { kind: 'ge_area', code: a.code, name: a.name },
    articulation_status: 'articulated',
    not_articulated_reason: null,
    options: [],
    options_conjunction: 'and',
    hash_id: null,
    category_match: {
      kind: 'ge_area',
      areas: [],
      required_count: null,
      qualifying_count: breakdown.assumed ? null : a.qualifying_count,
      assumed: !!breakdown.assumed,
    },
  }))
}

// Catalog group headings mix topics ("Required Core") with bare instructions
// ("Take ALL of the following courses"). Keep a cleaned topic as the ledger
// group title; drop instruction-only labels entirely — the ledger's own
// Required/Recommended heading plus its section rule already carry that.
const RULE_ONLY = /^(take|select|complete|choose)\b|following/i
const ledgerTitle = (raw) => {
  let t = (raw || '').replace(/\([^)]*\)/g, ' ')
    .replace(/\s[—–]\s.*$/, '')
    .replace(/\s*[-—–:]\s*(complete|select|choose|take|units?|any|plus)\b.*$/i, '')
    .replace(/[:,.\s]+$/, '').replace(/\s{2,}/g, ' ').trim()
  if (!t || t.length < 3 || RULE_ONLY.test(t)) return null
  if (t.length > 52) t = `${t.slice(0, 49).replace(/\s\S*$/, '')}…`
  return t
}

/**
 * `editing` (opt-in, AS-degree verification) arms a small Edit button on the
 * top right of every group a flat course list can represent honestly. Shape:
 * `{ isEditable(group), courseOptions, onChange(groupId, courseIds) }`.
 * Absent everywhere else, and the panel renders unchanged.
 */
export function DegreePanel({ degree, showDegreeTitle = true, editing = null }) {
  const { doc, courses_by_id: coursesById, ge_breakdowns: geBreakdowns } = degree
  const groups = doc.requirement_groups || []
  const [openGroupId, setOpenGroupId] = useState(null)

  // Every group renders through the shared RequirementsLedger, in catalog
  // order. Course groups pass through as stored. A GE-pattern group has no
  // enumerable courses of its own, so its rows are the pattern's AREAS —
  // each with the college's qualifying-course count, exactly like the
  // Graduation Requirements Coverage treatment. Electives-to-total groups
  // carry nothing to render.
  const ledgerMajor = useMemo(() => ({
    requirement_groups: groups
      .filter((g) => !g.units_fill
        && (g.ge_area || (g.sections || []).some((s) => (s.receivers || []).length)))
      .map((g) => {
        if (!g.ge_area || (g.sections || []).some((s) => (s.receivers || []).length)) {
          return { ...g, title: ledgerTitle(g.label_seen) || undefined }
        }
        const section = (g.sections || [])[0] || {}
        const areaReceivers = geAreaReceivers(geBreakdowns?.[g.ge_area])
        const clusterSections = geClusterSections(g.ge_area, areaReceivers)
        if (clusterSections) {
          return {
            ...g,
            title: `General education — ${GE_PATTERN_SHORT[g.ge_area] || 'pattern'}`,
            // A stated unit ask spans the whole pattern, so it reads as the
            // group rule ("Complete N units across the sections below").
            group_unit_advisement: section.unit_advisement ?? null,
            sections: clusterSections,
          }
        }
        return {
          ...g,
          title: 'General education',
          sections: [{
            title: GE_PATTERN_NAME[g.ge_area] || 'General-education pattern',
            // Every area of a GE pattern is required — state the full count
            // (a null advisement means "any one satisfies" in this skeleton).
            // A stated unit ask wins the rule line either way.
            section_advisement: areaReceivers.length || null,
            unit_advisement: section.unit_advisement ?? null,
            receivers: areaReceivers,
          }],
        }
      }),
  }), [groups, geBreakdowns])
  const ledgerCourses = useMemo(
    () => Object.values(coursesById || {}).filter((c) => c && c.course_id != null),
    [coursesById]
  )

  const unresolved = groups.flatMap((g) => g.unresolved_courses_seen || [])

  // A group only gets the Edit button when the caller arms editing AND a flat
  // course list can state the group without losing meaning.
  const groupAction = editing
    ? (group) => (editing.isEditable(group) ? (
      <button type='button'
        onClick={() => setOpenGroupId(openGroupId === group.group_id ? null : group.group_id)}
        className='rounded-pill border border-border-strong px-2.5 py-[3px] text-caption font-medium text-ink-muted hover:border-primary hover:text-ink'>
        {openGroupId === group.group_id ? 'Done' : 'Edit'}
      </button>
    ) : null)
    : null
  const groupPanel = editing
    ? (group) => (openGroupId === group.group_id ? (
      <GroupCourseEditor group={group} coursesById={coursesById}
        courseOptions={editing.courseOptions}
        onChange={(ids) => editing.onChange(group.group_id, ids)} />
    ) : null)
    : null

  return (
    <Stack gap='cozy'>
      {showDegreeTitle && <p className='text-body text-ink-muted'>{doc.degree_title_seen}</p>}
      {ledgerMajor.requirement_groups.length > 0 && (
        <div className='uui-scope'>
          <RequirementsLedger major={ledgerMajor} courses={ledgerCourses}
            preserveOrder showCompletion={false}
            groupAction={groupAction} groupPanel={groupPanel} />
        </div>
      )}
      {unresolved.length > 0 && (
        <div className='surface-card px-[18px] py-3.5'>
          <p className='text-label'>Cited in the catalog · not in the course database</p>
          <div className='mt-1.5 flex flex-col gap-1'>
            {unresolved.map((u, i) => (
              <p key={i} className='text-caption text-ink-subtle'>
                <span className='font-[600] text-ink-muted'>{u.course_code_seen}</span>
                {u.title_seen ? ` — ${u.title_seen}` : ''}{u.units_seen ? ` (${u.units_seen}u)` : ''}
              </p>
            ))}
          </div>
        </div>
      )}
      {doc.catalog_url && (
        <p className='text-caption text-ink-subtle'>
          <a className='text-primary hover:underline inline-flex items-center gap-1'
            href={doc.catalog_url} target='_blank' rel='noreferrer'>
            {doc.catalog_year || 'College'} catalog
            <ArrowTopRightOnSquareIcon className='w-3.5 h-3.5' />
          </a>
        </p>
      )}
    </Stack>
  )
}

export default function AsDegreeSchoolView({
  collegeId,
  initialDegreeType = null,
  onlyDegreeType = null,
  degreeTypes = null,
  showDegreeTitle = true,
  onDegreeTypeChange = null,
}) {
  const q = useAsDegreeDetail(collegeId != null ? `cc:${collegeId}` : null)
  const allDegrees = q.data?.degrees || []
  const allowedDegreeTypes = onlyDegreeType ? [onlyDegreeType] : degreeTypes
  const degrees = allowedDegreeTypes
    ? allowedDegreeTypes.flatMap((type) => allDegrees.filter((degree) => degree.degree_type === type))
    : allDegrees
  const requestedType = onlyDegreeType || initialDegreeType
  const [selectedType, setSelectedType] = useState(requestedType)
  useEffect(() => { setSelectedType(requestedType) }, [collegeId, requestedType])
  const changeSelectedType = (next) => {
    setSelectedType(next)
    onDegreeTypeChange?.(next)
  }

  if (q.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (q.isError || !degrees.length) {
    return <EmptyState title='No associate-degree data'
      description='This college has no local computer-science associate degree on file yet.' />
  }
  const active = degrees.find((degree) => degree.degree_type === selectedType) || degrees[0]

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='min-w-[190px] flex-1'>
          <p className='text-label'>Degree type</p>
          <p className='mt-1 text-caption text-ink-muted'>
            {TYPE_DESCRIPTION[active.degree_type] || 'Associate degree'}
          </p>
        </div>
        <Tabs value={active.degree_type} onChange={changeSelectedType}
          options={degrees.map((degree) => ({
            value: degree.degree_type,
            label: TYPE_TAB[degree.degree_type] || 'Degree',
          }))} />
      </div>
      <DegreePanel degree={active} showDegreeTitle={showDegreeTitle} />
    </Stack>
  )
}
