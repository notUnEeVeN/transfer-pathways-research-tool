import React, { useMemo, useState } from 'react'
import { Alert, Combobox, Spinner, Stack, StatStrip } from '../components/ui'
import { useColleges, usePrereqGraph } from '../shared/query/hooks/useData'
import { layoutDag } from './dagLayout'

const NODE_W = 168
const NODE_H = 44
const COL_GAP = 72
const ROW_GAP = 18
const PAD = 16

// Hand-built layered DAG per house chart rules: CSS vars carry color, inline
// attributes carry geometry, every mark has a title, and a rules table below
// keeps everything reachable without hover.
function DagSvg({ nodes, edges, hollowIds = new Set() }) {
  const { columns, depthOf } = layoutDag(nodes, edges)
  const pos = new Map()
  columns.forEach((col, ci) => {
    col.forEach((id, ri) => {
      pos.set(id, { x: PAD + ci * (NODE_W + COL_GAP), y: PAD + ri * (NODE_H + ROW_GAP) })
    })
  })
  const width = PAD * 2 + columns.length * NODE_W + (columns.length - 1) * COL_GAP
  const height = PAD * 2 + Math.max(...columns.map((c) => c.length), 1) * (NODE_H + ROW_GAP) - ROW_GAP
  const byId = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div className='surface-card p-3 overflow-x-auto'>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, maxWidth: 'none' }} role='img'
        aria-label='Prerequisite graph: arrows point from a prerequisite to the course that requires it'>
        {edges.map((e, i) => {
          const a = pos.get(e.from); const b = pos.get(e.to)
          if (!a || !b) return null
          const x1 = a.x + NODE_W; const y1 = a.y + NODE_H / 2
          const x2 = b.x; const y2 = b.y + NODE_H / 2
          const mx = (x1 + x2) / 2
          return (
            <path key={i} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
              fill='none' stroke='var(--color-border-strong, #8a8a8a)' strokeWidth='1.5'>
              <title>{`${byId.get(e.from)?.label ?? e.from} → ${byId.get(e.to)?.label ?? e.to}`}</title>
            </path>
          )
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)
          const hollow = hollowIds.has(n.id)
          return (
            <g key={n.id} transform={`translate(${p.x}, ${p.y})`}>
              <title>{n.title || n.label}</title>
              <rect width={NODE_W} height={NODE_H} rx='10'
                fill={hollow ? 'transparent' : 'var(--color-surface, #fff)'}
                stroke='var(--color-border, #d4d4d4)'
                strokeDasharray={hollow ? '5 4' : 'none'} strokeWidth='1.25' />
              <text x='12' y='19' fontSize='12.5' fontWeight='600'
                fill='var(--color-ink, #1a1a1a)'>{n.label}</text>
              <text x='12' y='34' fontSize='10.5'
                fill='var(--color-ink-subtle, #7a7a7a)'>{n.sub || ''}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// initialCollegeId seeds the college selection for tests (same pattern as
// ConceptMappingTable) — jsdom can't drive the portal-based Combobox.
export default function ConceptGraphView({ initialCollegeId = null }) {
  const colleges = useColleges()
  const [collegeId, setCollegeId] = useState(initialCollegeId)
  const graph = usePrereqGraph(collegeId)

  const collegeOptions = useMemo(() => [
    { value: null, label: 'Canonical concepts (no college)' },
    ...(colleges.data || []).map((c) => ({ value: c.source_id, label: c.name })),
  ], [colleges.data])

  if (graph.isLoading) return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  if (graph.isError) return <Alert type='error'>Failed to load the prerequisite graph.</Alert>
  const d = graph.data

  let nodes; let edges; let hollow = new Set()
  if (collegeId == null) {
    nodes = d.concepts.map((c) => ({
      id: c.slug, label: c.name, sub: c.discipline,
      title: `${c.name} (${c.slug})${c.requires.length ? ` — requires ${c.requires.join(', ')}` : ''}${c.note ? ` · ${c.note}` : ''}`,
    }))
    edges = d.rules
  } else {
    const mapped = (d.courses || []).filter((c) => c.concept)
    nodes = mapped.map((c) => ({
      id: c.key, label: `${c.prefix} ${c.number}`, sub: c.concept,
      title: `${c.prefix} ${c.number} — ${c.title} (${c.concept})`,
    }))
    // Concepts with no course here render hollow so the gap is visible.
    const present = new Set(mapped.map((c) => c.concept))
    const missing = d.concepts.filter((c) => !present.has(c.slug))
    nodes = nodes.concat(missing.map((c) => ({
      id: `concept:${c.slug}`, label: c.name, sub: 'no course here',
      title: `${c.name}: no ${c.slug} course at this college`,
    })))
    hollow = new Set(missing.map((c) => `concept:${c.slug}`))
    edges = d.edges
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
      { label: 'In-scope courses', value: s.in_scope },
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
        : { label: 'Legacy rows', value: 'none', sub: 'previous group had no data here' },
    ]

  return (
    <Stack gap='cozy'>
      <div className='flex items-center gap-3'>
        <div className='w-80'>
          <Combobox value={collegeId} onChange={setCollegeId} options={collegeOptions}
            placeholder='Canonical concepts (no college)' />
        </div>
      </div>
      <StatStrip tiles={tiles} />
      {nodes.length
        ? <DagSvg nodes={nodes} edges={edges} hollowIds={hollow} />
        : <Alert type='info'>Nothing to draw yet — add concepts or run the importer.</Alert>}
      <div className='surface-card px-[22px] py-[18px]'>
        <p className='text-label mb-2.5'>Rules</p>
        <table className='min-w-full text-left'>
          <thead><tr>
            <th className='text-label pb-2 pr-6'>Concept</th>
            <th className='text-label pb-2'>Requires</th>
          </tr></thead>
          <tbody>
            {d.concepts.map((c) => (
              <tr key={c.slug} className='border-t border-border/40'>
                <td className='py-2 pr-6 text-caption text-ink'>{c.name} <span className='font-mono text-ink-subtle'>({c.slug})</span></td>
                <td className='py-2 text-caption text-ink-muted font-mono'>{c.requires.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  )
}
