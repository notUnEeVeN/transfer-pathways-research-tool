import React, { useState } from 'react'
import { Stack } from '../components/ui'
import snapshot from './priceOfPlaceSnapshot.json'

/**
 * "The Price of Place" — a five-figure sequence: Computer Science transfer
 * preparation is gated by where you start — the wealth of your district and
 * its distance to a campus — in a way the rest of the UC curriculum is not.
 *
 * Figures 1–3 are faithful to the design handoff
 * (docs/design_handoff_price_of_place_figures — "The Price of Place.dc.html"
 * is the detailed spec; the v2 file is the read-at-a-glance register).
 * Figures 4–5 replace the handoff's course-catalogue and audit beats with the
 * distance investigation: the tether map (the confound, shown) and the gate
 * grid (the confound, dismantled by stratification). Every value comes from
 * the committed snapshot, computed from the FULL agreement corpus by
 * server/scripts/generatePriceOfPlaceSnapshot.js. The application database
 * never carries the ~120k-agreement corpus.
 *
 * Every figure measures formal opportunity — whether a complete transfer
 * path formally exists — never student behaviour.
 */

const INK = '#193018'
const SOFT = '#4A5849'
const MUTED_TEXT = '#6B776A'
const MUTED_LINE = '#9CA69B'
const GRID = 'rgba(25,48,24,0.10)'
const GRID_STRONG = 'rgba(25,48,24,0.16)'
const AXIS = 'rgba(25,48,24,0.28)'
const CS_BLUE = '#0072B2'
const FIELD = '#6F7B6E'
const GAINED = '#0D7964'
const Q1_FILL = '#A9C3DE'
const Q4_FILL = '#1E3A5F'
const CONN = '#6E93BF'
const AMBER_TEXT = '#8A5A00'
const AMBER_BORDER = '#E69F00'
const FONT = "'Hanken Grotesk Variable', 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif"

// Registers: detailed = the paper-facing file; glance = the v2 file (nothing
// under 15px, conclusions as headlines).
const REGISTERS = {
  detailed: { tick: 12.5, row: 15.5, course: 14.5, note: 12.5, panel: 16, big: 24, delta: 13, dotR: 7, conn: 5 },
  glance: { tick: 15, row: 19, course: 17, note: 15, panel: 18, big: 34, delta: 16, dotR: 9, conn: 8 },
}

const tetherRatio = (
  snapshot.distance.medianKmByQuartile[0] / snapshot.distance.medianKmByQuartile[3]
).toFixed(1)

const HEADLINES = {
  1: 'Two of the nine are shut to everyone. One is open to almost everyone. Six come down to money.',
  2: 'The map of Computer Science opportunity is the map of wealth — pale in the same places.',
  3: 'Both start in the same place. Computer Science responds three times as hard.',
  4: `The campuses sit where the money is — the poorest districts are ${tetherRatio}× as far from the nearest campus as the richest.`,
  5: 'Hold distance fixed and income still pays. Hold income fixed and distance still pays. Both gates swing hardest for Computer Science.',
}

const kFmt = (v) => `$${(v / 1000).toFixed(1)}k`
const moneyFmt = new Intl.NumberFormat('en-US')
const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const pct = (v) => `${pctFmt.format(v * 100)}%`
const pts = (v) => Math.round(v * 100)
const kmToMi = (km) => Math.round(km * 0.621371)
const svgProps = (height, label) => ({
  viewBox: `0 0 1240 ${height}`,
  role: 'img',
  'aria-label': label,
  className: 'block h-auto w-full',
  'data-export-width': 1240,
  style: { fontFamily: FONT, fontVariantNumeric: 'tabular-nums' },
})

// ───────── beat chrome (the handoff's section anatomy) ─────────

function Beat({ no, role, title, standfirst, mode, children }) {
  return (
    <section aria-label={title}
      className='bg-white rounded-[14px] border flex flex-col gap-5'
      style={{ borderColor: 'rgba(25,48,24,0.11)', padding: '30px 34px 28px' }}>
      <div className='flex flex-col gap-2 max-w-[80ch]'>
        <span className='text-[11.5px] tracking-[0.11em] uppercase font-[700]' style={{ color: CS_BLUE }}>
          {no} · {role}
        </span>
        <h3 className='m-0 text-[26px] leading-[1.14] tracking-[-0.018em] font-[600]' style={{ color: INK }}>{title}</h3>
        {mode === 'glance'
          ? <p className='m-0 text-[18px] leading-snug font-[650]' style={{ color: INK }}>{HEADLINES[no]}</p>
          : <p className='m-0 text-[15px] leading-normal' style={{ color: SOFT }}>{standfirst}</p>}
      </div>
      <div className='rounded-[10px] border bg-white' style={{ borderColor: GRID, padding: '18px 14px 10px' }}>
        {children}
      </div>
    </section>
  )
}

// ───────── Figure 1 — slope rows, grouped by regime ─────────

export function fig1Rows() {
  const byRegime = (regime) => snapshot.fig1.filter((p) => p.regime === regime)
    .sort((a, b) => b.q1 - a.q1 || a.campus.localeCompare(b.campus))
  return [
    { regime: 'closed', members: byRegime('closed') },
    { regime: 'open', members: byRegime('open') },
    { regime: 'contested', members: byRegime('contested') },
  ]
}

function Fig1({ reg }) {
  const [closed, open, contested] = fig1Rows()
  const x = (v) => 300 + v * 760
  const { medianIncome } = snapshot.fig3
  // Design coordinates: closed rows at 136/168, open 274, contested 354 + i·32.
  const rowStep = reg.row > 16 ? 38 : 32
  const closedYs = [136, 168]
  const openY = 274
  const contestedY = (i) => 354 + i * rowStep
  const height = 604 + (rowStep - 32) * 5
  const bandH = contested.members.length * rowStep + 42
  const label = (p) => (p.campus === 'Berkeley' ? 'UC Berkeley EECS' : `UC ${p.campus === 'UCLA' ? 'Los Angeles' : p.campus}`)
  return (
    <svg {...svgProps(height, 'Nine UC Computer Science programs grouped into three regimes: two closed in every district, one open nearly everywhere, six decided by district wealth.')}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>Districts with a complete transfer path, by income quartile</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>One row per program · 18 districts per quartile</text>
      <text x='1212' y='46' fontSize='12' fill={MUTED_TEXT} textAnchor='end'>Swing, Q1 → Q4</text>

      <rect x='28' y='302' width='1184' height={bandH} rx='8' fill='rgba(46,92,138,0.045)' />

      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
        <g key={v}>
          <line x1={x(v)} y1='78' x2={x(v)} y2={height - 66} stroke={i === 0 ? GRID_STRONG : GRID} strokeWidth='1' />
          <text x={x(v)} y='70' fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='middle'>{pct(v)}</text>
        </g>
      ))}

      <text x='28' y='108' fontSize='12' fontWeight='700' fill={MUTED_TEXT} letterSpacing='0.08em'>CLOSED EVERYWHERE — WEALTH IRRELEVANT</text>
      {closed.members.map((p, i) => (
        <g key={p.campus}>
          <text x='272' y={closedYs[i] + 5} fontSize={reg.row} fontWeight='600' fill={INK} textAnchor='end'>{label(p)}</text>
          <circle cx={x(0)} cy={closedYs[i]} r={reg.dotR} fill='#FFFFFF' stroke={MUTED_LINE} strokeWidth='1.6'>
            <title>{`${label(p)} Computer Science: 0% of districts in every income quartile`}</title>
          </circle>
          <text x='318' y={closedYs[i] + 5} fontSize={reg.tick} fill={MUTED_TEXT}>
            {i === 0 ? '0% in every quartile — no California community college fully articulates its demands' : '0% in every quartile'}
          </text>
          <text x='1212' y={closedYs[i] + 5} fontSize={reg.delta} fontWeight='600' fill={MUTED_LINE} textAnchor='end'>none</text>
        </g>
      ))}

      <text x='28' y='246' fontSize='12' fontWeight='700' fill={MUTED_TEXT} letterSpacing='0.08em'>OPEN NEARLY EVERYWHERE — WEALTH IRRELEVANT</text>
      {open.members.map((p) => (
        <g key={p.campus}>
          <text x='272' y={openY + 5} fontSize={reg.row} fontWeight='600' fill={INK} textAnchor='end'>{label(p)}</text>
          <line x1={x(p.q1)} y1={openY} x2={x(p.q4)} y2={openY} stroke={CONN} strokeWidth={reg.conn} strokeLinecap='round' />
          <circle cx={x(p.q1)} cy={openY} r={reg.dotR} fill={Q1_FILL} stroke='#FFFFFF' strokeWidth='1.5'>
            <title>{`${label(p)}, poorest quartile: ${pct(p.q1)} of districts`}</title>
          </circle>
          <circle cx={x(p.q4)} cy={openY} r={reg.dotR} fill={Q4_FILL} stroke='#FFFFFF' strokeWidth='1.5'>
            <title>{`${label(p)}, richest quartile: ${pct(p.q4)} of districts`}</title>
          </circle>
          <text x={x(Math.min(p.q1, p.q4)) - 18} y={openY + 5} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(p.q1)}</text>
          <text x={x(Math.max(p.q1, p.q4)) + 18} y={openY + 5} fontSize={reg.tick} fontWeight='600' fill={INK}>{pct(p.q4)}</text>
          <text x='1212' y={openY + 5} fontSize={reg.delta} fontWeight='600' fill={MUTED_TEXT} textAnchor='end'>+{pts(p.q4 - p.q1)}</text>
        </g>
      ))}

      <text x='28' y='326' fontSize='12' fontWeight='700' fill={CS_BLUE} letterSpacing='0.08em'>DECIDED BY THE WEALTH OF YOUR DISTRICT</text>
      {contested.members.map((p, i) => {
        const cy = contestedY(i)
        return (
          <g key={p.campus}>
            <text x='272' y={cy + 5} fontSize={reg.row} fontWeight='600' fill={INK} textAnchor='end'>{`UC ${p.campus}`}</text>
            <line x1={x(p.q1)} y1={cy} x2={x(p.q4)} y2={cy} stroke={CONN} strokeWidth={reg.conn} strokeLinecap='round' />
            <circle cx={x(p.q1)} cy={cy} r={reg.dotR} fill={Q1_FILL} stroke='#FFFFFF' strokeWidth='1.5'>
              <title>{`UC ${p.campus}, poorest quartile: ${pct(p.q1)} of districts`}</title>
            </circle>
            <circle cx={x(p.q4)} cy={cy} r={reg.dotR} fill={Q4_FILL} stroke='#FFFFFF' strokeWidth='1.5'>
              <title>{`UC ${p.campus}, richest quartile: ${pct(p.q4)} of districts`}</title>
            </circle>
            <text x={x(p.q1) - 18} y={cy + 5} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(p.q1)}</text>
            <text x={x(p.q4) + 18} y={cy + 5} fontSize={reg.tick} fontWeight='600' fill={INK}>{pct(p.q4)}</text>
            <text x='1212' y={cy + 5} fontSize={reg.delta} fontWeight='600' fill={GAINED} textAnchor='end'>+{pts(p.q4 - p.q1)}</text>
          </g>
        )
      })}

      <g>
        <rect x='28' y={height - 48} width='760' height='34' rx='5' fill='rgba(255,255,255,0.9)' />
        <circle cx='42' cy={height - 31} r={reg.dotR} fill={Q1_FILL} stroke='#FFFFFF' strokeWidth='1.5' />
        <text x='58' y={height - 26} fontSize='13' fill={INK}>Poorest quartile (Q1, {kFmt(medianIncome[0])} median)</text>
        <circle cx='330' cy={height - 31} r={reg.dotR} fill={Q4_FILL} stroke='#FFFFFF' strokeWidth='1.5' />
        <text x='346' y={height - 26} fontSize='13' fill={INK}>Richest quartile (Q4, {kFmt(medianIncome[3])} median)</text>
        <circle cx='620' cy={height - 31} r={reg.dotR} fill='#FFFFFF' stroke={MUTED_LINE} strokeWidth='1.6' />
        <text x='636' y={height - 26} fontSize='13' fill={INK}>No path from any district</text>
      </g>
    </svg>
  )
}

// ───────── Figure 2 — twin point maps ─────────

export function projectCA(lon, lat) {
  return { px: (lon + 130) * Math.cos((37 * Math.PI) / 180), py: 44 - lat }
}

function useMapLayout() {
  const { districts, outline } = snapshot.fig2
  const pts = outline.map(([lon, lat]) => projectCA(lon, lat))
  const dpts = districts.map((d) => projectCA(d.lon, d.lat))
  const xs = [...pts, ...dpts].map((p) => p.px)
  const ys = [...pts, ...dpts].map((p) => p.py)
  const x0 = Math.min(...xs); const x1 = Math.max(...xs)
  const y0 = Math.min(...ys); const y1 = Math.max(...ys)
  const W = 420; const H = 424
  const scale = Math.min(W / (x1 - x0), H / (y1 - y0))
  return {
    outlinePath: pts.map((p, i) => `${i ? 'L' : 'M'}${((p.px - x0) * scale).toFixed(1)},${((p.py - y0) * scale).toFixed(1)}`).join(' '),
    place: (d) => {
      const p = projectCA(d.lon, d.lat)
      return { cx: (p.px - x0) * scale, cy: (p.py - y0) * scale }
    },
  }
}

const RAMP = [Q1_FILL, CONN, '#38618C', Q4_FILL]
const QUARTILE_NAME = ['poorest', 'second', 'third', 'richest']

function Fig2({ reg, mode }) {
  const { districts, stats } = snapshot.fig2
  const { outlinePath, place } = useMapLayout()
  const dotR = mode === 'glance' ? 6.6 : 5.4
  const le2ByQ = [0, 1, 2, 3].map((q) => districts.filter((d) => d.reach <= 2 && d.incomeQuartile === q).length)
  const mapGroup = (tx, colorOf, describe) => (
    <g transform={`translate(${tx}, 76)`}>
      <path d={outlinePath} fill='#FBFCFA' stroke={MUTED_LINE} strokeWidth='1.1' strokeLinejoin='round' />
      {districts.map((d) => {
        const { cx, cy } = place(d)
        return (
          <circle key={d.district} cx={cx} cy={cy} r={dotR} fill={colorOf(d)} stroke='#FFFFFF' strokeWidth='1'
            role='img' aria-label={describe(d)}>
            <title>{describe(d)}</title>
          </circle>
        )
      })}
    </g>
  )
  return (
    <>
      <svg {...svgProps(624, "Two maps of California's community college districts, one shaded by district income quartile and one by number of programs reachable. The patterns are close to identical.")}>
        <text x='200' y='30' fontSize='17' fontWeight='500' fill={INK}>A · The wealth of the place you start</text>
        <text x='200' y='52' fontSize={reg.tick} fill={MUTED_TEXT}>Mean income per return across the service area</text>
        <text x='660' y='30' fontSize='17' fontWeight='500' fill={CS_BLUE}>B · The Computer Science you can reach</text>
        <text x='660' y='52' fontSize={reg.tick} fill={MUTED_TEXT}>Complete transfer paths, of the nine programs</text>

        {mapGroup(208,
          (d) => RAMP[d.incomeQuartile],
          (d) => `${d.district}: mean income $${moneyFmt.format(d.income)} per return (${QUARTILE_NAME[d.incomeQuartile]} quartile)`)}
        {mapGroup(668,
          (d) => RAMP[d.reachBand],
          (d) => `${d.district}: a complete transfer path formally exists to ${d.reach} of the nine programs`)}

        <g>
          <text x='200' y='528' fontSize='12.5' fontWeight='500' fill={INK}>Income quartile</text>
          {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
            <g key={q}>
              <rect x={200 + i * 50} y='540' width='16' height='16' rx='2' fill={RAMP[i]} />
              <text x={222 + i * 50} y='553' fontSize='12.5' fill={SOFT}>{q}</text>
            </g>
          ))}
          <text x='200' y='578' fontSize='11.5' fill={MUTED_TEXT}>$50k ————————————→ $434k</text>
        </g>
        <g>
          <text x='660' y='528' fontSize='12.5' fontWeight='500' fill={INK}>Programs reachable, of nine</text>
          {['0–2', '3–4', '5–6', '7–9'].map((q, i) => (
            <g key={q}>
              <rect x={660 + i * 62} y='540' width='16' height='16' rx='2' fill={RAMP[i]} />
              <text x={682 + i * 62} y='553' fontSize='12.5' fill={SOFT}>{q}</text>
            </g>
          ))}
          <text x='660' y='578' fontSize='11.5' fill={MUTED_TEXT}>Shut out ————————→ Nearly open</text>
        </g>
      </svg>

      {/* The handoff's human-denominator strip: two computed cells and the
          amber pending cut, exactly as designed. */}
      <div className='mt-3 grid grid-cols-3 rounded-[10px] border overflow-hidden' data-export-exclude
        style={{ borderColor: GRID }}>
        <div className='px-5 py-4 flex flex-col gap-1.5 border-r' style={{ borderColor: GRID }}>
          <span className='text-[11px] tracking-[0.09em] uppercase font-[600]' style={{ color: MUTED_TEXT }}>Districts with no path at all</span>
          <span className='text-[30px] font-[600] leading-none tabular-nums' style={{ color: INK }}>{stats.reachNone}</span>
          <span className='text-[12.5px]' style={{ color: MUTED_TEXT }}>
            {stats.reachNoneAllPoorest ? `all ${stats.reachNone} in the poorest quartile` : 'across quartiles'}
          </span>
        </div>
        <div className='px-5 py-4 flex flex-col gap-1.5 border-r' style={{ borderColor: GRID }}>
          <span className='text-[11px] tracking-[0.09em] uppercase font-[600]' style={{ color: MUTED_TEXT }}>Districts reaching two or fewer</span>
          <span className='text-[30px] font-[600] leading-none tabular-nums' style={{ color: INK }}>{stats.reachTwoOrFewer}</span>
          <span className='text-[12.5px]' style={{ color: MUTED_TEXT }}>{le2ByQ[0]} of them in Q1, {le2ByQ[3] === 0 ? 'none' : le2ByQ[3]} in Q4</span>
        </div>
        <div className='px-5 py-4 flex flex-col gap-1.5' style={{ background: 'rgba(230,159,0,0.07)' }}>
          <span className='text-[11px] tracking-[0.09em] uppercase font-[600]' style={{ color: AMBER_TEXT }}>Students living in those districts</span>
          <span className='inline-flex items-center gap-2'>
            <span className='text-[30px] font-[600] leading-none' style={{ color: '#B98200' }}>———</span>
            <span className='text-[11px] font-[600] rounded-[5px] px-2 py-0.5 tracking-[0.05em]'
              style={{ color: AMBER_TEXT, border: `1px dashed ${AMBER_BORDER}` }}>CUT NEEDED</span>
          </span>
          <span className='text-[12.5px]' style={{ color: AMBER_TEXT }}>public headcount × district crosswalk</span>
        </div>
      </div>
    </>
  )
}

// ───────── Figure 3 — two quartile paths, divergence shaded ─────────

function Fig3({ reg }) {
  const { cs, field, medianIncome } = snapshot.fig3
  const x = (q) => 220 + q * 240
  const y = (v) => 452 - v * 450 // 80% → y=92, per the design's scale
  const csPts = cs.map((v, q) => `${x(q)},${y(v)}`).join(' ')
  const fieldPts = field.map((v, q) => `${x(q)},${y(v)}`).join(' ')
  const wedge = `${cs.map((v, q) => `${x(q)},${y(v)}`).join(' ')} ${[3, 2, 1, 0].map((q) => `${x(q)},${y(field[q])}`).join(' ')}`
  const n = snapshot.counts.fieldPrograms
  return (
    <svg {...svgProps(572, `Share of districts with a complete transfer path rises from ${pct(field[0])} to ${pct(field[3])} for ${n} non-computing majors, and from ${pct(cs[0])} to ${pct(cs[3])} for the nine Computer Science programs.`)}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>Share of a quartile’s districts with a complete transfer path</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>Straight segments between quartile means — no curve is being fitted</text>

      {[0, 0.2, 0.4, 0.6, 0.8].map((v, i) => (
        <g key={v}>
          <line x1='220' y1={y(v)} x2='940' y2={y(v)} stroke={i === 0 ? AXIS : GRID} strokeWidth='1' />
          <text x='204' y={y(v) + 5} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(v)}</text>
        </g>
      ))}

      <polygon points={wedge} fill='rgba(0,114,178,0.09)' />
      <polyline points={fieldPts} fill='none' stroke={FIELD} strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' />
      {field.map((v, q) => (
        <circle key={q} cx={x(q)} cy={y(v)} r='6' fill={FIELD}>
          <title>{`${n} other UC majors, Q${q + 1}: ${pct(v)}`}</title>
        </circle>
      ))}
      <polyline points={csPts} fill='none' stroke={CS_BLUE} strokeWidth='3.4' strokeLinecap='round' strokeLinejoin='round' />
      {cs.map((v, q) => (
        <circle key={q} cx={x(q)} cy={y(v)} r='7' fill={CS_BLUE} stroke='#FFFFFF' strokeWidth='1.5'>
          <title>{`Nine UC Computer Science programs, Q${q + 1}: ${pct(v)}`}</title>
        </circle>
      ))}

      <text x='962' y='136' fontSize='14' fontWeight='600' fill={CS_BLUE}>Computer Science</text>
      <text x='962' y='166' fontSize={reg.big} fontWeight='700' fill={CS_BLUE}>{pct(cs[3])}</text>
      <text x='962' y='252' fontSize='14' fontWeight='600' fill={SOFT}>{n} other majors</text>
      <text x='962' y='282' fontSize={reg.big} fontWeight='700' fill={SOFT}>{pct(field[3])}</text>
      <text x='236' y={y(cs[0]) - 8} fontSize='13' fontWeight='600' fill={CS_BLUE}>{pct(cs[0])}</text>
      <text x='236' y={y(field[0]) + 22} fontSize='13' fontWeight='600' fill={SOFT}>{pct(field[0])}</text>
      <text x='770' y={y(cs[2]) - 35} fontSize='13' fontWeight='700' fill={CS_BLUE}>+{pts(cs[3] - cs[0])} points</text>
      <text x='770' y={y(field[2]) + 28} fontSize='13' fontWeight='700' fill={SOFT}>+{pts(field[3] - field[0])} points</text>

      {['Q1 · poorest', 'Q2', 'Q3', 'Q4 · richest'].map((labelText, q) => (
        <g key={labelText} textAnchor='middle'>
          <text x={x(q)} y='484' fontSize='14' fontWeight='500' fill={INK}>{labelText}</text>
          <text x={x(q)} y='504' fontSize='12' fill={MUTED_TEXT}>${moneyFmt.format(medianIncome[q])} median</text>
        </g>
      ))}
      <text x='580' y='536' fontSize='15' fontWeight='500' fill={INK} textAnchor='middle'>District income quartile</text>
    </svg>
  )
}

// ───────── Figure 4 — the tether map: distance is wealth's twin ─────────

function useTetherLayout() {
  const { outline } = snapshot.fig2
  const { tethers, campuses } = snapshot.distance
  const pts = outline.map(([lon, lat]) => projectCA(lon, lat))
  const others = [...tethers, ...campuses].map((o) => projectCA(o.lon, o.lat))
  const xs = [...pts, ...others].map((p) => p.px)
  const ys = [...pts, ...others].map((p) => p.py)
  const x0 = Math.min(...xs); const x1 = Math.max(...xs)
  const y0 = Math.min(...ys); const y1 = Math.max(...ys)
  const W = 560; const H = 540
  const scale = Math.min(W / (x1 - x0), H / (y1 - y0))
  return {
    outlinePath: pts.map((p, i) => `${i ? 'L' : 'M'}${((p.px - x0) * scale).toFixed(1)},${((p.py - y0) * scale).toFixed(1)}`).join(' '),
    place: (o) => {
      const p = projectCA(o.lon, o.lat)
      return { cx: (p.px - x0) * scale, cy: (p.py - y0) * scale }
    },
  }
}

// Label offsets so the metro-cluster campuses don't overprint each other.
const CAMPUS_LABEL = {
  Berkeley: [10, -3, 'start'],
  Davis: [10, -6, 'start'],
  'Los Angeles': [-10, 0, 'end'],
  Irvine: [11, 13, 'start'],
  'San Diego': [10, 6, 'start'],
  'Santa Barbara': [-10, -7, 'end'],
  'Santa Cruz': [-10, 10, 'end'],
  Riverside: [11, -7, 'start'],
  Merced: [10, -6, 'start'],
}

function Fig4Tethers({ reg, mode }) {
  const { tethers, campuses, medianKmByQuartile } = snapshot.distance
  const { outlinePath, place } = useTetherLayout()
  const campusByName = new Map(campuses.map((c) => [c.name, c]))
  const maxKm = Math.max(...medianKmByQuartile)
  const barX = 806
  const barMax = 300
  const barY = (i) => 148 + i * 54
  const quartileLabel = ['Q1 · poorest', 'Q2', 'Q3', 'Q4 · richest']
  return (
    <svg {...svgProps(668, `Every district drawn with a straight line to its nearest UC campus. Median tether length falls from ${kmToMi(medianKmByQuartile[0])} miles in the poorest income quartile to ${kmToMi(medianKmByQuartile[3])} in the richest.`)}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>Every district, tethered to its nearest campus</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>Straight line from each district centroid to the nearest of the nine campuses, coloured by income quartile</text>

      <g transform='translate(48, 76)'>
        <path d={outlinePath} fill='#FBFCFA' stroke={MUTED_LINE} strokeWidth='1.1' strokeLinejoin='round' />
        {tethers.map((t) => {
          const from = place(t)
          const campus = campusByName.get(t.campus)
          const to = campus ? place(campus) : from
          const describe = `${t.district}: ${kmToMi(t.km)} miles to the ${t.campus} campus (${QUARTILE_NAME[t.quartile]} quartile)`
          return (
            <g key={t.district} role='img' aria-label={describe}>
              <title>{describe}</title>
              <line x1={from.cx} y1={from.cy} x2={to.cx} y2={to.cy}
                stroke={RAMP[t.quartile]} strokeWidth={mode === 'glance' ? 2 : 1.4} opacity='0.6' />
              <circle cx={from.cx} cy={from.cy} r={mode === 'glance' ? 5.4 : 4.4}
                fill={RAMP[t.quartile]} stroke='#FFFFFF' strokeWidth='1' />
            </g>
          )
        })}
        {campuses.map((c) => {
          const { cx, cy } = place(c)
          const [dx, dy, anchor] = CAMPUS_LABEL[c.name] || [10, 0, 'start']
          return (
            <g key={c.name}>
              <rect x={cx - 5} y={cy - 5} width='10' height='10' fill={INK} stroke='#FFFFFF' strokeWidth='1.4'
                transform={`rotate(45 ${cx} ${cy})`}>
                <title>{`UC ${c.name} campus`}</title>
              </rect>
              <text x={cx + dx} y={cy + dy + 4} fontSize='11.5' fontWeight='600' fill={INK} textAnchor={anchor}>{c.name}</text>
            </g>
          )
        })}
      </g>

      <text x='700' y='118' fontSize='15' fontWeight='500' fill={INK}>Median tether, by income quartile</text>
      {medianKmByQuartile.map((km, i) => (
        <g key={quartileLabel[i]} role='img'
          aria-label={`${quartileLabel[i]} quartile: median ${kmToMi(km)} miles to the nearest campus`}>
          <title>{`${quartileLabel[i]}: median ${kmToMi(km)} miles to the nearest campus`}</title>
          <text x='792' y={barY(i) + 5} fontSize={reg.tick} fontWeight='500' fill={INK} textAnchor='end'>{quartileLabel[i]}</text>
          <rect x={barX} y={barY(i) - 14} width={(km / maxKm) * barMax} height='28' rx='3' fill={RAMP[i]} />
          <text x={barX + (km / maxKm) * barMax + 10} y={barY(i) + 5} fontSize={reg.tick} fontWeight='600' fill={SOFT}>{kmToMi(km)} mi</text>
        </g>
      ))}

      <text x='700' y='412' fontSize='42' fontWeight='700' fill={INK}>{tetherRatio}×</text>
      <text x='700' y='438' fontSize={reg.note} fill={SOFT}>as far from the nearest campus —</text>
      <text x='700' y='456' fontSize={reg.note} fill={SOFT}>the poorest quartile against the richest</text>

      <g>
        <rect x='700' y='492' width='10' height='10' fill={INK} transform='rotate(45 705 497)' />
        <text x='716' y='501' fontSize='12.5' fill={INK}>UC campus</text>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <rect x={810 + i * 48} y='492' width='14' height='14' rx='2' fill={RAMP[i]} />
            <text x={830 + i * 48} y='503' fontSize='12.5' fill={SOFT}>Q{i + 1}</text>
          </g>
        ))}
      </g>

      {mode === 'detailed' && (
        <text x='700' y='548' fontSize='12' fill={MUTED_TEXT}>
          Straight-line centroid distance — a coarse but even-handed ruler.
        </text>
      )}
      <text x='700' y={mode === 'detailed' ? 572 : 548} fontSize='12' fill={MUTED_TEXT}>
        This entanglement is the objection. The next figure takes it apart.
      </text>
    </svg>
  )
}

// ───────── Figure 5 — the gate grid: each factor with the other held ─────────

function Fig5Gates({ reg, mode }) {
  const { cells, responses, medianKm } = snapshot.distance
  const colL = [300, 690]
  const colW = 340
  const rowT = [132, 322]
  const rowH = 168
  const barMax = colW - 116
  const splitMi = kmToMi(medianKm)
  const poorN = cells.nearPoor.n + cells.farPoor.n
  const richN = cells.nearRich.n + cells.farRich.n
  const cell = (data, cx, cy, describe) => (
    <g role='img' aria-label={describe}>
      <title>{describe}</title>
      <rect x={cx} y={cy} width={colW} height={rowH} rx='8' fill='#FDFDFC' stroke={GRID_STRONG} />
      <text x={cx + colW - 14} y={cy + 24} fontSize='11.5' fill={MUTED_TEXT} textAnchor='end'>{data.n} districts</text>
      <text x={cx + 16} y={cy + 46} fontSize='12' fontWeight='600' fill={CS_BLUE}>Computer Science</text>
      <rect x={cx + 16} y={cy + 54} width={data.cs * barMax} height='24' rx='2' fill={CS_BLUE} />
      <text x={cx + 16 + data.cs * barMax + 10} y={cy + 71} fontSize={reg.panel} fontWeight='700' fill={CS_BLUE}>{pct(data.cs)}</text>
      <text x={cx + 16} y={cy + 104} fontSize='12' fontWeight='600' fill={SOFT}>Other majors</text>
      <rect x={cx + 16} y={cy + 112} width={data.field * barMax} height='18' rx='2' fill={FIELD} />
      <text x={cx + 16 + data.field * barMax + 10} y={cy + 126} fontSize={reg.tick} fontWeight='600' fill={SOFT}>{pct(data.field)}</text>
    </g>
  )
  const incomeMargin = (resp, top) => (
    <g>
      <text x='1064' y={top + 46} fontSize='10.5' fontWeight='700' fill={MUTED_TEXT} letterSpacing='0.08em'>INCOME ALONE</text>
      <text x='1064' y={top + 64} fontSize='11.5' fill={MUTED_TEXT}>poorer → richer half</text>
      <text x='1064' y={top + 92} fontSize='13.5' fontWeight='600' fill={CS_BLUE}>Computer Science +{pts(resp.cs)} pts</text>
      <text x='1064' y={top + 112} fontSize='12.5' fill={SOFT}>Other majors +{pts(resp.field)} pts</text>
    </g>
  )
  const proximityMargin = (resp, left) => (
    <g>
      <text x={left + 16} y='534' fontSize='10.5' fontWeight='700' fill={MUTED_TEXT} letterSpacing='0.08em'>DISTANCE ALONE</text>
      <text x={left + 16} y='552' fontSize='11.5' fill={MUTED_TEXT}>farther → nearer half</text>
      <text x={left + 16} y='578' fontSize='13.5' fontWeight='600' fill={CS_BLUE}>Computer Science +{pts(resp.cs)} pts</text>
      <text x={left + 16} y='598' fontSize='12.5' fill={SOFT}>Other majors +{pts(resp.field)} pts</text>
    </g>
  )
  return (
    <svg {...svgProps(660, `The districts split at the median distance to a campus and the median income. Income still raises Computer Science access with distance held fixed, distance still raises it with income held fixed, and both responses are a multiple of the field's.`)}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>Access with one gate held, the other varied</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>Share of program-district pairs with a complete path · districts split at the median tether ({splitMi} miles) and the median income</text>

      <text x={colL[0] + colW / 2} y='118' fontSize='13.5' fontWeight='600' fill={INK} textAnchor='middle'>Poorer half — {poorN} districts</text>
      <text x={colL[1] + colW / 2} y='118' fontSize='13.5' fontWeight='600' fill={INK} textAnchor='middle'>Richer half — {richN} districts</text>

      <text x='28' y={rowT[0] + 78} fontSize='12' fontWeight='700' fill={MUTED_TEXT} letterSpacing='0.08em'>NEARER HALF</text>
      <text x='28' y={rowT[0] + 98} fontSize='11.5' fill={MUTED_TEXT}>within {splitMi} miles of a campus</text>
      <text x='28' y={rowT[1] + 78} fontSize='12' fontWeight='700' fill={MUTED_TEXT} letterSpacing='0.08em'>FARTHER HALF</text>
      <text x='28' y={rowT[1] + 98} fontSize='11.5' fill={MUTED_TEXT}>beyond {splitMi} miles</text>

      {cell(cells.nearPoor, colL[0], rowT[0],
        `${cells.nearPoor.n} nearer, poorer districts: Computer Science access ${pct(cells.nearPoor.cs)}, other majors ${pct(cells.nearPoor.field)}`)}
      {cell(cells.nearRich, colL[1], rowT[0],
        `${cells.nearRich.n} nearer, richer districts: Computer Science access ${pct(cells.nearRich.cs)}, other majors ${pct(cells.nearRich.field)}`)}
      {cell(cells.farPoor, colL[0], rowT[1],
        `${cells.farPoor.n} farther, poorer districts: Computer Science access ${pct(cells.farPoor.cs)}, other majors ${pct(cells.farPoor.field)}`)}
      {cell(cells.farRich, colL[1], rowT[1],
        `${cells.farRich.n} farther, richer districts: Computer Science access ${pct(cells.farRich.cs)}, other majors ${pct(cells.farRich.field)}`)}

      {incomeMargin(responses.income.near, rowT[0])}
      {incomeMargin(responses.income.far, rowT[1])}
      {proximityMargin(responses.proximity.poor, colL[0])}
      {proximityMargin(responses.proximity.rich, colL[1])}

      {mode === 'glance'
        ? (
          <text x='28' y='642' fontSize={reg.note} fontWeight='600' fill={INK}>
            Both gates are real, and both swing hardest for Computer Science.
          </text>
        )
        : (
          <text x='28' y='642' fontSize='12.5' fill={MUTED_TEXT}>
            Neither gate explains the other. Cells are uneven — 11 to 25 districts — because the entanglement is real: that imbalance is the confound itself.
          </text>
        )}
    </svg>
  )
}

// ───────── the sequence ─────────

/** Figure-only gallery thumbnail: the evidence beat alone. */
export function PriceOfPlacePreview() {
  return <Fig3 reg={REGISTERS.detailed} />
}

const BEATS = {
  1: {
    role: 'The hook',
    standfirst: 'Share of a quartile’s districts with a complete path, poorest to richest — one row per program.',
  },
  2: {
    role: 'The headliner',
    standfirst: 'The districts, twice: coloured by the wealth of the place, then by how many of the nine programs it can reach. Same ramp, same places.',
  },
  3: {
    role: 'The evidence',
    standfirst: 'Four quartile means, nothing fitted — the subject against everything else the university teaches.',
  },
  4: {
    role: 'The objection',
    standfirst: 'Every district drawn with a line to its nearest campus, coloured by income — the entanglement of wealth and proximity, measured before a skeptic asks.',
  },
  5: {
    role: 'The verdict',
    standfirst: `The ${snapshot.counts.districts} districts split at the median tether and the median income — each gate read with the other held fixed.`,
  },
}

const REGISTER_OPTIONS = [
  { value: 'detailed', label: 'Detailed' },
  { value: 'glance', label: 'At a glance' },
]

export default function PriceOfPlace() {
  const [mode, setMode] = useState('detailed')
  const reg = REGISTERS[mode]
  const { counts } = snapshot
  return (
    <Stack gap='section'>
      <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
        <div className='flex flex-col'>
          <span className='field-label'>Register</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {REGISTER_OPTIONS.map((item) => (
              <button key={item.value} type='button' onClick={() => setMode(item.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  mode === item.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className='ml-auto text-caption max-w-[560px]' style={{ color: MUTED_TEXT }}>
          Committed snapshot of the full {counts.agreements.toLocaleString()}-agreement corpus.
          Definitions and scope at the foot of the sequence.
        </p>
      </div>
      <div data-export-root className='flex flex-col gap-7'>
        <Beat no='1' title='Nine programs, three fates' mode={mode} {...BEATS[1]}>
          <Fig1 reg={reg} />
        </Beat>
        <Beat no='2' title='Two maps, nearly the same map' mode={mode} {...BEATS[2]}>
          <Fig2 reg={reg} mode={mode} />
        </Beat>
        <Beat no='3' title='Same start, triple the response' mode={mode} {...BEATS[3]}>
          <Fig3 reg={reg} />
        </Beat>
        <Beat no='4' title='Distance is wealth’s twin' mode={mode} {...BEATS[4]}>
          <Fig4Tethers reg={reg} mode={mode} />
        </Beat>
        <Beat no='5' title='Two gates, tested separately' mode={mode} {...BEATS[5]}>
          <Fig5Gates reg={reg} mode={mode} />
        </Beat>

        {/* Plain-language author's log: every angle checked, tried, or still
            open — so the reasoning trail survives outside chat history. */}
        <div className='rounded-[10px] border px-5 py-4 flex flex-col gap-2' data-export-exclude
          style={{ borderColor: GRID, background: 'rgba(25,48,24,0.03)' }}>
          <span className='text-[11px] tracking-[0.09em] uppercase font-[600]' style={{ color: MUTED_TEXT }}>
            Working notes — the angles we checked
          </span>
          <p className='m-0 text-[13px] leading-relaxed' style={{ color: SOFT }}>
            Is Computer Science just a bigger major? No — it asks for about 11 required courses and
            the typical major asks for 8, so its size is ordinary. Do rich districts win only because
            they contain more colleges? No — scoring every college on its own, the rich-poor gap
            barely changes. Is the real story distance to a campus rather than money? Partly — poor
            districts really are about three times farther from the nearest campus, but money still
            matters between districts at similar distances, and distance still matters between
            districts with similar money. Both matter, and both matter far more for Computer Science
            than for other majors. Things we tried and set aside: counting every missing course (most
            missing courses have substitutes and block nobody — only the binding ones matter),
            measuring transferable units (too noisy to show anything), fitted trend lines (they
            mislead at the edges, so we show quartile means only), and building a comparison group of
            same-size majors (unneeded once size was ruled out). Earlier figure drafts also catalogued
            the specific blocking courses (Computer Science’s blockers are ordinary teachable courses;
            the field’s biggest blockers are courses no community college offers) — that analysis is
            kept in the data file. Not yet checked: weighting districts by how many students actually
            live there, whether a missing course is missing because nobody teaches it or because
            nobody wrote the articulation, and earlier years of the agreement database.
          </p>
        </div>
      </div>
    </Stack>
  )
}
