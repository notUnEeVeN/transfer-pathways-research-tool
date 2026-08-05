import React, { useMemo } from 'react'
import { Alert, Spinner, Stack, StatStrip } from '../components/ui'
import { CA_FIGURE } from '../analyses/californiaFigureStyle'
import { useMdCoverageMatrix } from './useMaryland'

/**
 * Maryland ports of the two California coverage figures, rendered when the
 * Visuals page's selected major is a Maryland one (state: 'md').
 *
 *   MdCoverageMatrix    — program × college completeness grid, the analog of
 *                          "Transfer coverage by district". Maryland has no
 *                          district construction: the college IS the row unit,
 *                          its service area set by statute.
 *   MdCoverageHistogram — colleges by number of complete programs, the analog
 *                          of "Districts by complete campus coverage".
 *
 * Both read the same /api/md/coverage-matrix response: one strict-engine
 * verdict per stored agreement whose program title matches the major's filter.
 */

const NAVY = CA_FIGURE.navy
const GRID = '#111111'

/** Program rows grouped by university, with a short track suffix when a
 *  university publishes the major as several tracks. */
function programRows(rows) {
  const byProgram = new Map()
  for (const r of rows) {
    const key = `${r.university_id}|${r.major}`
    const p = byProgram.get(key) || {
      key, university: r.university_name, major: r.major, cells: new Map(),
    }
    p.cells.set(r.college_id, r.complete)
    byProgram.set(key, p)
  }
  const list = [...byProgram.values()]
  const perUniversity = new Map()
  for (const p of list) perUniversity.set(p.university, (perUniversity.get(p.university) || 0) + 1)
  for (const p of list) {
    if (perUniversity.get(p.university) === 1) { p.label = p.university; continue }
    // Strip the shared program stem so multi-track universities read as
    // "University — Track" rather than repeating the major name per row.
    const track = p.major.replace(/^computer science[^a-z0-9]*/i, '').trim()
    p.label = `${p.university} — ${track || p.major}`
  }
  return list.sort((a, b) => a.university.localeCompare(b.university) || a.major.localeCompare(b.major))
}

function collegeColumns(rows) {
  const seen = new Map()
  for (const r of rows) if (!seen.has(r.college_id)) seen.set(r.college_id, r.college_name)
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

function useMatrix(matchText) {
  const matrix = useMdCoverageMatrix(matchText)
  const model = useMemo(() => {
    const rows = matrix.data?.rows || []
    const programs = programRows(rows)
    const colleges = collegeColumns(rows)
    const completeCells = rows.filter((r) => r.complete).length
    return { rows, programs, colleges, completeCells }
  }, [matrix.data])
  return { matrix, ...model }
}

function LoadState({ matrix, what }) {
  if (matrix.isPending) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }
  return (
    <Alert type='error'>
      Could not load {what}. If the Maryland collections have not been imported yet,
      run <code>npm run artsys:import:local</code> in <code>server/</code>.
    </Alert>
  )
}

export function MdCoverageMatrix({ majorLabel = 'Computer Science (MD)', matchText = 'computer science' }) {
  const { matrix, rows, programs, colleges, completeCells } = useMatrix(matchText)
  if (matrix.isPending || matrix.isError) return <LoadState matrix={matrix} what='the Maryland coverage matrix' />

  return (
    <Stack gap='section'>
      <StatStrip tiles={[
        { label: 'Programs', value: programs.length },
        { label: 'Colleges', value: colleges.length },
        { label: 'Complete cells', value: `${completeCells} of ${rows.length}` },
        { label: 'Complete share', value: rows.length ? `${Math.round((completeCells / rows.length) * 100)}%` : '—' },
      ]} />

      <div className='surface-card p-6 overflow-x-auto'
        style={{ fontFamily: CA_FIGURE.fontFamily, color: CA_FIGURE.ink }}>
        <p className='text-body-strong mb-1'>
          Complete transfer paths — {majorLabel}
        </p>
        <p className='text-caption text-ink-muted mb-4'>
          A filled cell means the strict eligibility engine finds a complete path from that
          college into that program. Colleges are numbered alphabetically; the key is below.
        </p>
        <table className='border-collapse' style={{ borderColor: GRID }}>
          <thead>
            <tr>
              <th className='text-left pr-4 pb-2 text-caption font-[550]'>Program</th>
              {colleges.map((c, i) => (
                <th key={c.id} className='pb-2 px-0.5 text-caption font-[550] text-center' title={c.name}>
                  {i + 1}
                </th>
              ))}
              <th className='pl-3 pb-2 text-caption font-[550] text-right'>Complete</th>
            </tr>
          </thead>
          <tbody>
            {programs.map((p) => {
              const complete = colleges.filter((c) => p.cells.get(c.id)).length
              return (
                <tr key={p.key}>
                  <td className='pr-4 py-0.5 text-caption whitespace-nowrap' title={`${p.university} · ${p.major}`}>
                    {p.label}
                  </td>
                  {colleges.map((c) => (
                    <td key={c.id} className='px-0.5 py-0.5'>
                      <div title={`${c.name} → ${p.university} · ${p.major}: ${p.cells.get(c.id) ? 'complete' : 'incomplete'}`}
                        style={{
                          width: 22, height: 22, border: `1px solid ${GRID}`,
                          background: p.cells.get(c.id) ? NAVY : '#FFFFFF',
                        }} />
                    </td>
                  ))}
                  <td className='pl-3 py-0.5 text-caption text-right tabular-nums'>
                    {complete}/{colleges.length}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className='text-tag text-ink-subtle mt-4'>
          {colleges.map((c, i) => `${i + 1} ${c.name}`).join(' · ')}
        </p>
      </div>
    </Stack>
  )
}

export function MdCoverageHistogram({ majorLabel = 'Computer Science (MD)', matchText = 'computer science' }) {
  const { matrix, programs, colleges } = useMatrix(matchText)
  if (matrix.isPending || matrix.isError) return <LoadState matrix={matrix} what='the Maryland coverage histogram' />

  // Colleges bucketed by how many of the major's programs they complete.
  const completeByCollege = colleges.map((c) => ({
    ...c,
    complete: programs.filter((p) => p.cells.get(c.id)).length,
  }))
  const maxComplete = programs.length
  // Every bucket from 0 through all programs is drawn, empty or not, so the
  // axis reads as the full 0..N range rather than a gap-riddled subset.
  const buckets = Array.from({ length: maxComplete + 1 }, (_, n) => ({
    n,
    colleges: completeByCollege.filter((c) => c.complete === n),
  }))
  const tallest = Math.max(...buckets.map((b) => b.colleges.length), 1)

  return (
    <Stack gap='section'>
      <div className='surface-card p-6' style={{ fontFamily: CA_FIGURE.fontFamily, color: CA_FIGURE.ink }}>
        <p className='text-body-strong mb-1'>
          Colleges by number of complete programs — {majorLabel}
        </p>
        <p className='text-caption text-ink-muted mb-5'>
          Of the {programs.length} {majorLabel} programs with published guides, how many are
          fully articulable from each college, by the strict eligibility engine.
        </p>
        <div className='flex items-end gap-4' style={{ minHeight: 220 }}>
          {buckets.map((b) => (
            <div key={b.n} className='flex flex-col items-center gap-1.5'
              title={b.colleges.map((c) => c.name).join('\n') || 'no colleges'}>
              <span className='text-caption tabular-nums'>{b.colleges.length || ''}</span>
              <div style={b.colleges.length ? {
                width: 30,
                height: Math.max(10, (b.colleges.length / tallest) * 180),
                background: NAVY, border: `1px solid ${GRID}`,
              } : { width: 30, height: 1, background: GRID }} />
              <span className='text-caption tabular-nums'>{b.n}</span>
            </div>
          ))}
        </div>
        <p className='text-caption text-ink-muted mt-2'>complete programs, of {programs.length}</p>
      </div>
    </Stack>
  )
}
