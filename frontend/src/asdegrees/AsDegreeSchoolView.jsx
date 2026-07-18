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

// GE pattern identifiers → the section title shown on the pattern's card.
const GE_PATTERN_NAME = {
  calgetc: 'Approved courses from the Cal-GETC pattern',
  igetc: 'Approved courses from the IGETC pattern',
  csu_ge: 'Approved courses from the CSU GE pattern',
  local_pattern: 'Approved courses from the college GE pattern',
}

// How the degree's units split across major coursework, general education,
// and electives-to-total. Advisement-aware: a choose-N-units group counts its
// unit ask; an all/choose-N-courses group counts (a proportional share of)
// its resolved course units. Display-level only.
function degreeComposition(groups, coursesById, totalUnits) {
  if (!Number.isFinite(totalUnits) || totalUnits <= 0) return null
  let major = 0
  let ge = 0
  for (const g of groups) {
    if (g.units_fill) continue
    const s = (g.sections || [])[0] || {}
    if (g.ge_area) { ge += s.unit_advisement || 0; continue }
    if (s.unit_advisement != null) { major += s.unit_advisement; continue }
    const perReceiver = (s.receivers || []).map((r) => {
      const opt = (r.options || [])[0]
      if (!opt) return 0
      return (opt.course_keys || []).reduce((n, k) => n + (coursesById?.[k]?.units || 0), 0)
    })
    const sum = perReceiver.reduce((a, b) => a + b, 0)
    major += s.section_advisement != null && perReceiver.length && s.section_advisement < perReceiver.length
      ? s.section_advisement * (sum / perReceiver.length)
      : sum
  }
  if (major <= 0 && ge <= 0) return null
  const electives = Math.max(0, totalUnits - major - ge)
  const round = (v) => Math.round(v * 10) / 10
  return { major: round(major), ge: round(ge), electives: round(electives), total: totalUnits }
}

// A single part-to-whole meter: Major · General education · Electives.
// Identity is carried by the direct labels beneath (never color alone), the
// segments keep 2px surface gaps, and the hues are the console's own
// restrained tokens (forest / lime / stone) rather than an imported
// categorical palette — a deliberate trade for the site's minimal look.
const COMPOSITION_SEGMENTS = [
  { key: 'major', label: 'Major courses', color: 'var(--color-primary, #193018)' },
  { key: 'ge', label: 'General education', color: 'var(--color-accent, #96F060)' },
  { key: 'electives', label: 'Electives', color: 'var(--color-border-strong, #C9C9BD)' },
]

function UnitCompositionBar({ major, ge, electives, total, unitWord }) {
  const values = { major, ge, electives }
  const segments = COMPOSITION_SEGMENTS.filter((s) => values[s.key] > 0)
  if (segments.length < 2) return null
  return (
    <div className='surface-card px-[22px] py-4'>
      <p className='text-label'>Unit composition</p>
      <div className='mt-2.5 flex h-2 rounded-pill overflow-hidden gap-[2px]' aria-hidden>
        {segments.map((s) => (
          <span key={s.key} className='h-full rounded-pill'
            style={{ width: `${(values[s.key] / total) * 100}%`, backgroundColor: s.color }} />
        ))}
      </div>
      <div className='mt-2.5 flex items-center gap-5 flex-wrap'>
        {segments.map((s) => (
          <span key={s.key} className='inline-flex items-center gap-1.5 text-caption'>
            <span className='inline-block w-[9px] h-[9px] rounded-pill shrink-0' style={{ backgroundColor: s.color }} />
            <span className='text-ink-muted'>{s.label}</span>
            <span className='font-[600] text-ink tabular'>{values[s.key]}</span>
          </span>
        ))}
        <span className='ml-auto text-caption text-ink-subtle'>{total} {unitWord}</span>
      </div>
    </div>
  )
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
  const { doc, courses_by_id: coursesById, coverage_pct: coverage, missing_core_concepts: missing } = degree
  const units = doc.unit_system === 'quarter' ? 'quarter units' : 'semester units'
  const groups = doc.requirement_groups || []

  // Every group renders through the shared RequirementsLedger, in catalog
  // order. Course groups pass through as stored; a GE-pattern group has no
  // enumerable courses, so it becomes a title-only section — the same
  // SectionCard chrome, headed by the pattern name and its own
  // "Complete N units of:" rule, with no course rows. Electives-to-total
  // groups carry nothing to render.
  const ledgerMajor = useMemo(() => ({
    requirement_groups: groups
      .filter((g) => !g.units_fill
        && (g.ge_area || (g.sections || []).some((s) => (s.receivers || []).length)))
      .map((g) => {
        if (!g.ge_area || (g.sections || []).some((s) => (s.receivers || []).length)) {
          return { ...g, title: ledgerTitle(g.label_seen) || undefined }
        }
        const section = (g.sections || [])[0] || {}
        return {
          ...g,
          title: 'General education',
          sections: [{
            title: GE_PATTERN_NAME[g.ge_area] || 'General-education pattern',
            section_advisement: null,
            unit_advisement: section.unit_advisement ?? null,
            receivers: [],
          }],
        }
      }),
  }), [groups])
  const ledgerCourses = useMemo(
    () => Object.values(coursesById || {}).filter((c) => c && c.course_id != null),
    [coursesById]
  )

  const unresolved = groups.flatMap((g) => g.unresolved_courses_seen || [])
  const composition = useMemo(() => degreeComposition(groups, coursesById, doc.total_units), [groups, coursesById, doc.total_units])

  const tiles = []
  // Coverage against the statewide template is only informative for a LOCAL
  // CS degree (how much of the standard core the college's own design has).
  // An AS-T is the standardized TMC itself, so its coverage is ~always 100%
  // and reads as noise; local_computing has no template at all.
  if (coverage != null && degree.degree_type === 'local_cs_as') {
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
      {composition && <UnitCompositionBar {...composition} unitWord={units} />}
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
