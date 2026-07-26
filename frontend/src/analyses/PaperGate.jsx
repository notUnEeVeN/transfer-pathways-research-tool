import React, { useState } from 'react'
import { Stack } from '../components/ui'
import repairs from '../../../analysis/data/course_repairs.v1.json'
import placeSnapshot from './priceOfPlaceSnapshot.json'

/**
 * "The Paper Gate" — four moments answering the question the income-and-distance collection
 * leaves open: why Computer Science, and what would fix it.
 *
 *   1 · Every course in the system — the arch: every receiving course by
 *       articulation level and income swing, flat at the edges by arithmetic,
 *       alive in the contested middle where the CS courses crowd and float
 *       above the rest; the like-for-like lanes beneath close the reading.
 *   2 · The staircase, taken apart — the income gradient lives in the
 *       Computer Science layer; the generic layer is a flat ceiling, with
 *       the sibling collection's staircase ghosted (compared, never summed).
 *   3 · The ledger of unwritten agreements — the wall as named documents,
 *       both counts on one scale, the stack classified by evidence.
 *   4 · Sign the papers — write only the evidence-backed agreements and
 *       re-measure (point-and-band, conservative bound first).
 *
 * Every value comes from analysis/data/course_repairs.v1.json, computed by
 * server/scripts/simulateCourseRepairs.js, on two requirement bases: the
 * hand-verified eligibility floor (default) and the full stated preparation.
 * Everything measures formal opportunity — whether a complete transfer path
 * formally exists — never student behaviour or admission odds.
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
const NAVY = '#1E3A5F'
const NAVY_SOFT = '#6E93BF'
const PALE = '#A9C3DE'
const BREADTH_FILL = '#C6CEC5'
const HOLLOW_FILL = '#FBFCFA'
const FONT = "'Hanken Grotesk Variable', 'Hanken Grotesk', ui-sans-serif, system-ui, sans-serif"

const REG = { tick: 15, row: 19, note: 15, big: 52, mid: 22, dotR: 9 }

const pctFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const pct = (v) => `${pctFmt.format(v * 100)}%`
const pts = (v) => Math.round(v * 100)
const svgProps = (height, label) => ({
  viewBox: `0 0 1240 ${height}`,
  role: 'img',
  'aria-label': label,
  className: 'block h-auto w-full',
  'data-export-width': 1240,
  style: { fontFamily: FONT, fontVariantNumeric: 'tabular-nums' },
})

function headlinesFor(data, basis) {
  const ing = data.ingredients
  const csSwing = pts(ing.gradient.cs[3] - ing.gradient.cs[0])
  const genSwing = pts(ing.gradient.generic[3] - ing.gradient.generic[0])
  const aShare = Math.round((data.fates.counts.A / data.fates.instances) * 100)
  const archS = repairs.arch.summary
  return {
    1: `Against every course in the system: Computer Science courses are ${(archS.csContestedShare / archS.otherContestedShare).toFixed(1)}× as likely to be contested — and twice as income-graded even among contested courses.`,
    2: `The generic layer is flat. The income gradient lives in the Computer Science courses — ${csSwing} points from poorest to richest, against ${genSwing} for everything else.`,
    3: (() => {
      const top = data.repairs.types.filter((t) => t.completeCells > 0)[0]
      return `Approve every ${top.name.toLowerCase()} course statewide and ${top.completeCells} transfer pathways open — and ${Math.round((data.fates.counts.A / data.fates.instances) * 100)} percent of all the missing entries are already accepted at another campus.`
    })(),
    4: basis === 'minimums'
      ? 'Sign only the pre-approved agreements — teach nothing new anywhere — and the richest-poorest gap shrinks by more than half.'
      : 'Sign only the pre-approved agreements — teach nothing new anywhere — and the poorest quartile reaches the line where today’s richest stands.',
    5: (() => {
      const low = data.repairs.scenarios.lowestBar
      const lowClose = Math.round(((data.baseline.gapQ4Q1 - low.gapQ4Q1) / data.baseline.gapQ4Q1) * 100)
      const consClose = Math.round(((data.baseline.gapQ4Q1 - data.repairs.conservativeRepairedMap.gapQ4Q1) / data.baseline.gapQ4Q1) * 100)
      return `${low.courses} introductory courses — material every college can host — close ${lowClose} percent of the wealth gap on their own. The full pre-approved stack closes at least ${consClose} percent.`
    })(),
  }
}

function Beat({ no, role, title, headlines, children }) {
  return (
    <section aria-label={title}
      className='bg-white rounded-[14px] border flex flex-col gap-5'
      style={{ borderColor: 'rgba(25,48,24,0.11)', padding: '30px 34px 28px' }}>
      <div className='flex flex-col gap-2 max-w-[80ch]'>
        <span className='text-[11.5px] tracking-[0.11em] uppercase font-[700]' style={{ color: CS_BLUE }}>
          {no} · {role}
        </span>
        <h3 className='m-0 text-[26px] leading-[1.14] tracking-[-0.018em] font-[600]' style={{ color: INK }}>{title}</h3>
        <p className='m-0 text-[18px] leading-snug font-[650]' style={{ color: INK }}>{headlines[no]}</p>
      </div>
      <div className='rounded-[10px] border bg-white' style={{ borderColor: GRID, padding: '18px 14px 10px' }}>
        {children}
      </div>
    </section>
  )
}

// ───────── Every course in the system — the arch, then the like-for-like ──
// Panel A: the full field — every receiving course by articulation level and
// income swing. The arch shape is the point: flat at both edges (courses
// articulated nowhere or everywhere cannot swing), alive only in the middle.
// Band meanings live in a strip UNDER the axis, never inside the plot.
// Panel B reinforces the reading: inside the contested band, like for like,
// the swings as two lanes with means marked. Basis-independent throughout.

function ArchScatter({ reg }) {
  const { courses, summary } = repairs.arch
  const csRows = courses.filter((r) => r.cs)
  const field = courses.filter((r) => !r.cs)
  const contested = (r) => r.level >= 0.1 && r.level < 0.9
  const x = (v) => 200 + v * 940
  const y = (v) => 440 - ((v + 0.15) / 0.9) * 344
  const steepest = [...csRows].sort((a, b) => b.swing - a.swing)[0]
  const ratio = (summary.csContestedShare / summary.otherContestedShare).toFixed(1)
  const bandY = 470
  const bDivider = 556
  const laneTop = 606
  const lanes = [
    { label: 'Computer Science', rows: csRows.filter(contested), cy: laneTop + 58, mean: summary.csContestedSwing, color: CS_BLUE },
    { label: 'Every other course', rows: field.filter(contested), cy: laneTop + 172, mean: summary.otherContestedSwing, color: FIELD },
  ]
  const sx = (v) => 340 + ((v + 0.1) / 0.8) * 800
  const jitter = (i) => (((i * 2654435761) % 83) / 83 - 0.5) * 54
  const footY = laneTop + 262
  return (
    <svg {...svgProps(footY + 66, `Panel A: all ${courses.length.toLocaleString()} receiving courses by articulation level and income swing — flat at both edges where no swing is possible, alive in the contested middle, where the Computer Science courses crowd and float above the rest. Panel B: inside the contested band, Computer Science courses swing +${Math.round(summary.csContestedSwing * 100)} points on average against +${Math.round(summary.otherContestedSwing * 100)} for everything else.`)}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>A · Every course the campuses ask for</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>One dot per receiving course, all majors · across: share of colleges articulating it · up: poorest-to-richest swing</text>

      {[0, 0.2, 0.4, 0.6].map((v) => (
        <g key={v}>
          <line x1='200' y1={y(v)} x2='1140' y2={y(v)} stroke={v === 0 ? AXIS : GRID} strokeWidth='1' />
          <text x='184' y={y(v) + 4} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{v === 0 ? '0' : `+${Math.round(v * 100)}`}</text>
        </g>
      ))}
      {[0.25, 0.5, 0.75].map((v) => (
        <line key={v} x1={x(v)} y1={y(0.72)} x2={x(v)} y2={y(-0.15)} stroke={GRID} strokeWidth='1' />
      ))}

      <rect x={x(0)} y={y(0.72)} width={x(0.1) - x(0)} height={y(-0.15) - y(0.72)} fill='rgba(25,48,24,0.04)' />
      <rect x={x(0.9)} y={y(0.72)} width={x(1) - x(0.9)} height={y(-0.15) - y(0.72)} fill='rgba(25,48,24,0.04)' />

      {field.map((r, i) => (
        <circle key={`f${i}`} cx={x(r.level)} cy={y(r.swing)} r='2.6' fill={FIELD} fillOpacity='0.28'>
          <title>{`${r.title}: articulated at ${pct(r.level)} of colleges · ${Math.round(r.swing * 100)}-point income swing`}</title>
        </circle>
      ))}
      {csRows.map((r, i) => (
        <circle key={`c${i}`} cx={x(r.level)} cy={y(r.swing)} r={6}
          fill={CS_BLUE} fillOpacity='0.9' stroke='#FFFFFF' strokeWidth='1'>
          <title>{`${r.title}: articulated at ${pct(r.level)} of colleges · ${Math.round(r.swing * 100)}-point income swing`}</title>
        </circle>
      ))}
      {steepest && (
        <text x={x(steepest.level) + (steepest.level > 0.55 ? -12 : 12)} y={y(steepest.swing) - 10}
          fontSize='11.5' fontWeight='600' fill={CS_BLUE}
          textAnchor={steepest.level > 0.55 ? 'end' : 'start'}>
          {steepest.title.slice(0, 40)} · +{Math.round(steepest.swing * 100)}
        </text>
      )}

      {/* Band meanings, under the axis — never inside the plot. */}
      <g>
        {[[0, 0.1, 'almost nowhere', 'flat by arithmetic'],
          [0.1, 0.9, 'the contested middle', 'income can decide'],
          [0.9, 1, 'solved', 'flat']].map(([a, b, l1, l2]) => (
            <g key={l1}>
              <line x1={x(a) + 3} y1={bandY} x2={x(b) - 3} y2={bandY} stroke={MUTED_LINE} strokeWidth='1.4' />
              <line x1={x(a) + 3} y1={bandY - 5} x2={x(a) + 3} y2={bandY + 5} stroke={MUTED_LINE} strokeWidth='1.4' />
              <line x1={x(b) - 3} y1={bandY - 5} x2={x(b) - 3} y2={bandY + 5} stroke={MUTED_LINE} strokeWidth='1.4' />
              <text x={(x(a) + x(b)) / 2} y={bandY + 22} fontSize='12' fontWeight={l1 === 'the contested middle' ? 700 : 500}
                fill={l1 === 'the contested middle' ? INK : MUTED_TEXT} textAnchor='middle'>{l1}</text>
              <text x={(x(a) + x(b)) / 2} y={bandY + 38} fontSize='11' fill={MUTED_TEXT} textAnchor='middle'>{l2}</text>
            </g>
          ))}
      </g>
      <text x='670' y={bandY + 62} fontSize='13.5' fontWeight='500' fill={INK} textAnchor='middle'>Share of colleges articulating the course</text>

      <line x1='28' y1={bDivider} x2='1212' y2={bDivider} stroke='rgba(25,48,24,0.09)' strokeWidth='1' />
      <text x='28' y={bDivider + 28} fontSize='16' fontWeight='500' fill={INK}>B · Inside the contested band, like for like</text>
      <text x='28' y={bDivider + 50} fontSize={reg.tick} fill={MUTED_TEXT}>The same contested courses from the middle of panel A, one dot each, with the mean swing marked per lane</text>

      {[0, 0.2, 0.4, 0.6].map((v) => (
        <g key={v}>
          <line x1={sx(v)} y1={laneTop + 22} x2={sx(v)} y2={laneTop + 210} stroke={v === 0 ? AXIS : GRID} strokeWidth='1' />
          <text x={sx(v)} y={laneTop + 228} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='middle'>{v === 0 ? '0' : `+${Math.round(v * 100)}`}</text>
        </g>
      ))}
      <text x='740' y={laneTop + 250} fontSize='13.5' fontWeight='500' fill={INK} textAnchor='middle'>Income swing, points</text>

      {lanes.map((lane) => (
        <g key={lane.label}>
          <text x='324' y={lane.cy + 4} fontSize={reg.row} fontWeight='600'
            fill={lane.color === CS_BLUE ? CS_BLUE : SOFT} textAnchor='end'>{lane.label}</text>
          <text x='324' y={lane.cy + 22} fontSize='12' fill={MUTED_TEXT} textAnchor='end'>{lane.rows.length} contested courses</text>
          {lane.rows.map((r, i) => (
            <circle key={`${lane.label}|${i}`} cx={sx(r.swing)} cy={lane.cy + jitter(i)}
              r={lane.color === CS_BLUE ? 6 : 2.8}
              fill={lane.color} fillOpacity={lane.color === CS_BLUE ? 0.9 : 0.3}
              stroke={lane.color === CS_BLUE ? '#FFFFFF' : 'none'} strokeWidth='1'>
              <title>{`${r.title}: articulated at ${pct(r.level)} of colleges · ${Math.round(r.swing * 100)}-point swing`}</title>
            </circle>
          ))}
          <line x1={sx(lane.mean)} y1={lane.cy - 36} x2={sx(lane.mean)} y2={lane.cy + 36} stroke={INK} strokeWidth='2.6' />
          <text x={sx(lane.mean)} y={lane.cy - 44} fontSize={reg.tick} fontWeight='700' fill={INK} textAnchor='middle'>mean +{Math.round(lane.mean * 100)}</text>
        </g>
      ))}

      <text x='28' y={footY + 22} fontSize={reg.note} fontWeight='600' fill={INK}>
        Computer Science courses crowd the contested middle ({ratio}× everything else) — and float above it: +{Math.round(summary.csContestedSwing * 100)} against +{Math.round(summary.otherContestedSwing * 100)}, like for like.
      </text>
      <text x='28' y={footY + 46} fontSize={reg.note} fill={MUTED_TEXT}>
        Courses at the edges cannot swing — that is arithmetic, not a finding — which is why panel B makes the comparison only inside the band.
      </text>
    </svg>
  )
}

// ───────── Moment 2 — the staircase, taken apart ─────────
// The generic layer is a ceiling band pinned near 100%; the CS layer is the
// only climbing line; the sibling collection's access staircase is ghosted
// behind them. Shapes are compared, never summed — access is a conjunction.

function M2Staircase({ reg, data, basis }) {
  const ing = data.ingredients
  const stair = basis === 'minimums' ? placeSnapshot.minimums.fig3cs : placeSnapshot.fig3.cs
  const x = (q) => 240 + q * 230
  const y = (v) => 470 - v * 380
  const line = (arr) => arr.map((v, q) => `${x(q)},${y(v)}`).join(' ')
  const csSwing = pts(ing.gradient.cs[3] - ing.gradient.cs[0])
  const genSwing = pts(ing.gradient.generic[3] - ing.gradient.generic[0])
  const genMin = Math.min(...ing.gradient.generic)
  return (
    <svg {...svgProps(586, `The generic requirement layer runs ${pct(ing.gradient.generic[0])} to ${pct(ing.gradient.generic[3])} across income quartiles — a flat ceiling. The Computer Science layer climbs from ${pct(ing.gradient.cs[0])} to ${pct(ing.gradient.cs[3])}. Behind them, the district access staircase from the previous collection climbs only where the Computer Science line climbs.`)}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>Share of requirement-college cells articulated, by district income quartile</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>Quartile means, nothing fitted · the pale dashed steps are the previous collection’s access staircase, for recognition</text>

      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
        <g key={v}>
          <line x1='240' y1={y(v)} x2='930' y2={y(v)} stroke={i === 0 ? AXIS : GRID} strokeWidth='1' />
          <text x='224' y={y(v) + 5} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(v)}</text>
        </g>
      ))}

      {/* The ceiling: generic availability lives inside this thin band. */}
      <rect x='240' y={y(1)} width='690' height={Math.max(4, y(genMin) - y(1))} fill='rgba(111,123,110,0.12)' />
      <text x='930' y={y(1) - 8} fontSize='12' fill={SOFT} textAnchor='end'>the generic ceiling — solved infrastructure</text>

      <polyline points={line(stair)} fill='none' stroke={PALE} strokeWidth='3.4' strokeDasharray='8 6' strokeLinecap='round' />
      {stair.map((v, q) => (
        <circle key={q} cx={x(q)} cy={y(v)} r='5.5' fill={PALE}>
          <title>{`District access staircase, Q${q + 1}: ${pct(v)} — the previous collection, as published`}</title>
        </circle>
      ))}

      <polyline points={line(ing.gradient.generic)} fill='none' stroke={FIELD} strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' />
      {ing.gradient.generic.map((v, q) => (
        <circle key={q} cx={x(q)} cy={y(v)} r='6' fill={FIELD}>
          <title>{`Generic requirements, Q${q + 1}: ${pct(v)} of requirement-college cells articulated`}</title>
        </circle>
      ))}
      <polyline points={line(ing.gradient.cs)} fill='none' stroke={CS_BLUE} strokeWidth='3.6' strokeLinecap='round' strokeLinejoin='round' />
      {ing.gradient.cs.map((v, q) => (
        <circle key={q} cx={x(q)} cy={y(v)} r='7' fill={CS_BLUE} stroke='#FFFFFF' strokeWidth='1.5'>
          <title>{`Computer Science requirements, Q${q + 1}: ${pct(v)} of requirement-college cells articulated`}</title>
        </circle>
      ))}

      <g>
        <text x='952' y={y(ing.gradient.generic[3]) + 4} fontSize={reg.row} fontWeight='600' fill={SOFT}>generic</text>
        <text x='952' y={y(ing.gradient.generic[3]) + 24} fontSize={reg.tick} fill={SOFT}>+{genSwing} pts — flat</text>
        <text x='952' y={y(ing.gradient.cs[3]) + 4} fontSize={reg.row} fontWeight='700' fill={CS_BLUE}>Computer Science</text>
        <text x='952' y={y(ing.gradient.cs[3]) + 26} fontSize={reg.mid} fontWeight='700' fill={CS_BLUE}>+{csSwing} pts</text>
        <text x='952' y={y(stair[3]) + 22} fontSize='12' fill={MUTED_TEXT}>the access staircase</text>
      </g>

      {['Q1 · poorest', 'Q2', 'Q3', 'Q4 · richest'].map((labelText, q) => (
        <text key={labelText} x={x(q)} y='502' fontSize='14' fontWeight='500' fill={INK} textAnchor='middle'>{labelText}</text>
      ))}

      <text x='28' y='540' fontSize={reg.note} fontWeight='600' fill={INK}>
        The staircase climbs only where the blue line climbs. The generic ingredients never could have produced it.
      </text>
    </svg>
  )
}

// ───────── Moment 3 — the unwritten agreements, by course type ─────────
// Panel A: approve every course of a TYPE statewide (data structures split
// from introductory programming and so on — recognisable kinds, not merged
// families) and count the transfer pathways that open. Airy rows, one claim
// each. Panel B: the beat's centerpiece — every missing entry in the state
// as one square, coloured by its evidence; the green field IS the argument
// that most of this is already accepted at another campus.

function M3Ledger({ reg, data }) {
  const { counts, instances } = data.fates
  const types = data.repairs.types.filter((t) => t.completeCells > 0).slice(0, 6)
  const maxCells = Math.max(...types.map((t) => t.completeCells))
  const rowPitch = 84
  const rowY = (i) => 116 + i * rowPitch
  const barX = 420; const barMax = 540
  const bTop = rowY(types.length - 1) + rowPitch + 40
  const aShare = Math.round((counts.A / instances) * 100)
  // Waffle: one square per missing instance, evidence-ordered.
  const cols = instances > 1000 ? 62 : 48
  const pitch = Math.floor(872 / cols)
  const sq = pitch - 3
  const waffleRows = Math.ceil(instances / cols)
  const waffleH = waffleRows * pitch
  const cellFate = (i) => (i < counts.A ? 'A' : i < counts.A + counts.B ? 'B' : i < counts.A + counts.B + counts.C ? 'C' : 'U')
  const FATE_STYLE = {
    A: { fill: GAINED, stroke: 'none', label: 'already accepted for the same subject at another campus' },
    B: { fill: BREADTH_FILL, stroke: 'none', label: 'taught, never accepted' },
    C: { fill: '#FFFFFF', stroke: MUTED_LINE, label: 'not taught — no signature fixes these' },
    U: { fill: 'url(#pgWaffleHatch)', stroke: BREADTH_FILL, label: 'resists classification' },
  }
  const legendY = bTop + 96 + waffleH + 34
  const footY = legendY + 44
  return (
    <svg {...svgProps(footY + 76, `Panel A: approving whole course types statewide — every ${types[0].name.toLowerCase()} course approved would open ${types[0].completeCells} transfer pathways. Panel B: all ${instances.toLocaleString()} missing entries drawn one square each; ${aShare} percent are already accepted for the same subject at another campus.`)}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>A · Approve a whole type of course, statewide</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>
        Transfer pathways that open if every course of the type were articulated statewide · pathways need whole sequences, so single courses open little alone
      </text>

      {types.map((t, i) => {
        const y = rowY(i)
        const w = Math.max(6, (t.completeCells / maxCells) * barMax)
        const inBar = w >= 190
        const describe = `${t.name}: approving all ${t.courses} receiving courses statewide opens ${t.completeCells} pathways; ${Math.round(t.preApprovedShare * 100)} percent of its missing entries are already accepted elsewhere`
        return (
          <g key={t.type} role='img' aria-label={describe}>
            <title>{describe}</title>
            <text x='404' y={y + 2} fontSize={reg.row} fontWeight='600' fill={INK} textAnchor='end'>{t.name}</text>
            <text x='404' y={y + 21} fontSize='12' fill={MUTED_TEXT} textAnchor='end'>{t.courses} receiving courses · <tspan fill={GAINED} fontWeight='600'>{Math.round(t.preApprovedShare * 100)}% pre-approved</tspan></text>
            <rect x={barX} y={y - 12} width={w} height='28' rx='3' fill={CS_BLUE} />
            {inBar ? (
              <text x={barX + w - 12} y={y + 8} fontSize={reg.mid} fontWeight='700' fill='#FFFFFF' textAnchor='end'>+{t.completeCells} pathways</text>
            ) : (
              <text x={barX + w + 12} y={y + 8} fontSize={reg.mid} fontWeight='700' fill={CS_BLUE}>+{t.completeCells} pathways</text>
            )}

          </g>
        )
      })}

      <line x1='28' y1={bTop} x2='1212' y2={bTop} stroke='rgba(25,48,24,0.09)' strokeWidth='1' />
      <text x='28' y={bTop + 32} fontSize='16' fontWeight='500' fill={INK}>B · Every missing entry in the state, one square each</text>
      <text x='28' y={bTop + 54} fontSize={reg.tick} fill={MUTED_TEXT}>One square = one required course missing from one college’s path · coloured by the evidence behind it, strongest first</text>

      <g>
        <text x='28' y={bTop + 148} fontSize={72} fontWeight='700' fill={GAINED}>{aShare}%</text>
        <text x='28' y={bTop + 180} fontSize={reg.row} fontWeight='600' fill={INK}>of the {instances.toLocaleString()} missing entries</text>
        <text x='28' y={bTop + 202} fontSize={reg.row} fontWeight='600' fill={INK}>are already accepted for the</text>
        <text x='28' y={bTop + 224} fontSize={reg.row} fontWeight='600' fill={INK}>same subject at another campus.</text>
        <text x='28' y={bTop + 254} fontSize='12' fill={MUTED_TEXT}>{counts.A1.toLocaleString()} accepted by the demanding campus itself,</text>
        <text x='28' y={bTop + 271} fontSize='12' fill={MUTED_TEXT}>{counts.A2} by a stricter one, {counts.A3} by laxer campuses only.</text>
      </g>

      <g>
        {Array.from({ length: instances }, (_, i) => {
          const fate = cellFate(i)
          const st = FATE_STYLE[fate]
          const col = i % cols
          const row = Math.floor(i / cols)
          return (
            <rect key={i} x={340 + col * pitch} y={bTop + 76 + row * pitch} width={sq} height={sq} rx='1.5'
              fill={st.fill} stroke={st.stroke} strokeWidth={st.stroke === 'none' ? 0 : 1} />
          )
        })}
        <title>{`${instances.toLocaleString()} missing entries: ${counts.A.toLocaleString()} accepted elsewhere · ${counts.B} taught but never accepted · ${counts.C} not taught · ${counts.unclassified} unclassified`}</title>
      </g>

      <g fontSize='12.5'>
        {Object.entries(FATE_STYLE).map(([fate, st], i) => {
          const n = { A: counts.A, B: counts.B, C: counts.C, U: counts.unclassified }[fate]
          const lx = [340, 340, 745, 745][i]
          const ly = legendY + (i % 2) * 22 - 22
          return (
            <g key={fate}>
              <rect x={lx} y={ly - 11} width='13' height='13' rx='1.5' fill={st.fill} stroke={st.stroke} strokeWidth={st.stroke === 'none' ? 0 : 1} />
              <text x={lx + 21} y={ly} fill={INK}>{n.toLocaleString()} · {st.label}</text>
            </g>
          )
        })}
      </g>

      <text x='28' y={footY} fontSize={reg.note} fontWeight='600' fill={INK}>
        The colleges teach these subjects, and other campuses already accept their courses — what is missing is the entry in this campus’s table.
      </text>
      <text x='28' y={footY + 24} fontSize={reg.note} fill={SOFT}>
        The stake in people: colleges behind the wall produce {placeSnapshot.participation.narrow.perK} Computer Science completers per 1,000 students against {placeSnapshot.participation.open.perK} where paths are open — matching that rate would mean roughly {placeSnapshot.participation.extraPerYear} more a year, an observational bound.
      </text>
      <text x='28' y={footY + 48} fontSize={reg.note} fill={MUTED_TEXT}>
        Accepted-elsewhere is subject-level evidence, not course-level proof — the next figure therefore keeps a small range across two evidence checks.
      </text>
      <defs>
        <pattern id='pgWaffleHatch' width='7' height='7' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>
          <rect width='7' height='7' fill='#FFFFFF' />
          <line x1='0' y1='0' x2='0' y2='7' stroke='rgba(25,48,24,0.1)' strokeWidth='3' />
        </pattern>
      </defs>
    </svg>
  )
}

// ───────── Moment 4 — sign the papers ─────────
// Two distinct visual grammars on one shared scale. Access is movement: today
// is a compact labelled tick, and an open-chevron rail advances to the
// evidence-backed range. The rich-poor gap is a relationship: quiet spans
// keep the same labelled quartile endpoints in view, while dashed mappings
// and a softly highlighted middle make the contraction traceable.

function M4Signing({ reg, data, basis }) {
  const base = data.baseline
  const cons = data.repairs.conservativeRepairedMap
  const full = data.repairs.tierARepairedMap
  const accessRows = [
    {
      label: 'Poorest-quartile access', sub: 'share of the poorest districts’ paths open',
      unit: '%', today: base.access[0], lo: cons.access[0], hi: full.access[0],
      note: basis === 'minimums'
        ? 'from two-in-five to three-in-four'
        : 'lands exactly on today’s richest quartile',
      residual: true, primary: true, y: 180,
    },
  ]
  const scaleMin = 0.3
  const plotX = 340
  const plotW = 820
  const x = (v) => plotX + ((v - scaleMin) / (1 - scaleMin)) * plotW
  const gapTop = 268
  const gapBottom = 682
  const chartBottom = gapBottom
  const legendY = chartBottom + 46
  const height = legendY + 34
  const gapTodayY = gapTop + 116
  const gapAfterY = gapTop + 286
  const todayPoorX = x(base.access[0])
  const todayRichX = x(base.access[3])
  const consPoorX = x(cons.access[0])
  const fullPoorX = x(full.access[0])
  const consRichX = x(cons.access[3])
  const fullRichX = x(full.access[3])
  const closedConservative = pts(base.gapQ4Q1) - pts(cons.gapQ4Q1)
  const closedFull = pts(base.gapQ4Q1) - pts(full.gapQ4Q1)
  const afterPoorLabelX = (consPoorX + fullPoorX) / 2
  const afterRichLabelX = (consRichX + fullRichX) / 2
  return (
    <svg {...svgProps(height, `Write only the evidence-backed agreements and re-measure on one shared scale. Poorest-quartile access moves from ${pct(base.access[0])} to between ${pct(cons.access[0])} and ${pct(full.access[0])}; the richest-poorest gap contracts from ${pts(base.gapQ4Q1)} points to between ${pts(full.gapQ4Q1)} and ${pts(cons.gapQ4Q1)}. The not-taught remainder stays visibly unfixed.`)}
      data-testid='paper-gate-signing'>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>Write only the evidence-backed agreements — teach nothing new — and re-measure</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>Access moves along the blue arrows; the gap below tracks the same poorest and richest quartiles before and after signing</text>

      <g transform='translate(28 78)'>
        <line x1='0' y1='0' x2='56' y2='0' stroke={CS_BLUE} strokeOpacity='0.62' strokeWidth='7' strokeLinecap='round' />
        <path d='M 47 -8 L 57 0 L 47 8' fill='none' stroke={CS_BLUE} strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' />
        <text x='72' y='5' fontSize='12.5' fontWeight='600' fill={INK}>movement after signing</text>
        <rect x='286' y='-10' width='44' height='20' rx='6' fill='rgba(0,114,178,0.15)' />
        <line x1='286' y1='-10' x2='286' y2='10' stroke={CS_BLUE} strokeWidth='3' />
        <text x='344' y='5' fontSize='12.5' fontWeight='600' fill={INK}>small range across two evidence checks</text>
        <rect x='612' y='-6' width='40' height='12' rx='3' fill='url(#pgTailHatch)' stroke={BREADTH_FILL} strokeWidth='1' />
        <text x='666' y='5' fontSize='12.5' fontWeight='600' fill={INK}>still closed after every supported agreement</text>
      </g>

      {[0.3, 0.5, 0.7, 0.9, 1].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1='116' x2={x(v)} y2={chartBottom} stroke={v === scaleMin || v === 1 ? GRID_STRONG : GRID} strokeWidth='1' strokeDasharray={v === scaleMin || v === 1 ? undefined : '2 7'} />
          <text x={x(v)} y='108' fontSize='12' fill={MUTED_TEXT} textAnchor='middle'>{Math.round(v * 100)}%</text>
        </g>
      ))}

      {accessRows.map((row) => {
        const yy = row.y
        const lo = Math.min(row.lo, row.hi); const hi = Math.max(row.lo, row.hi)
        const conservative = lo
        const fullEvidence = hi
        const bandX = x(lo); const bandW = Math.max(20, x(hi) - x(lo))
        const todayX = x(row.today)
        const conservativeX = x(conservative)
        const fullX = x(fullEvidence)
        const arrowStart = todayX + 8
        const arrowLineEnd = conservativeX - 10
        const rangeMid = bandX + bandW / 2
        const residualPoints = Math.round((1 - hi) * 100)
        const describe = `${row.label}: today ${pct(row.today)}; signed, between ${pct(conservative)} and ${pct(fullEvidence)}`
        return (
          <g key={row.label} role='img' aria-label={describe}>
            <title>{describe}</title>
            {row.primary && (
              <rect x='14' y={yy - 62} width='1198' height='122' rx='12' fill='rgba(0,114,178,0.028)' />
            )}
            <text x='300' y={yy - 2} fontSize={reg.row} fontWeight='600' fill={INK} textAnchor='end'>{row.label}</text>
            <text x='300' y={yy + 16} fontSize='12' fill={MUTED_TEXT} textAnchor='end'>{row.sub}</text>
            <line x1={x(scaleMin)} y1={yy} x2={x(1)} y2={yy} stroke='#EDF1EA' strokeWidth='12' strokeLinecap='round' />
            {row.residual && (
              <g>
                <rect x={x(hi)} y={yy - 6} width={x(1) - x(hi)} height='12' rx='3' fill='url(#pgTailHatch)' stroke={BREADTH_FILL} strokeWidth='1' />
                <text x={x(hi) + (x(1) - x(hi)) / 2} y={yy + 28} fontSize='11.5' fontWeight='500' fill={MUTED_TEXT} textAnchor='middle'>{residualPoints}% still closed</text>
              </g>
            )}
            <line x1={arrowStart} y1={yy} x2={arrowLineEnd} y2={yy}
              stroke={CS_BLUE} strokeOpacity={row.primary ? 0.72 : 0.58} strokeWidth={row.primary ? 9 : 7} strokeLinecap='round' />
            <path data-movement-arrow='right'
              d={`M ${conservativeX - 11} ${yy - 9} L ${conservativeX} ${yy} L ${conservativeX - 11} ${yy + 9}`}
              fill='none' stroke={CS_BLUE} strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round' />
            <rect x={bandX} y={yy - 13} width={bandW} height='26' rx='7' fill='rgba(0,114,178,0.16)' />
            <line x1={conservativeX} y1={yy - 15} x2={conservativeX} y2={yy + 15} stroke={CS_BLUE} strokeWidth='3.5' strokeLinecap='round' />
            <line x1={fullX} y1={yy - 11} x2={fullX} y2={yy + 11} stroke={NAVY_SOFT} strokeWidth='2' strokeLinecap='round' />

            <line x1={todayX} y1={yy - 13} x2={todayX} y2={yy + 13} stroke={INK} strokeWidth='3' strokeLinecap='round' />
            <rect x={todayX - 46} y={yy + 22} width='92' height='28' rx='14' fill='#FFFFFF' stroke='rgba(25,48,24,0.20)' strokeWidth='1' />
            <text x={todayX} y={yy + 41} fontSize='12.5' fontWeight='650' fill={INK} textAnchor='middle'>TODAY · {pct(row.today)}</text>

            <text x={rangeMid} y={yy - 43} fontSize='10.5' fontWeight='700' letterSpacing='0.08em' fill={MUTED_TEXT} textAnchor='middle'>AFTER SIGNATURES</text>
            <text x={rangeMid} y={yy - 19} fontSize={29} fontWeight='700' fill={CS_BLUE} textAnchor='middle'>
              {pct(conservative).replace('%', '')} – {pct(fullEvidence)}
            </text>
            <text x='300' y={yy + 39} fontSize='11.5' fontWeight='600' fill={GAINED} textAnchor='end'>{row.note}</text>
          </g>
        )
      })}

      <g data-testid='paper-gate-gap-closing' role='img'
        aria-label={`The richest-poorest access gap contracts from ${pts(base.gapQ4Q1)} points today to a range from ${pts(full.gapQ4Q1)} to ${pts(cons.gapQ4Q1)} points after signing, across two evidence checks.`}>
        <rect x='14' y={gapTop} width='1198' height={gapBottom - gapTop} rx='12' fill='rgba(25,48,24,0.026)' stroke={GRID} strokeWidth='1' />
        <text x='28' y={gapTop + 35} fontSize={18} fontWeight='700' fill={CS_BLUE}>
          {closedConservative}–{closedFull} points of the gap closed by signatures alone
        </text>
        <text x='28' y={gapTop + 57} fontSize='12' fill={MUTED_TEXT}>the distance between the same poorest and richest quartiles, before and after signing</text>

        <g>
          <text x='28' y={gapTodayY - 4} fontSize={reg.row} fontWeight='700' fill={INK}>TODAY</text>
          <text x='28' y={gapTodayY + 18} fontSize='12' fill={MUTED_TEXT}>as the tables stand</text>
        </g>
        <g>
          <text x='28' y={gapAfterY - 4} fontSize={reg.row} fontWeight='700' fill={INK}>AFTER SIGNING</text>
          <text x='28' y={gapAfterY + 18} fontSize='12' fill={MUTED_TEXT}>only evidence-backed agreements</text>
        </g>

        <polygon points={`${todayPoorX},${gapTodayY + 8} ${todayRichX},${gapTodayY + 8} ${fullRichX},${gapAfterY} ${consPoorX},${gapAfterY}`}
          fill='rgba(0,114,178,0.055)' />
        <line x1={todayPoorX} y1={gapTodayY + 8} x2={consPoorX} y2={gapAfterY}
          stroke={CS_BLUE} strokeOpacity='0.78' strokeWidth='1.8' strokeDasharray='7 6' markerEnd='url(#pgGapArrowBlue)' />
        <line x1={todayRichX} y1={gapTodayY + 8} x2={fullRichX} y2={gapAfterY}
          stroke={FIELD} strokeOpacity='0.48' strokeWidth='1.8' strokeDasharray='7 6' markerEnd='url(#pgGapArrowField)' />

        <g data-gap-span='today'>
          <line x1={todayPoorX} y1={gapTodayY} x2={todayRichX} y2={gapTodayY} stroke={FIELD} strokeWidth='4.5' strokeLinecap='round' />
          <line x1={todayPoorX} y1={gapTodayY - 10} x2={todayPoorX} y2={gapTodayY + 10} stroke={CS_BLUE} strokeWidth='3' strokeLinecap='round' />
          <line x1={todayRichX} y1={gapTodayY - 10} x2={todayRichX} y2={gapTodayY + 10} stroke={FIELD} strokeWidth='3' strokeLinecap='round' />
          <rect x={(todayPoorX + todayRichX) / 2 - 54} y={gapTodayY - 49} width='108' height='28' rx='14' fill='#FFFFFF' stroke={GRID_STRONG} strokeWidth='1' />
          <text x={(todayPoorX + todayRichX) / 2} y={gapTodayY - 30} fontSize='14' fontWeight='700' fill={INK} textAnchor='middle'>{pts(base.gapQ4Q1)}-POINT GAP</text>

          <text x={todayPoorX} y={gapTodayY - 29} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={CS_BLUE} textAnchor='middle'>POOREST QUARTILE</text>
          <text x={todayPoorX} y={gapTodayY - 13} fontSize='15' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>{pct(base.access[0])}</text>
          <text x={todayRichX} y={gapTodayY - 29} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={SOFT} textAnchor='middle'>RICHEST QUARTILE</text>
          <text x={todayRichX} y={gapTodayY - 13} fontSize='15' fontWeight='700' fill={SOFT} textAnchor='middle'>{pct(base.access[3])}</text>
        </g>

        <g data-gap-span='after'>
          <line x1={consPoorX} y1={gapAfterY} x2={consRichX} y2={gapAfterY} stroke='rgba(0,114,178,0.18)' strokeWidth='14' strokeLinecap='round' />
          <line x1={fullPoorX} y1={gapAfterY} x2={fullRichX} y2={gapAfterY} stroke={CS_BLUE} strokeWidth='4' strokeLinecap='round' />
          <rect x={Math.min(consPoorX, fullPoorX)} y={gapAfterY - 13} width={Math.max(8, Math.abs(fullPoorX - consPoorX))} height='26' rx='7' fill='rgba(0,114,178,0.15)' />
          <line x1={consPoorX} y1={gapAfterY - 12} x2={consPoorX} y2={gapAfterY + 12} stroke={CS_BLUE} strokeWidth='2.5' strokeLinecap='round' />
          <line x1={fullPoorX} y1={gapAfterY - 9} x2={fullPoorX} y2={gapAfterY + 9} stroke={CS_BLUE} strokeWidth='2' strokeLinecap='round' />
          <line x1={afterRichLabelX} y1={gapAfterY - 10} x2={afterRichLabelX} y2={gapAfterY + 10} stroke={FIELD} strokeWidth='3' strokeLinecap='round' />

          <rect x={(consPoorX + fullRichX) / 2 - 66} y={gapAfterY + 17} width='132' height='28' rx='14' fill='#FFFFFF' stroke='rgba(0,114,178,0.18)' strokeWidth='1' />
          <text x={(consPoorX + fullRichX) / 2} y={gapAfterY + 36} fontSize='14' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>{pts(full.gapQ4Q1)}–{pts(cons.gapQ4Q1)}-POINT GAP</text>

          <text x={afterPoorLabelX} y={gapAfterY - 43} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={CS_BLUE} textAnchor='middle'>POOREST QUARTILE</text>
          <text x={afterPoorLabelX} y={gapAfterY - 25} fontSize='15' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>{pct(cons.access[0]).replace('%', '')}–{pct(full.access[0])}</text>
          <text x={afterRichLabelX} y={gapAfterY - 43} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={SOFT} textAnchor='middle'>RICHEST QUARTILE</text>
          <text x={afterRichLabelX} y={gapAfterY - 25} fontSize='15' fontWeight='700' fill={SOFT} textAnchor='middle'>{pct(full.access[3])}</text>
          <text x={(consPoorX + fullRichX) / 2} y={gapAfterY + 64} fontSize='11' fontWeight='600' fill={MUTED_TEXT} textAnchor='middle'>range across two evidence checks</text>
        </g>

        <text x='28' y={gapBottom - 18} fontSize='11.5' fontWeight='600' fill={INK}>
          {basis === 'minimums' ? 'The gap shrinks by more than half.' : 'The gap narrows; it does not close.'}
        </text>
      </g>

      <g>
        <line x1='28' y1={legendY - 24} x2='1212' y2={legendY - 24} stroke={GRID} strokeWidth='1' />
        <text x='28' y={legendY} fontSize={reg.note} fontWeight='600' fill={INK}>
          The {data.fates.counts.C} not-taught gaps stay exactly where they are — the largest share of the inequality is administrative, not all of it.
        </text>
      </g>
      <defs>
        <marker id='pgGapArrowBlue' markerWidth='8' markerHeight='8' refX='7' refY='4' orient='auto' markerUnits='userSpaceOnUse'>
          <path d='M 0 0 L 7 4 L 0 8' fill='none' stroke={CS_BLUE} strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
        </marker>
        <marker id='pgGapArrowField' markerWidth='8' markerHeight='8' refX='7' refY='4' orient='auto' markerUnits='userSpaceOnUse'>
          <path d='M 0 0 L 7 4 L 0 8' fill='none' stroke={FIELD} strokeOpacity='0.58' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
        </marker>
        <pattern id='pgTailHatch' width='8' height='8' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>
          <line x1='0' y1='0' x2='0' y2='8' stroke='rgba(156,166,155,0.8)' strokeWidth='2' />
        </pattern>
      </defs>
    </svg>
  )
}

// ───────── Moment 5 — the closing jaws (staged payoff) ─────────
// A form neither collection uses elsewhere: two lines across three scenario
// stages — richest-quartile access along the top (nearly flat; they were
// always fine) and poorest-quartile access climbing from below — with the
// shaded wedge between them BEING the gap, printed at each stage. The final
// stage forks into thin conservative-to-full bands. Only the end quartiles
// are drawn; the interior is not claimed.

function JawsScenarios({ reg, data }) {
  const base = data.baseline
  const low = data.repairs.scenarios.lowestBar
  const cons = data.repairs.conservativeRepairedMap
  const full = data.repairs.tierARepairedMap
  const sx = [250, 655, 1040]
  const y = (v) => 486 - v * 380
  const q4 = [base.access[3], low.access[3], cons.access[3]]
  const q1 = [base.access[0], low.access[0], cons.access[0]]
  const gapAt = [base.gapQ4Q1, low.gapQ4Q1, null]
  const line = (vals) => vals.map((v, i) => `${sx[i]},${y(v)}`).join(' ')
  const wedge = `${q4.map((v, i) => `${sx[i]},${y(v)}`).join(' ')} ${[2, 1, 0].map((i) => `${sx[i]},${y(q1[i])}`).join(' ')}`
  const stageMeta = [
    { label: 'Today', effort: 'as the tables stand' },
    { label: 'Sign the introductory courses', effort: `${low.courses} courses’ worth of paperwork · ${Math.round(low.preApprovedShare * 100)}% already accepted elsewhere` },
    { label: 'Sign everything the evidence supports', effort: `${full.instancesPatched.toLocaleString()} pre-approved entries · conservative standard first` },
  ]
  return (
    <svg {...svgProps(636, `Two lines across three scenarios. Richest-quartile access runs ${pct(base.access[3])}, ${pct(low.access[3])}, then ${pct(cons.access[3])} to ${pct(full.access[3])} — nearly flat. Poorest-quartile access climbs from ${pct(base.access[0])} to ${pct(low.access[0])} after signing only the ${low.courses} introductory courses, then to between ${pct(cons.access[0])} and ${pct(full.access[0])}. The gap between the lines narrows from ${pts(base.gapQ4Q1)} points to ${pts(low.gapQ4Q1)}, then to between ${pts(cons.gapQ4Q1)} and ${pts(full.gapQ4Q1)}.`)}>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>The gap, watched closing — three scenarios, two quartiles</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>The shaded wedge is the rich-poor access gap itself · only the end quartiles are drawn — the interior is not claimed</text>

      {[0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1='170' y1={y(v)} x2='1120' y2={y(v)} stroke={GRID} strokeWidth='1' />
          <text x='154' y={y(v) + 4} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(v)}</text>
        </g>
      ))}

      <polygon points={wedge} fill='rgba(0,114,178,0.09)' />
      <polyline points={line(q4)} fill='none' stroke={FIELD} strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' />
      <polyline points={line(q1)} fill='none' stroke={CS_BLUE} strokeWidth='3.6' strokeLinecap='round' strokeLinejoin='round' />

      {q4.map((v, i) => (
        <circle key={`q4${i}`} cx={sx[i]} cy={y(v)} r='6' fill={FIELD} stroke='#FFFFFF' strokeWidth='1.5'>
          <title>{`Richest quartile, ${stageMeta[i].label.toLowerCase()}: ${pct(v)} of paths open`}</title>
        </circle>
      ))}
      {q1.map((v, i) => (
        <circle key={`q1${i}`} cx={sx[i]} cy={y(v)} r={8} fill={CS_BLUE} stroke='#FFFFFF' strokeWidth='1.5'>
          <title>{`Poorest quartile, ${stageMeta[i].label.toLowerCase()}: ${pct(v)} of paths open`}</title>
        </circle>
      ))}

      {/* Final stage forks: conservative-to-full bands on both lines. */}
      {[[cons.access[3], full.access[3], FIELD], [cons.access[0], full.access[0], CS_BLUE]].map(([lo, hi, color], i) => (
        <g key={`band${i}`}>
          <rect x={sx[2] - 7} y={y(Math.max(lo, hi))} width='14' height={Math.max(6, Math.abs(y(lo) - y(hi)))} rx='6'
            fill={color} opacity='0.85'>
            <title>{`Between ${pct(Math.min(lo, hi))} (conservative standard) and ${pct(Math.max(lo, hi))} (full standard)`}</title>
          </rect>
        </g>
      ))}

      {q4.map((v, i) => (
        <text key={`lq4${i}`} x={sx[i]} y={y(v) - 14} fontSize={reg.tick} fontWeight='600' fill={SOFT} textAnchor='middle'>
          {i === 2 ? `${pts(v)}–${pts(full.access[3])}%` : pct(v)}
        </text>
      ))}
      {q1.map((v, i) => (
        <text key={`lq1${i}`} x={sx[i]} y={y(v) + 30} fontSize={reg.row} fontWeight='700' fill={CS_BLUE} textAnchor='middle'>
          {i === 2 ? `${pts(v)}–${pts(full.access[0])}%` : pct(v)}
        </text>
      ))}

      {gapAt.map((g, i) => (
        <text key={`gap${i}`} x={sx[i] + (i === 0 ? 40 : 0)} y={(y(q4[i]) + y(q1[i])) / 2 + 6}
          fontSize={22} fontWeight='700' fill={INK} textAnchor='middle'>
          {g != null ? `${pts(g)} pts` : `${pts(cons.gapQ4Q1)}–${pts(full.gapQ4Q1)} pts`}
        </text>
      ))}
      <text x={sx[0] + 40} y={(y(q4[0]) + y(q1[0])) / 2 + 26} fontSize='11.5' fill={MUTED_TEXT} textAnchor='middle'>the gap</text>

      <text x='1132' y={y(q4[2]) + 4} fontSize='13' fontWeight='600' fill={SOFT}>richest quartile</text>
      <text x='1132' y={y(q1[2]) + 4} fontSize='13' fontWeight='700' fill={CS_BLUE}>poorest quartile</text>

      {stageMeta.map((st, i) => (
        <g key={st.label} textAnchor='middle'>
          <text x={sx[i]} y='530' fontSize={reg.row} fontWeight='600' fill={INK}>{st.label}</text>
          <text x={sx[i]} y='550' fontSize='12' fill={MUTED_TEXT}>{st.effort}</text>
        </g>
      ))}

      <text x='28' y='592' fontSize={reg.note} fontWeight='600' fill={INK}>
        The rich were always fine — the jaws close because the poorest districts climb. {low.courses} introductory courses do a third of the closing on their own.
      </text>
    </svg>
  )
}

// ───────── the sequence ─────────

export function PaperGatePreview() {
  return <ArchScatter reg={REG} />
}

const BEATS = {
  1: {
    role: 'The comparison',
  },
  2: {
    role: 'The mechanism',
  },
  3: {
    role: 'The evidence',
  },
  4: {
    role: 'The payoff',
  },
  5: {
    role: 'The staging',
  },
}


const BASIS_OPTIONS = [
  { value: 'minimums', label: 'Eligibility floor' },
  { value: 'strict', label: 'Stated preparation' },
]

export default function PaperGate() {
  const [basis, setBasis] = useState('minimums')
  const reg = REG
  const data = basis === 'minimums' ? repairs.minimums : repairs
  const headlines = headlinesFor(data, basis)
  return (
    <Stack gap='section'>
      <div className='surface-card p-4 flex flex-wrap items-end gap-3' data-export-exclude>
        <div className='flex flex-col'>
          <span className='field-label'>Requirements</span>
          <div className='inline-flex h-9 rounded-lg border border-border-strong bg-surface overflow-hidden'>
            {BASIS_OPTIONS.map((item) => (
              <button key={item.value} type='button' onClick={() => setBasis(item.value)}
                className={`px-3 text-button border-r border-border last:border-r-0 ${
                  basis === item.value ? 'bg-primary-soft text-primary' : 'text-ink-muted hover:bg-surface-hover'
                }`}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <p className='ml-auto text-caption max-w-[560px]' style={{ color: MUTED_TEXT }}>
          Why Computer Science, and what would fix it. Calculus works everywhere; data structures works
          where the money is — and most of the difference is unsigned paperwork.
        </p>
      </div>
      <div data-export-root className='flex flex-col gap-7'>
        <Beat no='1' title='Every course in the system' headlines={headlines} {...BEATS[1]}>
          <ArchScatter reg={reg} />
        </Beat>
        <Beat no='2' title='The staircase, taken apart' headlines={headlines} {...BEATS[2]}>
          <M2Staircase reg={reg} data={data} basis={basis} />
        </Beat>
        <Beat no='3' title='The unwritten agreements' headlines={headlines} {...BEATS[3]}>
          <M3Ledger reg={reg} data={data} />
        </Beat>
        <Beat no='4' title='Sign the papers' headlines={headlines} {...BEATS[4]}>
          <M4Signing reg={reg} data={data} basis={basis} />
        </Beat>
        <Beat no='5' title='How the gap closes' headlines={headlines} {...BEATS[5]}>
          <JawsScenarios reg={reg} data={data} />
        </Beat>
      </div>
    </Stack>
  )
}
