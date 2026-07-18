import React, { useState, useEffect, useMemo } from 'react'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { Stack, Tabs, StatStrip, Spinner, EmptyState } from '../components/ui'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import { useAsDegreeDetail } from '../shared/query/hooks/useData'

// Per-college associate-degree view, shown as the AS Degrees sub-tab in the
// Institutions catalog. The requirement groups render through the shared
// RequirementsLedger — the same treatment as ASSIST Transfer Requirements,
// Curated Transfer Minimums, and Graduation Requirements Coverage — which the
// as_degree kind's agreement-skeleton storage makes possible with no
// translation (receivers just have no university side). GE-pattern and
// electives groups carry no course structure, so they stay one-line notes.

const TYPE_TAB = { local_cs_as: 'Local A.S.', ast: 'Transfer (ADT)', local_computing: 'Applied' }

// GE pattern identifiers → the section title shown on the pattern's card.
const GE_PATTERN_NAME = {
  calgetc: 'Approved courses from the Cal-GETC pattern',
  igetc: 'Approved courses from the IGETC pattern',
  csu_ge: 'Approved courses from the CSU GE pattern',
  local_pattern: 'Approved courses from the college GE pattern',
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

export function DegreePanel({ degree }) {
  const { doc, courses_by_id: coursesById, ge_breakdowns: geBreakdowns } = degree
  const units = doc.unit_system === 'quarter' ? 'quarter units' : 'semester units'
  const groups = doc.requirement_groups || []

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

  return (
    <Stack gap='cozy'>
      <p className='text-body text-ink-muted'>{doc.degree_title_seen}</p>
      <section aria-label='Degree summary'>
        <StatStrip tiles={[{ label: 'Total units', value: doc.total_units ?? '—', sub: units }]} />
      </section>
      {ledgerMajor.requirement_groups.length > 0 && (
        <div className='uui-scope'>
          <RequirementsLedger major={ledgerMajor} courses={ledgerCourses}
            preserveOrder showCompletion={false} />
        </div>
      )}
      {unresolved.length > 0 && (
        <div className='surface-card px-[18px] py-3.5'>
          <p className='text-label text-[11px]'>Cited in the catalog · not in the course database</p>
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

export default function AsDegreeSchoolView({ collegeId }) {
  const q = useAsDegreeDetail(collegeId != null ? `cc:${collegeId}` : null)
  const degrees = q.data?.degrees || []
  const [pick, setPick] = useState(0)
  useEffect(() => { setPick(0) }, [collegeId])

  if (q.isLoading) return <div className='flex justify-center py-10'><Spinner /></div>
  if (q.isError || !degrees.length) {
    return <EmptyState title='No associate-degree data'
      description='This college has no local computer-science associate degree on file yet.' />
  }
  const active = degrees[Math.min(pick, degrees.length - 1)]

  return (
    <Stack gap='cozy'>
      {degrees.length > 1 && (
        <Tabs value={String(pick)} onChange={(v) => setPick(Number(v))}
          options={degrees.map((d, i) => ({ value: String(i), label: TYPE_TAB[d.degree_type] || 'Degree' }))} />
      )}
      <DegreePanel degree={active} />
    </Stack>
  )
}
