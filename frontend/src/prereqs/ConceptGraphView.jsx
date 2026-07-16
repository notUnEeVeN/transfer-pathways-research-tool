import React, { useMemo, useState } from 'react'
import { Alert, Combobox, Spinner, Stack, StatStrip } from '../components/ui'
import { useColleges, usePrereqGraph } from '../shared/query/hooks/useData'
import { layoutDag } from './dagLayout'

const NODE_W = 176
const NODE_H = 46
const COL_GAP = 120
const ROW_GAP = 36
const PAD = 20

// Hand-built layered DAG per house chart rules: CSS vars carry color, inline
// attributes carry geometry, every mark has a title, and a rules table below
// keeps everything reachable without hover. Only CONNECTED nodes are drawn —
// standalone concepts render as a chip grid outside the SVG (see caller) so
// they don't stack into a tall, edge-less first column.
function DagSvg({ nodes, edges }) {
  const { columns } = layoutDag(nodes, edges)

  // Barycenter sweeps: order each column by the mean row of its neighbors on
  // the reference side, alternating direction — cheap crossing reduction that
  // makes chains read straight instead of weaving.
  const rowOf = new Map()
  columns.forEach((col) => col.forEach((id, i) => rowOf.set(id, i)))
  const preds = new Map(nodes.map((n) => [n.id, []]))
  const succs = new Map(nodes.map((n) => [n.id, []]))
  for (const e of edges) {
    if (preds.has(e.to) && succs.has(e.from)) {
      preds.get(e.to).push(e.from)
      succs.get(e.from).push(e.to)
    }
  }
  const meanRow = (ids) => (ids.length
    ? ids.reduce((s, id) => s + (rowOf.get(id) ?? 0), 0) / ids.length
    : null)
  for (let sweep = 0; sweep < 4; sweep += 1) {
    const forward = sweep % 2 === 0
    for (const col of (forward ? columns : [...columns].reverse())) {
      const ref = forward ? preds : succs
      col.sort((a, b) => {
        const ma = meanRow(ref.get(a) || [])
        const mb = meanRow(ref.get(b) || [])
        if (ma == null && mb == null) return String(a).localeCompare(String(b))
        if (ma == null) return 1
        if (mb == null) return -1
        return ma - mb
      })
      col.forEach((id, i) => rowOf.set(id, i))
    }
  }

  // Vertically center shorter columns against the tallest one.
  const maxRows = Math.max(...columns.map((c) => c.length), 1)
  const pos = new Map()
  columns.forEach((col, ci) => {
    const offset = ((maxRows - col.length) * (NODE_H + ROW_GAP)) / 2
    col.forEach((id, ri) => {
      pos.set(id, { x: PAD + ci * (NODE_W + COL_GAP), y: PAD + offset + ri * (NODE_H + ROW_GAP) })
    })
  })
  const width = PAD * 2 + columns.length * NODE_W + (columns.length - 1) * COL_GAP
  const height = PAD * 2 + maxRows * (NODE_H + ROW_GAP) - ROW_GAP
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
              fill='none' stroke='var(--color-border-strong, #8a8a8a)' strokeWidth='1.5' opacity='0.8'>
              <title>{`${byId.get(e.from)?.label ?? e.from} → ${byId.get(e.to)?.label ?? e.to}`}</title>
            </path>
          )
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)
          if (!p) return null
          return (
            <g key={n.id} transform={`translate(${p.x}, ${p.y})`}>
              <title>{n.title || n.label}</title>
              <rect width={NODE_W} height={NODE_H} rx='10'
                fill='var(--color-surface, #fff)'
                stroke='var(--color-border, #d4d4d4)' strokeWidth='1.25' />
              <text x='12' y='20' fontSize='12.5' fontWeight='600'
                fill='var(--color-ink, #1a1a1a)'>{n.label}</text>
              <text x='12' y='35' fontSize='10.5'
                fill='var(--color-ink-subtle, #7a7a7a)'>{n.sub || ''}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Compact chip grid for concepts that have no place in the drawn DAG —
// standalone (rule-less) concepts in canonical mode, missing-course gaps in
// college mode. Flex-wrapped so it costs one or two rows, not a column.
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

export default function ConceptGraphView({ initialCollegeId = null }) {
  // initialCollegeId exists so tests can render college mode without driving
  // the portal-based Combobox in jsdom; the app mounts this with no props.
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

  let nodes; let edges; let chips = null
  if (collegeId == null) {
    const connected = new Set(d.rules.flatMap((r) => [r.from, r.to]))
    nodes = d.concepts.filter((c) => connected.has(c.slug)).map((c) => ({
      id: c.slug, label: c.name, sub: c.discipline,
      title: `${c.name} (${c.slug})${c.requires.length ? ` — requires ${c.requires.join(', ')}` : ''}${c.note ? ` · ${c.note}` : ''}`,
    }))
    edges = d.rules
    chips = (
      <ConceptChips heading='Standalone concepts' sub='no prerequisite rules in either direction'
        items={d.concepts.filter((c) => !connected.has(c.slug)).map((c) => ({
          slug: c.slug, name: c.name, title: `${c.name} (${c.slug})${c.note ? ` · ${c.note}` : ''}`,
        }))} />
    )
  } else {
    const mapped = (d.courses || []).filter((c) => c.concept)
    const conceptOf = new Map(d.concepts.map((c) => [c.slug, c]))
    nodes = mapped.map((c) => ({
      id: c.key, label: `${c.prefix} ${c.number}`, sub: c.concept,
      title: `${c.prefix} ${c.number} — ${c.title} (${c.concept})`,
    }))
    edges = d.edges
    // Courses whose concept has no edges here still deserve a spot: they render
    // as chips alongside the true gaps rather than floating disconnected.
    const drawnIds = new Set(d.edges.flatMap((e) => [e.from, e.to]))
    const standaloneCourses = mapped.filter((c) => !drawnIds.has(c.key))
    nodes = nodes.filter((n) => drawnIds.has(n.id))
    const present = new Set(mapped.map((c) => c.concept))
    const missing = d.concepts.filter((c) => !present.has(c.slug) && (c.requires.length || d.rules.some((r) => r.from === c.slug)))
    chips = (
      <Stack gap='cozy'>
        <ConceptChips heading='No course here' sub='chain-relevant concepts this college has no mapped course for'
          items={missing.map((c) => ({ slug: c.slug, name: c.name, title: `${c.name} (${c.slug}) — no course at this college` }))} />
        <ConceptChips heading='Mapped, no local edges' sub='courses whose concept has no prerequisite relationship at this college'
          items={standaloneCourses.map((c) => ({
            slug: c.key, name: `${c.prefix} ${c.number}`,
            title: `${c.prefix} ${c.number} — ${c.title} (${conceptOf.get(c.concept)?.name ?? c.concept})`,
          }))} />
      </Stack>
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
      {nodes.length > 0 && <DagSvg nodes={nodes} edges={edges} />}
      {!nodes.length && collegeId == null && !d.concepts.length && (
        <Alert type='info'>Nothing to draw yet — add concepts or run the importer.</Alert>
      )}
      {chips}
      <div className='surface-card px-[22px] py-[18px]'>
        <p className='text-label mb-2.5'>Rules</p>
        <table className='min-w-full text-left'>
          <thead><tr>
            <th className='text-label pb-2 pr-6'>Concept</th>
            <th className='text-label pb-2 pr-6'>Requires</th>
            <th className='text-label pb-2'>Satisfies</th>
          </tr></thead>
          <tbody>
            {d.concepts.map((c) => (
              <tr key={c.slug} className='border-t border-border/40'>
                <td className='py-2 pr-6 text-caption text-ink'>{c.name} <span className='font-mono text-ink-subtle'>({c.slug})</span></td>
                <td className='py-2 pr-6 text-caption text-ink-muted font-mono'>{c.requires.join(', ') || '—'}</td>
                <td className='py-2 text-caption text-ink-muted font-mono'>{(c.satisfies || []).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Stack>
  )
}
