import React, { useState, useEffect } from 'react'
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { Stack, Tabs, StatStrip, Spinner, EmptyState } from '../components/ui'
import { useAsDegreeDetail } from '../shared/query/hooks/useData'

// Per-college associate-degree view, shown as a tab beside "Degree coverage"
// in an agreement pair. Deliberately minimal: the school's own local degree(s)
// read against the statewide CS template, no QA chrome (that lives in the
// Data → AS Degrees bulk table). Matches the DegreeCompletionView idiom —
// a StatStrip headline over labelled requirement sections.

// Short, readable names for the concept slugs used in coverage/missing lines.
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

// Drop the catalog's parenthetical unit boilerplate from a group heading.
const cleanLabel = (s) => (s || 'Requirements').replace(/\s*\([^)]*\b(?:credit|unit|complete)[^)]*\)\s*$/i, '').trim() || 'Requirements'

// One requirement group → a heading, a short rule, and its courses.
function GroupBlock({ group, coursesById }) {
  if (group.units_fill) return null // electives-to-total: no course list to read
  const section = (group.sections || [])[0] || {}
  const rule = section.section_advisement != null ? `Choose ${section.section_advisement}`
    : section.unit_advisement != null ? `${section.unit_advisement} units`
    : null

  // GE area group: a single line, no course enumeration.
  if (group.ge_area) {
    return (
      <section>
        <h4 className='text-label text-[11.5px]'>{cleanLabel(group.label_seen)}</h4>
        <p className='text-caption text-ink-muted mt-1'>
          General education{section.unit_advisement != null ? ` · ${section.unit_advisement} units` : ''}
        </p>
      </section>
    )
  }

  const rows = []
  for (const r of section.receivers || []) {
    for (const opt of r.options || []) {
      const codes = (opt.course_keys || []).map((k) => coursesById[k]).filter(Boolean)
      if (codes.length) rows.push(codes)
    }
  }
  const unresolved = group.unresolved_courses_seen || []

  return (
    <section>
      <div className='flex items-baseline gap-2.5 mb-2 mt-1'>
        <h4 className='text-label text-[11.5px]'>{cleanLabel(group.label_seen)}</h4>
        {rule && <span className='text-tag text-ink-subtle'>{rule}</span>}
      </div>
      <div className='surface-card divide-y divide-border/50'>
        {rows.map((courses, i) => (
          <div key={i} className='flex items-baseline gap-3 px-[18px] py-2.5'>
            <span className='text-[12.5px] font-[600] text-ink tabular-nums shrink-0 w-[92px]'>
              {courses.map((c) => c.code).join(' + ')}
            </span>
            <span className='text-body text-ink-muted min-w-0 flex-1 truncate'>
              {courses.map((c) => c.title).filter(Boolean).join(' + ')}
            </span>
            <span className='text-caption text-ink-subtle tabular-nums shrink-0'>
              {courses.reduce((n, c) => n + (c.units || 0), 0) || ''}
            </span>
          </div>
        ))}
        {unresolved.map((u, i) => (
          <div key={`u${i}`} className='flex items-baseline gap-3 px-[18px] py-2.5'>
            <span className='text-[12.5px] font-[600] text-ink-subtle tabular-nums shrink-0 w-[92px]'>
              {u.course_code_seen}
            </span>
            <span className='text-body text-ink-subtle min-w-0 flex-1 truncate italic'>
              {u.title_seen || 'Course not in the catalog database'}
            </span>
            <span className='text-caption text-ink-subtle tabular-nums shrink-0'>{u.units_seen || ''}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function DegreePanel({ degree }) {
  const { doc, courses_by_id: coursesById, coverage_pct: coverage, missing_core_concepts: missing } = degree
  const units = doc.unit_system === 'quarter' ? 'quarter units' : 'semester units'

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
      {(doc.requirement_groups || []).map((g) => (
        <GroupBlock key={g.group_id} group={g} coursesById={coursesById || {}} />
      ))}
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
