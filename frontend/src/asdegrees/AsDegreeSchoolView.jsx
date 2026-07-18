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

// Short, readable names for the concept slugs used in the coverage tile.
const CONCEPT_LABEL = {
  cs_1: 'Programming', cs_2_oop: 'OOP', cs_3_data_structures: 'Data structures',
  comp_arch_assembly: 'Computer architecture', discrete_math: 'Discrete math',
  calc_1: 'Calculus I', calc_2: 'Calculus II', calc_3: 'Calculus III',
  linear_alg: 'Linear algebra', diff_eq: 'Differential equations',
  phys_mech: 'Physics', phys_em: 'Physics (E&M)',
  gen_chem_1: 'Chemistry', bio_cell_molec: 'Biology',
}
const conceptName = (slug) => CONCEPT_LABEL[slug] || slug.replace(/_/g, ' ')

const TYPE_TAB = { local_cs_as: 'Local A.S.', ast: 'Transfer (ADT)', local_computing: 'Applied' }

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
  const { doc, courses_by_id: coursesById, coverage_pct: coverage, missing_core_concepts: missing } = degree
  const units = doc.unit_system === 'quarter' ? 'quarter units' : 'semester units'
  const groups = doc.requirement_groups || []

  // The ledger renders the groups that carry real course structure; its
  // `courses` prop matches sending courses by numeric course_id.
  const ledgerMajor = useMemo(() => ({
    requirement_groups: groups
      .filter((g) => !g.units_fill && !g.ge_area
        && (g.sections || []).some((s) => (s.receivers || []).length))
      .map((g) => ({ ...g, title: ledgerTitle(g.label_seen) || undefined })),
  }), [groups])
  const ledgerCourses = useMemo(
    () => Object.values(coursesById || {}).filter((c) => c && c.course_id != null),
    [coursesById]
  )

  const geGroups = groups.filter((g) => g.ge_area)
  const unresolved = groups.flatMap((g) => g.unresolved_courses_seen || [])

  const tiles = []
  if (coverage != null) {
    tiles.push({
      label: 'Template coverage', value: `${coverage}%`,
      sub: missing?.length ? `Missing ${missing.map(conceptName).join(', ').toLowerCase()}` : 'Full standard core',
      accent: coverage >= 100,
    })
  }
  tiles.push({ label: 'Total units', value: doc.total_units ?? '—', sub: units })

  return (
    <Stack gap='cozy'>
      <p className='text-body text-ink-muted'>{doc.degree_title_seen}</p>
      {tiles.length > 0 && (
        <section aria-label='Degree summary'><StatStrip tiles={tiles} /></section>
      )}
      {ledgerMajor.requirement_groups.length > 0 && (
        <div className='uui-scope'>
          <RequirementsLedger major={ledgerMajor} courses={ledgerCourses}
            preserveOrder showCompletion={false} />
        </div>
      )}
      {geGroups.map((g) => (
        <section key={g.group_id}>
          <div className='flex items-baseline gap-2.5 mt-1'>
            <h4 className='text-label text-[11.5px]'>General education</h4>
            {(g.sections || [])[0]?.unit_advisement != null && (
              <span className='text-tag text-ink-subtle'>{g.sections[0].unit_advisement} units</span>
            )}
          </div>
        </section>
      ))}
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
          AI-extracted from the{' '}
          <a className='text-primary hover:underline inline-flex items-center gap-1'
            href={doc.catalog_url} target='_blank' rel='noreferrer'>
            {doc.catalog_year || 'college'} catalog
            <ArrowTopRightOnSquareIcon className='w-3.5 h-3.5' />
          </a>
          {' · not hand-verified'}
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
