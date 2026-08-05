import React, { useMemo, useState } from 'react'
import { Alert, Combobox, Spinner, Stack, StatStrip } from '../components/ui'
import { useColleges, usePrereqGraph } from '../shared/query/hooks/useData'
import PrereqGraph from './PrereqGraph'

// Compact chip grid for concepts this college has no mapped course for —
// gaps aren't part of the graph component's input, so they surface here.
function ConceptChips({ heading, sub, items }) {
  if (!items.length) return null
  return (
    <div className='surface-card px-[22px] py-[14px]'>
      <p className='text-label'>{heading} <span className='text-tag text-ink-subtle font-normal'>{sub}</span></p>
      <div className='flex flex-wrap gap-1.5 mt-2.5'>
        {items.map((c) => (
          <span key={c.slug} className='chip' title={c.title}>{c.name}</span>
        ))}
      </div>
    </div>
  )
}

export default function ConceptGraphView({
  initialCollegeId = null,
  lockCollege = false,
  majorSlug = null,
}) {
  // initialCollegeId exists so tests and institution panes can enter college
  // mode without driving the portal-based Combobox.
  // lockCollege hides the college Combobox — the Institutions pane already
  // owns the selection via its rail, so a second picker here is noise.
  const colleges = useColleges()
  const [collegeId, setCollegeId] = useState(initialCollegeId)
  const graph = usePrereqGraph(collegeId, majorSlug)

  const collegeOptions = useMemo(() => [
    { value: null, label: 'Canonical concepts (no college)' },
    ...(colleges.data || []).map((c) => ({ value: c.source_id, label: c.name })),
  ], [colleges.data])

  if (graph.isLoading) return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  if (graph.isError) return <Alert type='error'>Failed to load the prerequisite graph.</Alert>
  const d = graph.data
  const mappedCourses = (d.courses || []).filter((c) => c.concept)

  let graphEl; let gapChips = null
  if (collegeId == null) {
    graphEl = d.concepts.length
      ? <PrereqGraph mode='canonical' concepts={d.concepts} rules={d.rules} />
      : <Alert type='info'>Nothing to draw yet — add concepts or run the importer.</Alert>
  } else {
    const conceptIndex = Object.fromEntries(d.concepts.map((c) => [c.slug, c]))
    graphEl = mappedCourses.length
      ? <PrereqGraph mode='college' courses={mappedCourses} edges={d.edges} conceptIndex={conceptIndex} />
      : <Alert type='info'>No mapped courses at this college yet.</Alert>
    const present = new Set(mappedCourses.map((c) => c.concept))
    // Satisfies counts: a college with a combined LA+DE course "has" both.
    for (const c of mappedCourses) for (const s of conceptIndex[c.concept]?.satisfies || []) present.add(s)
    const missing = d.concepts.filter((c) =>
      !present.has(c.slug) && (c.requires.length || d.rules.some((r) => r.from === c.slug)))
    gapChips = (
      <ConceptChips heading='No course here' sub='chain-relevant concepts this college has no mapped course for'
        items={missing.map((c) => ({ slug: c.slug, name: c.name, title: `${c.name} (${c.slug}) — no course at this college` }))} />
    )
  }

  const s = d.stats
  const tiles = collegeId == null
    ? [
      { label: 'Concepts', value: d.concepts.length },
      { label: 'Rules', value: d.rules.length },
      { label: 'In-scope courses (statewide)', value: s.in_scope },
      { label: 'Examined', value: s.examined, accent: s.examined >= s.in_scope && s.in_scope > 0 },
    ]
    : [
      {
        label: 'In-scope courses', value: s.in_scope,
        // The graph also draws mapped prerequisite-only closure courses, while
        // coverage remains defined over direct major courses alone.
        sub: `${mappedCourses.length} drawn · ${s.examined - s.mapped} major courses examined, no concept`,
      },
      {
        label: 'Examined', value: s.in_scope ? `${Math.round((s.examined / s.in_scope) * 100)}%` : '—',
        sub: `${s.examined} of ${s.in_scope}`, accent: s.examined === s.in_scope && s.in_scope > 0,
      },
      { label: 'Edges', value: s.edges },
      d.legacy
        ? {
          label: 'Legacy agreement', value: d.legacy.legacy_edges
            ? `${Math.round((d.legacy.shared_edges / d.legacy.legacy_edges) * 100)}%`
            : '—',
          sub: `${d.legacy.shared_edges} of ${d.legacy.legacy_edges} legacy edges reproduced`,
        }
        : { label: 'Legacy data', value: 'none', sub: 'not among the 16 colleges the prior group covered' },
    ]

  return (
    <Stack gap='cozy'>
      {!lockCollege && (
        <div className='flex items-center gap-3'>
          <div className='w-80'>
            <Combobox value={collegeId} onChange={setCollegeId} options={collegeOptions}
              placeholder='Canonical concepts (no college)' />
          </div>
        </div>
      )}
      <StatStrip tiles={tiles} />
      {graphEl}
      {gapChips}
    </Stack>
  )
}
