import React, { useState } from 'react'
import { Stack } from '../components/ui'
import repairs from '../../../analysis/data/course_repairs.v2.json'
import placeSnapshot from './priceOfPlaceSnapshot.json'

/**
 * "The Computing Bottleneck" — five beats answering the question The Income Gate collection
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
 *   4 · Simulated repairs — the route pair: full repair and candidate agreements,
 *       re-measure (point-and-band, conservative bound first).
 *
 * Every value comes from analysis/data/course_repairs.v2.json, computed by
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
    1: `Computer Science courses are ${(archS.csContestedShare / archS.otherContestedShare).toFixed(1)}× as likely as other required courses to be contested — articulated at some colleges and not others — and within the contested band their income swing averages +${Math.round(archS.csContestedSwing * 100)} points against +${Math.round(archS.otherContestedSwing * 100)}.`,
    2: 'Articulation of the generic requirements is nearly flat across district income; only the computing requirements climb with it. The district access staircase tracks the computing line, not the rest of the ask.',
    3: 'The bars count the college–program pathways that would open if every course of a type were articulated statewide — the six largest shown, each an independent scenario. An entry is evidence-backed when its college already teaches a same-type course accepted by at least one UC: an articulation that has passed UC review, though the missing entry itself has not been evaluated.',
    4: 'One course type repaired at a time, in the order that adds the most access — an order the articulations-only and full-repair greedy routes agree on for every step drawn. Each row shows two endpoints for the same set of course types: what the articulations reach, and what repairing every remaining entry in those types would reach.',
    5: (() => {
      const sig = cutRoute(data.repairs.scenarios.routeSignatures, ROUTE_ROWS.signatures)
      const total = cutRoute(data.repairs.scenarios.route, ROUTE_ROWS.total)
      const agreements = sig[sig.length - 1].evidence
      const repaired = total[total.length - 1]
      return 'Statewide repair of the computing courses disproportionately benefits the lowest-income districts.'
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
  const y = (v) => 384 - ((v + 0.15) / 0.9) * 344
  const steepest = [...csRows].sort((a, b) => b.swing - a.swing)[0]
  const ratio = (summary.csContestedShare / summary.otherContestedShare).toFixed(1)
  const bandY = 414
  const bDivider = 500
  const laneTop = 584
  const lanes = [
    { label: 'Computer Science', rows: csRows.filter(contested), cy: laneTop + 58, mean: summary.csContestedSwing, color: CS_BLUE },
    { label: 'Every other course', rows: field.filter(contested), cy: laneTop + 172, mean: summary.otherContestedSwing, color: FIELD },
  ]
  const sx = (v) => 340 + ((v + 0.1) / 0.8) * 800
  const jitter = (i) => (((i * 2654435761) % 83) / 83 - 0.5) * 54
  const footY = laneTop + 262
  return (
    <svg {...svgProps(footY + 10, `Panel A: all ${courses.length.toLocaleString()} receiving courses by articulation level and income swing — flat at both edges where no swing is possible, alive in the contested middle, where the Computer Science courses crowd and float above the rest. Panel B: inside the contested band, Computer Science courses swing +${Math.round(summary.csContestedSwing * 100)} points on average against +${Math.round(summary.otherContestedSwing * 100)} for everything else.`)}>

      {[0, 0.2, 0.4, 0.6].map((v) => (
        <g key={v}>
          <line x1='200' y1={y(v)} x2='1140' y2={y(v)} stroke={v === 0 ? AXIS : GRID} strokeWidth='1' />
          <text x='184' y={y(v) + 4} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{v === 0 ? '0' : `+${Math.round(v * 100)}`}</text>
        </g>
      ))}
      {[0.25, 0.5, 0.75].map((v) => (
        <line key={v} x1={x(v)} y1={y(0.72)} x2={x(v)} y2={y(-0.15)} stroke={GRID} strokeWidth='1' />
      ))}

      <text transform={`rotate(-90 148 ${y(0.28)})`} x='148' y={y(0.28)} fontSize='13.5' fontWeight='500' fill={INK} textAnchor='middle'>Income swing, points</text>
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
          [0.1, 0.9, 'the contested middle', 'variation is possible'],
          [0.9, 1, 'nearly universal', 'flat']].map(([a, b, l1, l2]) => (
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
      <text x='28' y={bDivider + 28} fontSize='16' fontWeight='500' fill={INK}>Inside the contested band</text>
      <text x='28' y={bDivider + 50} fontSize={reg.tick} fill={MUTED_TEXT}>The same contested courses from the scatter above, one dot each, with the mean swing marked per lane</text>

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
  // Right-margin label blocks, pushed apart when endpoints land too close
  // (the stated basis brings the CS line and the ghost staircase together).
  const labelYs = (() => {
    const anchors = [
      ['gen', 470 - ing.gradient.generic[3] * 380],
      ['cs', 470 - ing.gradient.cs[3] * 380],
      ['stair', 470 - stair[3] * 380],
    ].sort((a, b) => a[1] - b[1])
    for (let k = 1; k < anchors.length; k += 1) {
      if (anchors[k][1] - anchors[k - 1][1] < 54) anchors[k][1] = anchors[k - 1][1] + 54
    }
    return Object.fromEntries(anchors)
  })()
  return (
    <svg {...svgProps(586, `The generic requirement layer runs ${pct(ing.gradient.generic[0])} to ${pct(ing.gradient.generic[3])} across income quartiles — a flat ceiling. The Computer Science layer climbs from ${pct(ing.gradient.cs[0])} to ${pct(ing.gradient.cs[3])}. Behind them, the district access staircase from the previous collection climbs only where the Computer Science line climbs.`)}>

      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
        <g key={v}>
          <line x1='240' y1={y(v)} x2='930' y2={y(v)} stroke={i === 0 ? AXIS : GRID} strokeWidth='1' />
          <text x='224' y={y(v) + 5} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(v)}</text>
        </g>
      ))}

      {/* The ceiling: generic availability lives inside this thin band. */}
      <rect x='240' y={y(1)} width='690' height={Math.max(4, y(genMin) - y(1))} fill='rgba(111,123,110,0.12)' />
      <text x='930' y={y(1) - 8} fontSize='12' fill={SOFT} textAnchor='end'>generic requirements — articulated nearly everywhere</text>

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
        <text x='952' y={labelYs.gen + 4} fontSize={reg.row} fontWeight='600' fill={SOFT}>generic</text>
        <text x='952' y={labelYs.gen + 24} fontSize={reg.tick} fill={SOFT}>+{genSwing} pts — flat</text>
        <text x='952' y={labelYs.cs + 4} fontSize={reg.row} fontWeight='700' fill={CS_BLUE}>Computer Science</text>
        <text x='952' y={labelYs.cs + 26} fontSize={reg.mid} fontWeight='700' fill={CS_BLUE}>+{csSwing} pts</text>
        <text x='952' y={labelYs.stair + 20} fontSize='12' fontWeight='600' fill={MUTED_TEXT}>district access staircase</text>
        <text x='952' y={labelYs.stair + 36} fontSize='11' fill={MUTED_TEXT}>The Income Gate, for comparison</text>
      </g>

      {['Q1 · lowest income', 'Q2', 'Q3', 'Q4 · highest income'].map((labelText, q) => (
        <text key={labelText} x={x(q)} y='502' fontSize='14' fontWeight='500' fill={INK} textAnchor='middle'>{labelText}</text>
      ))}


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
  const rowY = (i) => 64 + i * rowPitch
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
    A: { fill: GAINED, stroke: 'none', label: 'taught, accepted by 1+ UC' },
    B: { fill: BREADTH_FILL, stroke: 'none', label: 'taught, never accepted' },
    C: { fill: '#FFFFFF', stroke: MUTED_LINE, label: 'not taught' },
    U: { fill: 'url(#pgWaffleHatch)', stroke: BREADTH_FILL, label: 'unclassified' },
  }
  const footY = bTop + 76 + waffleH
  return (
    <svg {...svgProps(footY + 30, `Panel A: approving whole course types statewide — every ${types[0].name.toLowerCase()} course approved would open ${types[0].completeCells} transfer pathways. Panel B: all ${instances.toLocaleString()} missing entries drawn one square each; ${aShare} percent have a same-type course accepted at another campus.`)}>

      {types.map((t, i) => {
        const y = rowY(i)
        const w = Math.max(6, (t.completeCells / maxCells) * barMax)
        const inBar = w >= 190
        const describe = `${t.name}: approving all ${t.courses} receiving courses statewide opens ${t.completeCells} pathways; ${Math.round(t.preApprovedShare * 100)} percent of its missing entries have same-type evidence elsewhere`
        return (
          <g key={t.type} role='img' aria-label={describe}>
            <title>{describe}</title>
            <text x='404' y={y + 2} fontSize={reg.row} fontWeight='600' fill={INK} textAnchor='end'>{t.name}</text>
            <text x='404' y={y + 21} fontSize='12' fill={MUTED_TEXT} textAnchor='end'>{t.courses} receiving courses · <tspan fill={GAINED} fontWeight='600'>{Math.round(t.preApprovedShare * 100)}% with evidence</tspan></text>
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
      <text x='28' y={bTop + 30} fontSize={reg.tick} fill={MUTED_TEXT}>One square = one required course missing from one college’s path · coloured by the evidence behind it, strongest first</text>

      <g>
        <text x='28' y={bTop + 148} fontSize={72} fontWeight='700' fill={GAINED}>{aShare}%</text>
        <text x='28' y={bTop + 180} fontSize={reg.row} fontWeight='600' fill={INK}>of the {instances.toLocaleString()} missing entries</text>
        <text x='28' y={bTop + 202} fontSize={reg.row} fontWeight='600' fill={INK}>sit at colleges whose same-type</text>
        <text x='28' y={bTop + 224} fontSize={reg.row} fontWeight='600' fill={INK}>course a UC already accepts.</text>
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
        <title>{`${instances.toLocaleString()} missing entries: ${counts.A.toLocaleString()} with same-type evidence · ${counts.B} taught but never accepted · ${counts.C} not taught · ${counts.unclassified} unclassified`}</title>
      </g>

      <g fontSize='15'>
        {Object.entries(FATE_STYLE)
          .map(([fate, st]) => [st, { A: counts.A, B: counts.B, C: counts.C, U: counts.unclassified }[fate], fate])
          .filter(([, n]) => n > 0)
          .map(([st, n, fate], i) => {
            const ly = bTop + 268 + i * 32
            return (
              <g key={fate}>
                <rect x='28' y={ly - 13} width='17' height='17' rx='2' fill={st.fill} stroke={st.stroke} strokeWidth={st.stroke === 'none' ? 0 : 1} />
                <text x='54' y={ly} fontWeight='600' fill={INK}>{n.toLocaleString()} · {st.label}</text>
              </g>
            )
          })}
      </g>

      <defs>
        <pattern id='pgWaffleHatch' width='7' height='7' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>
          <rect width='7' height='7' fill='#FFFFFF' />
          <line x1='0' y1='0' x2='0' y2='7' stroke='rgba(25,48,24,0.1)' strokeWidth='3' />
        </pattern>
      </defs>
    </svg>
  )
}

// ───────── Moment 4 — the signing figure (stowed) ─────────
// Two distinct visual grammars on one shared scale. Access is movement: today
// is a compact labelled tick, and an open-chevron rail advances to the
// evidence-backed range. The gap between the income quartiles is a relationship: quiet spans
// keep the same labelled quartile endpoints in view, while dashed mappings
// and a softly highlighted middle make the contraction traceable.

function M4Signing({ reg, data, basis }) {
  const base = data.baseline
  const cons = data.repairs.conservativeRepairedMap
  const full = data.repairs.tierARepairedMap
  const accessRows = [
    {
      label: 'Lowest-income-quartile access', sub: 'share of the lowest-income districts’ paths open',
      unit: '%', today: base.access[0], lo: cons.access[0], hi: full.access[0],
      note: `still ${pts(base.access[3] - full.access[0])} pts below today’s highest-income quartile`,
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
  const closedLo = pts(base.gapQ4Q1) - Math.max(pts(cons.gapQ4Q1), pts(full.gapQ4Q1))
  const closedHi = pts(base.gapQ4Q1) - Math.min(pts(cons.gapQ4Q1), pts(full.gapQ4Q1))
  const afterPoorLabelX = (consPoorX + fullPoorX) / 2
  const afterRichLabelX = (consRichX + fullRichX) / 2
  return (
    <svg {...svgProps(height, `Write only the evidence-backed agreements and re-measure on one shared scale. Lowest-income-quartile access moves from ${pct(base.access[0])} to between ${pct(cons.access[0])} and ${pct(full.access[0])}; the gap between the highest- and lowest-income quartiles contracts from ${pts(base.gapQ4Q1)} points to between ${pts(full.gapQ4Q1)} and ${pts(cons.gapQ4Q1)}. The not-taught remainder stays visibly unfixed.`)}
      data-testid='paper-gate-signing'>
      <text x='28' y='24' fontSize='16' fontWeight='500' fill={INK}>Write only the evidence-backed agreements — teach nothing new — and re-measure</text>
      <text x='28' y='46' fontSize={reg.tick} fill={MUTED_TEXT}>Access moves along the blue arrows; the gap below tracks the same lowest- and highest-income quartiles before and after signing</text>

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

      {[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
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
            <text x='300' y={yy + 41} fontSize='11.5' fontWeight='600' fill={GAINED} textAnchor='end'>{row.note}</text>
          </g>
        )
      })}

      <g data-testid='paper-gate-gap-closing' role='img'
        aria-label={`The access gap between the highest- and lowest-income quartiles contracts from ${pts(base.gapQ4Q1)} points today to a range from ${pts(full.gapQ4Q1)} to ${pts(cons.gapQ4Q1)} points after signing, across two evidence checks.`}>
        <rect x='14' y={gapTop} width='1198' height={gapBottom - gapTop} rx='12' fill='rgba(25,48,24,0.026)' stroke={GRID} strokeWidth='1' />
        <text x='28' y={gapTop + 35} fontSize={18} fontWeight='700' fill={CS_BLUE}>
          {closedLo}–{closedHi} points of the gap closed by signatures alone
        </text>
        <text x='28' y={gapTop + 57} fontSize='12' fill={MUTED_TEXT}>the distance between the same lowest- and highest-income quartiles, before and after signing</text>

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

          <text x={todayPoorX} y={gapTodayY - 29} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={CS_BLUE} textAnchor='middle'>LOWEST-INCOME QUARTILE</text>
          <text x={todayPoorX} y={gapTodayY - 13} fontSize='15' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>{pct(base.access[0])}</text>
          <text x={todayRichX} y={gapTodayY - 29} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={SOFT} textAnchor='middle'>HIGHEST-INCOME QUARTILE</text>
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
          <text x={(consPoorX + fullRichX) / 2} y={gapAfterY + 36} fontSize='14' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>{Math.min(pts(full.gapQ4Q1), pts(cons.gapQ4Q1))}–{Math.max(pts(full.gapQ4Q1), pts(cons.gapQ4Q1))}-POINT GAP</text>

          <text x={afterPoorLabelX} y={gapAfterY - 43} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={CS_BLUE} textAnchor='middle'>LOWEST-INCOME QUARTILE</text>
          <text x={afterPoorLabelX} y={gapAfterY - 25} fontSize='15' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>{pct(cons.access[0]).replace('%', '')}–{pct(full.access[0])}</text>
          <text x={afterRichLabelX} y={gapAfterY - 43} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={SOFT} textAnchor='middle'>HIGHEST-INCOME QUARTILE</text>
          <text x={afterRichLabelX} y={gapAfterY - 25} fontSize='15' fontWeight='700' fill={SOFT} textAnchor='middle'>{pct(full.access[3])}</text>
          <text x={(consPoorX + fullRichX) / 2} y={gapAfterY + 64} fontSize='11' fontWeight='600' fill={MUTED_TEXT} textAnchor='middle'>range across two evidence checks</text>
        </g>

        <text x='28' y={gapBottom - 18} fontSize='11.5' fontWeight='600' fill={INK}>
          The gap narrows by {closedLo} to {closedHi} points; it does not close.
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
// stages — highest-income-quartile access along the top (nearly flat; they were
// always fine) and lowest-income-quartile access climbing from below — with the
// shaded wedge between them BEING the gap, printed at each stage. The final
// stage forks into thin conservative-to-full bands. Only the end quartiles
// are drawn; the interior is not claimed.

// ───────── moment 4b — the gap, dismantled class by class ─────────
// Cumulative statewide repairs one course type at a time, ordered by
// measured evidence share (stated on the figure), ending at the everything
// ceiling. One bar per rung: the gap between the income quartiles that remains. The final rung
// is provision, not signatures, and is drawn in its own color.

// Compact names for the fold line under each milestone row — the smaller
// classes a milestone absorbs must be visible, not tooltip-only.
const FOLD_SHORT = {
  Calculus: 'calculus',
  'Further programming courses': 'further programming',
  'Software construction and engineering': 'software engineering',
  'Data structures': 'data structures',
  'Discrete mathematics': 'discrete math',
  'Computer organization': 'comp org',
  'Assembly and systems programming': 'assembly/systems',
  'Linear algebra': 'linear algebra',
  'Statistics and probability': 'statistics',
  'Introductory programming II': 'intro programming II',
  'Introductory programming': 'intro programming',
  Algorithms: 'algorithms',
  'Calculus-based physics': 'physics',
  'Differential equations': 'differential equations',
}
const foldName = (name) => FOLD_SHORT[name] ?? name.toLowerCase()

// The routes stop where the computing curriculum does: milestones led by a
// non-computing class (calculus, physics, ...) fall past the cut. Folded
// non-computing riders inside a computing milestone stay, disclosed on the
// row. Greedy ordering can move or fold any class, so the cut keys on the
// class family, never on a specific class's position.
const ROUTE_COMPUTING_IDS = new Set(['intro_programming', 'intro_programming_2', 'data_structures', 'algorithms', 'software_eng', 'computer_org', 'assembly_systems', 'programming_other', 'discrete'])
// The figures draw only the first few greedy steps — the biggest
// improvements, enough to carry the story — not the full walk. Per-figure
// counts; the artifact keeps every step.
const ROUTE_ROWS = { total: 99, signatures: 99 }
const cutRoute = (routeArr, rows) => {
  const idx = routeArr.findIndex((m) => !ROUTE_COMPUTING_IDS.has(m.id))
  return (idx >= 0 ? routeArr.slice(0, idx) : routeArr).slice(0, rows)
}
// The ladder draws only the SHARED-OPTIMAL prefix: the opening steps on
// which the articulations-first and full-repair greedy orders agree. Inside
// that prefix every drawn value sits on both optimal paths at once; the
// remaining course types continue in a note (nothing is lost, and no drawn
// number is off either optimum).
const sharedOptimal = (scenarios) => {
  const tot = cutRoute(scenarios.route, 99)
  const sig = cutRoute(scenarios.routeSignatures, 99)
  let n = 0
  while (n < tot.length && n < sig.length && tot[n].id === sig[n].id) n += 1
  return { drawn: sig.slice(0, Math.max(1, n)), fullSig: sig }
}

const LADDER_SHORT = {
  intro_programming: 'Intro programming',
  intro_programming_2: 'Intro programming II',
  data_structures: 'Data structures',
  algorithms: 'Algorithms',
  software_eng: 'Software engineering',
  computer_org: 'Computer organization',
  assembly_systems: 'Assembly & systems',
  discrete: 'Discrete math',
  statistics: 'Statistics',
  calculus: 'Calculus',
  physics: 'Physics',
  linear_algebra: 'Linear algebra',
  differential: 'Differential equations',
  remaining_classified: 'Remaining classes',
  everything: 'Everything, incl. untaught',
}

// Two complementary route figures share one anatomy. 'total' — the whole
// route: each row FULLY repairs one more class everywhere (agreements
// written, unmatched courses taught); the inner tick marks how far its
// signatures alone would reach. 'signatures' — the easy wins: the arrow
// chain accumulates only signable entries, and each band shows what teaching
// that milestone's unmatched courses would add. Total is the ceiling,
// signatures the little-to-no-effort floor; together they bracket the route.
const LADDER_VARIANTS = {
  total: {
    routeKey: 'route',
    title: 'The optimal route — each course type fully articulated, agreements and teaching alike',
    legendArrow: 'full repair, this milestone',
    legendBand: 'the part that needs teaching, not signatures',
    insetRange: 'every class on the route signed and taught',
  },
  signatures: {
    routeKey: 'routeSignatures',
    title: 'The greedy repair ladder — each step adds the course type with the largest immediate gain',
    subtitle: 'Beyond these steps the two greedy routes diverge — the remaining course types rank differently depending on whether courses can be taught, or only articulated',
    legendArrow: 'evidence-backed articulations, accumulated',
    legendBand: 'all remaining entries in these course types repaired',
    insetRange: 'range: signatures alone · to teaching the last milestone’s remainder',
  },
}

function M4Ladder({ reg, data, variant = 'signatures' }) {
  const V = LADDER_VARIANTS[variant]
  const base = data.baseline
  const shared = sharedOptimal(data.repairs.scenarios)
  const route = variant === 'total' ? cutRoute(data.repairs.scenarios.route, ROUTE_ROWS.total) : shared.drawn
  const last = route[route.length - 1]

  const isTotal = variant === 'total'

  const scaleMin = 0.3
  const plotX = 340
  const plotW = 820
  const x = (v) => plotX + ((Math.max(v, scaleMin) - scaleMin) / (1 - scaleMin)) * plotW
  const rowY = (i) => 180 + i * 136
  const rowsBottom = rowY(route.length - 1) + 60
  const gapTop = rowsBottom + 34
  const gapTodayY = gapTop + 116
  const gapAfterY = gapTop + 286
  const height = gapAfterY + 96
  const todayPoorX = x(base.access[0])
  const todayRichX = x(base.access[3])
  const evidPoorX = x(last.evidence.access[0])
  const uniPoorX = x(last.access[0])
  const evidRichX = x(last.evidence.access[3])
  const uniRichX = x(last.access[3])
  const sigGap = pts(last.evidence.gapQ4Q1)
  const allGap = pts(last.gapQ4Q1)
  return (
    <svg {...svgProps(height, `${V.title}. The lowest-income quartile's access moves from ${pct(base.access[0])} today${route.map((m) => `, then ${m.name} to ${isTotal ? pct(m.access[0]) : `${pct(m.evidence.access[0])} with signatures alone`}`).join('')}. The gap between the highest- and lowest-income quartiles contracts from ${pts(base.gapQ4Q1)} points to ${isTotal ? pts(last.gapQ4Q1) : `${sigGap} with the evidence-backed articulations, ${allGap} with the route fully repaired`}.`)}
      data-testid={`paper-gate-ladder-${variant}`}>
      <text x='28' y='26' fontSize='18' fontWeight='600' fill={INK}>{V.title}</text>
      {V.subtitle && (
        <text x='28' y='48' fontSize={reg.tick} fill={MUTED_TEXT}>{V.subtitle}</text>
      )}

      <g transform='translate(28 78)'>
        <line x1='0' y1='0' x2='56' y2='0' stroke={CS_BLUE} strokeOpacity='0.62' strokeWidth='7' strokeLinecap='round' />
        <path d='M 47 -8 L 57 0 L 47 8' fill='none' stroke={CS_BLUE} strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' />
        <text x='72' y='5' fontSize='12.5' fontWeight='600' fill={INK}>{V.legendArrow}</text>
        {!isTotal && (
          <g>
            <rect x='400' y='-10' width='44' height='20' rx='6' fill='rgba(0,114,178,0.15)' />
            <line x1='400' y1='-10' x2='400' y2='10' stroke={CS_BLUE} strokeWidth='3' />
            <text x='458' y='5' fontSize='12.5' fontWeight='600' fill={INK}>{V.legendBand}</text>
          </g>
        )}
        <rect x={isTotal ? 400 : 880} y='-6' width='40' height='12' rx='3' fill='url(#ladderTailHatch)' stroke={BREADTH_FILL} strokeWidth='1' />
        <text x={isTotal ? 454 : 934} y='5' fontSize='12.5' fontWeight='600' fill={INK}>still closed at this point</text>
      </g>

      {[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
        <g key={v}>
          <line x1={x(v)} y1='116' x2={x(v)} y2={rowsBottom} stroke={v === scaleMin || v === 1 ? GRID_STRONG : GRID} strokeWidth='1' strokeDasharray={v === scaleMin || v === 1 ? undefined : '2 7'} />
          <text x={x(v)} y='108' fontSize='12' fill={MUTED_TEXT} textAnchor='middle'>{Math.round(v * 100)}%</text>
        </g>
      ))}

      {route.map((m, i) => {
        const yy = rowY(i)
        const shortName = LADDER_SHORT[m.id] ?? m.name
        const fromX = x(m.from[0])
        const evidX = x(m.evidence.access[0])
        const uniX = x(m.access[0])
        const tipX = isTotal ? uniX : evidX
        const bandMid = (evidX + uniX) / 2
        const labelMid = isTotal ? uniX : bandMid
        const labelAnchor = labelMid > 1070 ? 'end' : 'middle'
        const labelX = labelAnchor === 'end' ? 1216 : Math.max(plotX + 70, labelMid)
        const residualPoints = Math.round((1 - (isTotal ? m.access[0] : m.access[0])) * 100)
        const gainLo = pts(m.evidence.access[0]) - pts(m.from[0])
        const gainHi = pts(m.access[0]) - pts(m.from[0])
        const describe = isTotal
          ? `${m.name}: from ${pct(m.from[0])}, full repair reaches ${pct(m.access[0])}; its signatures alone would reach ${pct(m.evidence.access[0])}${m.included.length > 1 ? ` (with ${m.included.slice(0, -1).join(', ')})` : ''} · ${Math.round(m.evidenceShare * 100)} percent of its missing entries have same-type evidence elsewhere`
          : `${m.name}: from ${pct(m.from[0])}, the articulations reach ${pct(m.evidence.access[0])}; repairing every remaining entry in these types reaches ${pct(m.access[0])}${m.included.length > 1 ? ` (with ${m.included.slice(0, -1).join(', ')})` : ''} · ${Math.round(m.evidenceShare * 100)} percent of its missing entries have same-type evidence elsewhere`
        return (
          <g key={m.id} role='img' aria-label={describe}>
            <title>{describe}</title>
            <rect x='14' y={yy - 62} width='1198' height='122' rx='12' fill='rgba(0,114,178,0.028)' />
            <text x='300' y={yy - 8} fontSize={reg.row} fontWeight='600' fill={INK} textAnchor='end'>{i === 0 ? shortName : `+ ${shortName}`}</text>
            {m.included.length > 1 && (
              <text x='300' y={yy + 8} fontSize='11' fill={MUTED_TEXT} textAnchor='end'>with {m.included.slice(0, -1).map(foldName).join(', ')}</text>
            )}
            <text x='300' y={yy + (m.included.length > 1 ? 24 : 16)} fontSize='12' fill={MUTED_TEXT} textAnchor='end'>{Math.round(m.evidenceShare * 100)}% with same-type evidence</text>
            <line x1={x(scaleMin)} y1={yy} x2={x(1)} y2={yy} stroke='#EDF1EA' strokeWidth='12' strokeLinecap='round' />
            {x(1) - uniX > 2 && (
              <g>
                <rect x={uniX} y={yy - 6} width={x(1) - uniX} height='12' rx='3' fill='url(#ladderTailHatch)' stroke={BREADTH_FILL} strokeWidth='1' />
                {x(1) - uniX > 56 && (
                  <text x={uniX + (x(1) - uniX) / 2} y={yy + 28} fontSize='11.5' fontWeight='500' fill={MUTED_TEXT} textAnchor='middle'>{residualPoints}% still closed</text>
                )}
              </g>
            )}
            {i > 0 && (
              <rect x={x(base.access[0])} y={yy - 6} width={fromX - x(base.access[0])} height='12' rx='3' fill='rgba(0,114,178,0.10)' />
            )}
            {!isTotal && uniX - evidX > 2 && (
              <rect x={evidX} y={yy - 13} width={uniX - evidX} height='26' rx='7' fill='rgba(0,114,178,0.16)' />
            )}
            {(isTotal ? uniX : evidX) - 10 - (fromX + 8) > 4 && (
              <line x1={fromX + 8} y1={yy} x2={(isTotal ? uniX : evidX) - 10} y2={yy}
                stroke={CS_BLUE} strokeOpacity='0.72' strokeWidth='9' strokeLinecap='round' />
            )}
            {!isTotal && (
              <line x1={evidX} y1={yy - 15} x2={evidX} y2={yy + 15} stroke={CS_BLUE} strokeWidth='3.5' strokeLinecap='round' />
            )}
            <line x1={uniX} y1={yy - (isTotal ? 15 : 11)} x2={uniX} y2={yy + (isTotal ? 15 : 11)} stroke={isTotal ? CS_BLUE : NAVY_SOFT} strokeWidth={isTotal ? 3.5 : 2} strokeLinecap='round' />
            <path data-movement-arrow='right'
              d={`M ${tipX - 11} ${yy - 9} L ${tipX} ${yy} L ${tipX - 11} ${yy + 9}`}
              fill='none' stroke={CS_BLUE} strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round' />

            <line x1={x(base.access[0])} y1={yy - 13} x2={x(base.access[0])} y2={yy + 13} stroke={INK} strokeWidth='3' strokeLinecap='round' />
            {i === 0 && (
              <g>
                <rect x={x(base.access[0]) - 46} y={yy + 22} width='92' height='28' rx='14' fill='#FFFFFF' stroke='rgba(25,48,24,0.20)' strokeWidth='1' />
                <text x={x(base.access[0])} y={yy + 41} fontSize='12.5' fontWeight='650' fill={INK} textAnchor='middle'>TODAY · {pct(base.access[0])}</text>
              </g>
            )}

            {isTotal ? (
              <g>
                <text x={labelX} y={yy - 43} fontSize='10.5' fontWeight='700' letterSpacing='0.08em' fill={MUTED_TEXT} textAnchor={labelAnchor}>AFTER {shortName.toUpperCase()}</text>
                <text x={labelX} y={yy - 19} fontSize={29} fontWeight='700' fill={CS_BLUE} textAnchor={labelAnchor}>{pct(m.access[0])}</text>
              </g>
            ) : (
              <g>
                <text x={labelX} y={yy - 59} fontSize='10.5' fontWeight='700' letterSpacing='0.08em' fill={MUTED_TEXT} textAnchor={labelAnchor}>AFTER {shortName.toUpperCase()}</text>
                <text x={labelX} y={yy - 41} fontSize='13' fontWeight='700' fill={CS_BLUE} textAnchor={labelAnchor}>evidence-backed articulations · {pct(m.evidence.access[0])}</text>
                {pts(m.access[0]) !== pts(m.evidence.access[0]) && (
                  <text x={labelX} y={yy - 23} fontSize='13' fontWeight='650' fill={NAVY_SOFT} textAnchor={labelAnchor}>all entries repaired · {pct(m.access[0])}</text>
                )}
              </g>
            )}
            <text x='300' y={yy + 41} fontSize='11.5' fontWeight='600' fill={GAINED} textAnchor='end'>
              +{isTotal ? gainHi : gainLo} pts this milestone
            </text>
          </g>
        )
      })}

      <g data-testid={`paper-gate-ladder-gap-${variant}`} role='img'
        aria-label={`The gap between the income quartiles: ${pts(base.gapQ4Q1)} points today, ${sigGap} with the evidence-backed articulations written, ${allGap} with every entry in these course types repaired.`}>
        <rect x='14' y={gapTop} width='1198' height={gapAfterY - gapTop + 82} rx='12' fill='rgba(25,48,24,0.026)' stroke={GRID} strokeWidth='1' />
        {[0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map((v) => (
          <g key={v}>
            <line x1={x(v)} y1={gapTop + 66} x2={x(v)} y2={gapAfterY + 46} stroke={GRID} strokeWidth='1' strokeDasharray='2 7' />
            <text x={x(v)} y={gapTop + 58} fontSize='11' fill={MUTED_TEXT} textAnchor='middle'>{Math.round(v * 100)}%</text>
          </g>
        ))}
        <text x='28' y={gapTop + 35} fontSize={18} fontWeight='700' fill={CS_BLUE}>
          Evidence-backed articulations close {pts(base.gapQ4Q1) - sigGap} of the {pts(base.gapQ4Q1)} points across these steps
        </text>

        <g>
          <text x='28' y={gapTodayY - 4} fontSize={reg.row} fontWeight='700' fill={INK}>TODAY</text>
          <text x='28' y={gapTodayY + 18} fontSize='12' fill={MUTED_TEXT}>as the tables stand</text>
        </g>
        <g>
          <text x='28' y={gapAfterY - 4} fontSize={reg.row} fontWeight='700' fill={INK}>END OF THESE STEPS</text>
          <text x='28' y={gapAfterY + 18} fontSize='12' fill={MUTED_TEXT}>articulations, and full repair</text>
        </g>

        <polygon points={`${todayPoorX},${gapTodayY + 8} ${todayRichX},${gapTodayY + 8} ${uniRichX},${gapAfterY} ${evidPoorX},${gapAfterY}`}
          fill='rgba(0,114,178,0.055)' />
        <line x1={todayPoorX} y1={gapTodayY + 8} x2={evidPoorX} y2={gapAfterY}
          stroke={CS_BLUE} strokeOpacity='0.78' strokeWidth='1.8' strokeDasharray='7 6' />
        <line x1={todayRichX} y1={gapTodayY + 8} x2={uniRichX} y2={gapAfterY}
          stroke={FIELD} strokeOpacity='0.48' strokeWidth='1.8' strokeDasharray='7 6' />

        <g data-gap-span='today'>
          <line x1={todayPoorX} y1={gapTodayY} x2={todayRichX} y2={gapTodayY} stroke={FIELD} strokeWidth='4.5' strokeLinecap='round' />
          <line x1={todayPoorX} y1={gapTodayY - 10} x2={todayPoorX} y2={gapTodayY + 10} stroke={CS_BLUE} strokeWidth='3' strokeLinecap='round' />
          <line x1={todayRichX} y1={gapTodayY - 10} x2={todayRichX} y2={gapTodayY + 10} stroke={FIELD} strokeWidth='3' strokeLinecap='round' />
          <rect x={(todayPoorX + todayRichX) / 2 - 54} y={gapTodayY - 49} width='108' height='28' rx='14' fill='#FFFFFF' stroke={GRID_STRONG} strokeWidth='1' />
          <text x={(todayPoorX + todayRichX) / 2} y={gapTodayY - 30} fontSize='14' fontWeight='700' fill={INK} textAnchor='middle'>{pts(base.gapQ4Q1)}-POINT GAP</text>
        </g>

        <g data-gap-span='after'>
          <line x1={evidPoorX} y1={gapAfterY} x2={evidRichX} y2={gapAfterY} stroke='rgba(0,114,178,0.18)' strokeWidth='14' strokeLinecap='round' />
          <line x1={uniPoorX} y1={gapAfterY} x2={uniRichX} y2={gapAfterY} stroke={CS_BLUE} strokeWidth='4' strokeLinecap='round' />
          <rect x={Math.min(evidPoorX, uniPoorX)} y={gapAfterY - 13} width={Math.max(8, Math.abs(uniPoorX - evidPoorX))} height='26' rx='7' fill='rgba(0,114,178,0.15)' />
          <line x1={evidPoorX} y1={gapAfterY - 12} x2={evidPoorX} y2={gapAfterY + 12} stroke={CS_BLUE} strokeWidth='2.5' strokeLinecap='round' />
          <line x1={uniPoorX} y1={gapAfterY - 9} x2={uniPoorX} y2={gapAfterY + 9} stroke={CS_BLUE} strokeWidth='2' strokeLinecap='round' />
          <line x1={uniRichX} y1={gapAfterY - 10} x2={uniRichX} y2={gapAfterY + 10} stroke={FIELD} strokeWidth='3' strokeLinecap='round' />
          <text x={(evidPoorX + uniRichX) / 2} y={gapAfterY + 40} fontSize='13.5' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>evidence-backed articulations · {sigGap}-point gap</text>
          <text x={(evidPoorX + uniRichX) / 2} y={gapAfterY + 59} fontSize='12.5' fontWeight='650' fill={NAVY_SOFT} textAnchor='middle'>all entries repaired · {allGap}-point gap</text>
          <text x={evidPoorX} y={gapAfterY - 43} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={CS_BLUE} textAnchor='middle'>LOWEST-INCOME QUARTILE</text>
          <text x={evidPoorX} y={gapAfterY - 25} fontSize='15' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>{pct(last.evidence.access[0]).replace('%', '')}–{pct(last.access[0])}</text>
          <text x={uniRichX} y={gapAfterY - 43} fontSize='10.5' fontWeight='700' letterSpacing='0.07em' fill={SOFT} textAnchor='middle'>HIGHEST-INCOME QUARTILE</text>
          <text x={uniRichX} y={gapAfterY - 25} fontSize='15' fontWeight='700' fill={SOFT} textAnchor='middle'>{pct(last.access[3])}</text>
        </g>

      </g>

      <defs>
        <pattern id='ladderTailHatch' width='8' height='8' patternTransform='rotate(45)' patternUnits='userSpaceOnUse'>
          <line x1='0' y1='0' x2='0' y2='8' stroke='rgba(156,166,155,0.8)' strokeWidth='2' />
        </pattern>
      </defs>
    </svg>
  )
}

function JawsScenarios({ reg, data }) {
  const base = data.baseline
  const sig = cutRoute(data.repairs.scenarios.routeSignatures, ROUTE_ROWS.signatures)
  const total = cutRoute(data.repairs.scenarios.route, ROUTE_ROWS.total)
  const agreements = sig[sig.length - 1].evidence
  const repaired = total[total.length - 1]
  const intro = sig[0].evidence
  const stages = [
    { id: 'today', label: 'Today', sub: 'current articulation, unmodified', access: base.access, gap: base.gapQ4Q1 },
    { id: 'intro', label: 'Intro programming articulated', sub: 'evidence-backed entries only', access: intro.access, gap: intro.gapQ4Q1 },
    { id: 'agreements', label: 'All evidence-backed articulations', sub: 'all backed agreements written', access: agreements.access, gap: agreements.gapQ4Q1 },
    { id: 'repaired', label: 'Computing courses repaired', sub: 'articulated and taught everywhere', access: repaired.access, gap: repaired.gapQ4Q1 },
  ]
  const sx = [210, 520, 830, 1140]
  const y = (v) => 420 - ((v - 0.25) / 0.75) * 350
  const q4Line = stages.map((st, i) => `${sx[i]},${y(st.access[3])}`).join(' ')
  const q1Line = stages.map((st, i) => `${sx[i]},${y(st.access[0])}`).join(' ')
  const wedge = `${stages.map((st, i) => `${sx[i]},${y(st.access[3])}`).join(' ')} ${stages.map((st, i) => `${sx[i]},${y(st.access[0])}`).reverse().join(' ')}`
  return (
    <svg {...svgProps(524, `Two quartile lines across four nested repair worlds. Highest-income-quartile access: ${stages.map((st) => pct(st.access[3])).join(', ')} — nearly flat. Lowest-income-quartile access: ${stages.map((st) => pct(st.access[0])).join(', ')}. The gap between them: ${stages.map((st) => `${pts(st.gap)} points`).join(', ')}.`)}>
      {[0.25, 0.5, 0.75, 1].map((v) => (
        <g key={v}>
          <line x1='120' y1={y(v)} x2='1170' y2={y(v)} stroke={GRID} strokeWidth='1' />
          <text x='108' y={y(v) + 4} fontSize={reg.tick} fill={MUTED_TEXT} textAnchor='end'>{pct(v)}</text>
        </g>
      ))}

      <polygon points={wedge} fill='rgba(0,114,178,0.08)' />
      <polyline points={q4Line} fill='none' stroke={FIELD} strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' />
      <polyline points={q1Line} fill='none' stroke={CS_BLUE} strokeWidth='3.6' strokeLinecap='round' strokeLinejoin='round' />

      {stages.map((st, i) => {
        const converged = pts(st.access[0]) === pts(st.access[3])
        const topY = y(st.access[3])
        const botY = y(st.access[0])
        const gapSpan = botY - topY
        const gx = sx[i]
        return (
          <g key={st.id} role='img' aria-label={`${st.label}: lowest-income quartile ${pct(st.access[0])}, highest-income ${pct(st.access[3])}, a ${pts(st.gap)}-point gap`}>
            <title>{`${st.label}: lowest income ${pct(st.access[0])} · highest income ${pct(st.access[3])} · ${pts(st.gap)}-point gap`}</title>
            <circle cx={sx[i]} cy={topY} r='6.5' fill={FIELD} stroke='#FFFFFF' strokeWidth='1.5' />
            <circle cx={sx[i]} cy={botY} r='7' fill={CS_BLUE} stroke='#FFFFFF' strokeWidth='1.5' />
            {!converged && (
              <text x={sx[i]} y={topY - 14} fontSize='14' fontWeight='700' fill={SOFT} textAnchor='middle'>{pct(st.access[3])}</text>
            )}
            <text x={sx[i]} y={botY + 27} fontSize='14' fontWeight='700' fill={CS_BLUE} textAnchor='middle'>{pct(st.access[0])}</text>
            {converged ? (
              <text x={sx[i]} y={botY + 46} fontSize='12.5' fontWeight='650' fill={GAINED} textAnchor='middle'>gap closed</text>
            ) : (
              <g>
                {gapSpan > 44 && (
                  <g stroke={INK} strokeOpacity='0.4' strokeWidth='1.5'>
                    <line x1={gx} y1={topY + 12} x2={gx} y2={botY - 13} />
                    <line x1={gx - 4} y1={topY + 12} x2={gx + 4} y2={topY + 12} />
                    <line x1={gx - 4} y1={botY - 13} x2={gx + 4} y2={botY - 13} />
                  </g>
                )}
                <text x={gx + 12} y={(topY + botY) / 2 + 4} fontSize='12.5' fontWeight='650' fill={INK}>{pts(st.gap)}-pt gap</text>
              </g>
            )}
            <text x={sx[i]} y='470' fontSize='14' fontWeight='650' fill={INK} textAnchor='middle'>{st.label}</text>
            <text x={sx[i]} y='492' fontSize='11.5' fill={MUTED_TEXT} textAnchor='middle'>{st.sub}</text>
          </g>
        )
      })}

      <text x={sx[0] - 18} y={y(stages[0].access[3]) + 4} fontSize='12.5' fontWeight='600' fill={SOFT} textAnchor='end'>highest-income quartile</text>
      <text x={sx[0] - 18} y={y(stages[0].access[0]) + 4} fontSize='12.5' fontWeight='600' fill={CS_BLUE} textAnchor='end'>lowest-income quartile</text>
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
      </div>
      <div data-export-root className='flex flex-col gap-7'>
        <Beat no='1' title='Articulation level and income sensitivity, across every frequently required course' headlines={headlines} {...BEATS[1]}>
          <ArchScatter reg={reg} />
        </Beat>
        <Beat no='2' title='The income gradient, concentrated in the computing courses' headlines={headlines} {...BEATS[2]}>
          <M2Staircase reg={reg} data={data} basis={basis} />
        </Beat>
        <Beat no='3' title='What articulating each course type would open, and the evidence behind it' headlines={headlines} {...BEATS[3]}>
          <M3Ledger reg={reg} data={data} />
        </Beat>
        <Beat no='4' title='The simulated repair route through the computing courses' headlines={headlines} {...BEATS[4]}>
          {/* M4Signing and the separate full-repair ladder are stowed, not
              deleted: the merged ladder below carries both endpoints per row
              (variant='total' re-renders the full-repair greedy route if it
              earns its place back as an appendix figure). */}
          <M4Ladder reg={reg} data={data} variant='signatures' />
        </Beat>
        <Beat no='5' title='How repairing the computing courses narrows the income gap' headlines={headlines} {...BEATS[5]}>
          <JawsScenarios reg={reg} data={data} />
        </Beat>
        <div className='rounded-[10px] border px-5 py-4 flex flex-col gap-2' data-export-exclude
          style={{ borderColor: 'rgba(25,48,24,0.10)', background: 'rgba(25,48,24,0.03)' }}>
          <span className='text-[11px] tracking-[0.09em] uppercase font-[600]' style={{ color: MUTED_TEXT }}>
            Notes — read before quoting
          </span>
          <ul className='m-0 pl-5 flex flex-col gap-1'>
            {[
              'Evidence is same-type, not validated equivalence. A 95-case stratified sample is committed for hand coding (analysis/data/course_match_codes.v1.json); until it is coded, shares read “has same-type evidence elsewhere,” never “signable.”',
              'The two repair standards (A1+A2 versus all same-type evidence) are not ordered bounds on gap reduction — higher-income-quartile access rises too — so they are labeled by their evidence rules, never as an interval.',
              'Basis sensitivity is substantive: on the eligibility floor the evidence-backed articulations close 20 of the 49 gap points; on stated preparation only about 4 of 37. The robust conclusion is that complete computing repair disproportionately improves lower-income access; the magnitude from articulations alone is basis-dependent.',
              'The ladder’s order is greedy, not provably optimal: each step adds the course type with the largest marginal lowest-income-quartile gain through evidence-backed articulations alone. A full-repair greedy order is also computed (kept in the artifact as a sensitivity); it differs only in the tail — assembly/systems ranks mid-route when teaching is on the table, last under articulations alone. Endpoint totals are order-invariant; per-step attribution is not.',
            ].map((item) => (
              <li key={item} className='text-[13px] leading-relaxed list-disc' style={{ color: '#4A5849' }}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </Stack>
  )
}
