import React, { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Alert, Badge, Button, EmptyState, IconButton, Spinner, Stack, Tabs } from './components/ui'
import { useRefTable, useDeleteRefRow } from './shared/query/hooks/useData'
import { refTableByKey, UC_SCHOOLS } from './references/refTablesRegistry'
import RefRowModal from './references/RefRowModal'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'

/**
 * Hand-curated reference tables, editable in place (row edit/delete/add) via
 * the curation ref CRUD; edits open to any console user, stamped with their uid.
 *
 *   DistrictsTab    — Data → Districts: CC district geography, rail of
 *                     districts → that district's colleges
 *   CampusMinimums  — one campus's hand-curated UC hard minimum, shown inside
 *                     the Agreements flow next to the degree template
 */

const intFmt = new Intl.NumberFormat()
const norm = (value) => String(value || '').toLowerCase()

function groupBy(rows, keyFn) {
  const map = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(row)
  }
  return map
}

function courseLabel(row) {
  const match = row.matched_courses?.[0]
  if (match?.prefix && match?.number) return `${match.prefix} ${match.number}`
  if (Array.isArray(row.parent_ids) && row.parent_ids.length) return row.parent_ids.join(', ')
  return null
}

function splitCourseCode(code) {
  const match = String(code || '').trim().match(/^(.*?)\s+(\S+)$/)
  return match
    ? { prefix: match[1], number: match[2] }
    : { prefix: String(code || '').trim(), number: '' }
}

function readableGroupName(value) {
  return String(value || 'Other')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/Eqations/gi, 'Equations')
    .trim()
}

const MINIMUM_CATEGORIES = [
  {
    key: 'mathematics',
    title: 'Mathematics',
    groupPattern: /(calc|math|algebra|differential|vector|statistic|probability)/i,
    coursePattern: /^(MATH|MAT|STAT|STATS)\b/i,
  },
  {
    key: 'computer_science',
    title: 'Computer Science',
    groupPattern: /(intro|program|data.?structure|organization|algorithm|computer|software|system|architecture)/i,
    coursePattern: /^(CS|CSE|COM\s*SCI|CMPSC|COMPSCI|ECS|I&C\s*SCI|IN4MATX)\b/i,
  },
  {
    key: 'natural_science',
    title: 'Natural Science',
    groupPattern: /(physics|chemistry|biology|science)/i,
    coursePattern: /^(PHYS|PHYSICS|CHEM|BIO|BIOLOGY|ASTRON|GEOL)\b/i,
  },
]

function minimumCategory(groupId, rows) {
  const named = MINIMUM_CATEGORIES.find((category) => category.groupPattern.test(String(groupId || '')))
  if (named) return named
  const codes = rows.map((row) => String(row.receiving_code || '').trim()).filter(Boolean)
  const byCourses = MINIMUM_CATEGORIES.find(
    (category) => codes.length > 0 && codes.every((code) => category.coursePattern.test(code))
  )
  return byCourses || { key: 'other', title: 'Other Requirements' }
}

function minimumSectionRank(groupId, categoryKey) {
  const value = String(groupId || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
  if (categoryKey === 'mathematics') {
    const calc = value.match(/^calc(\d+)$/)
    if (calc) return Number(calc[1])
    if (value === 'calc') return 1
    if (/multivariable|vector/.test(value)) return 20
    if (/linearalgebra/.test(value)) return 30
    if (/differential/.test(value)) return 40
    if (/discrete/.test(value)) return 50
  }
  if (categoryKey === 'computer_science') {
    const intro = value.match(/^intro(\d+)$/)
    if (intro) return Number(intro[1])
    if (value === 'intro') return 1
    if (/program/.test(value)) return 20
    if (/data.?structure/.test(value)) return 30
    if (/organization|architecture|system/.test(value)) return 40
  }
  return 100
}

function declaredMinimumAsk(rows) {
  const values = rows
    .map((row) => Number(row.source_entry?.[2]))
    .filter((value) => Number.isFinite(value) && value > 0)
  return values.length === rows.length && values.every((value) => value === values[0])
    ? values[0]
    : null
}

/**
 * Translate the compact curated-minimum rows into the same requirement shape
 * used by ASSIST agreements and degree templates. Atomic requirements become
 * named sections inside broad subject groups; their set alternatives remain
 * local to that section.
 */
export function minimumsToLedger(inputRows = []) {
  const rows = inputRows.slice().sort((a, b) =>
    String(a.group_id).localeCompare(String(b.group_id)) ||
    String(a.set_id).localeCompare(String(b.set_id)) ||
    Number(a.source_order || 0) - Number(b.source_order || 0))
  const universityCoursesById = {}
  const toCourseId = (row) => {
    const matched = row.matched_courses?.[0] || null
    const parentId = matched?.parent_id ?? row.parent_ids?.[0] ?? `minimum:${row._id || row.receiving_code}`
    const parsed = splitCourseCode(row.receiving_code)
    universityCoursesById[parentId] = {
      prefix: matched?.prefix || parsed.prefix,
      number: matched?.number || parsed.number,
      title: matched?.title || null,
    }
    return parentId
  }
  const courseReceiver = (row) => ({
    receiving: { kind: 'course', parent_id: toCourseId(row), units: null },
    articulation_status: null,
    options: [],
    options_conjunction: 'or',
  })

  const atomicSections = [...groupBy(rows, (row) => row.group_id || 'Other')]
    .map(([groupId, groupRows]) => {
      const category = minimumCategory(groupId, groupRows)
      const sets = [...groupBy(groupRows, (row) => String(row.set_id || 'A'))]
      const declaredAsk = declaredMinimumAsk(groupRows)
      let receivers
      let sectionAdvisement

      if (sets.every(([, setRows]) => setRows.length === 1)) {
        // Every set is a single course: the sets are the alternatives.
        receivers = groupRows.map(courseReceiver)
        sectionAdvisement = Math.min(declaredAsk || 1, receivers.length)
      } else {
        // A set holding several courses is taken together — one series
        // receiver per set (one combined row), preserving OR-of-AND
        // semantics between sets.
        receivers = sets.map(([, setRows]) => ({
          receiving: {
            kind: 'series',
            parent_ids: setRows.map(toCourseId),
            conjunction: 'and',
            units: null,
          },
          articulation_status: null,
          options: [],
          options_conjunction: 'or',
        }))
        sectionAdvisement = 1
      }

      return {
        category,
        rank: minimumSectionRank(groupId, category.key),
        section: {
          title: readableGroupName(groupId),
          source_group_id: groupId,
          section_advisement: sectionAdvisement,
          receivers,
        },
      }
    })

  // A "plain" requirement is take-this-one-course — no alternatives, no
  // series. Two or more of them inside a subject read as one combined
  // "Complete all of:" card; named cards stay only where the name carries
  // choice or series semantics (or a plain course has nothing to merge with).
  const isPlainCourse = (item) =>
    item.section.receivers.length === 1 &&
    item.section.receivers[0].receiving?.kind === 'course'

  const requirement_groups = [...groupBy(atomicSections, (item) => item.category.key)]
    .map(([, items]) => {
      const ordered = items
        .slice()
        .sort((a, b) => a.rank - b.rank || a.section.title.localeCompare(b.section.title))
      const plain = ordered.filter(isPlainCourse)
      const entries = plain.length >= 2
        ? [
            ...ordered.filter((item) => !isPlainCourse(item)),
            {
              rank: plain[0].rank,
              section: {
                title: null,
                section_advisement: plain.length,
                receivers: plain.map((item) => item.section.receivers[0]),
              },
            },
          ].sort((a, b) => a.rank - b.rank)
        : ordered
      return {
        title: items[0].category.title,
        categoryOrder: MINIMUM_CATEGORIES.findIndex((category) => category.key === items[0].category.key),
        is_required: true,
        group_conjunction: 'And',
        sections: entries.map((item) => item.section),
      }
    })
    .sort((a, b) => {
      const aOrder = a.categoryOrder < 0 ? MINIMUM_CATEGORIES.length : a.categoryOrder
      const bOrder = b.categoryOrder < 0 ? MINIMUM_CATEGORIES.length : b.categoryOrder
      return aOrder - bOrder
    })
    .map(({ categoryOrder: _categoryOrder, ...group }) => group)

  return { requirement_groups, universityCoursesById }
}

// ── shared table with optional per-row edit/delete ──
export function DataTable({ columns, rows, maxHeight = 'max-h-[68vh]', onEdit, onDelete, deleting }) {
  const showActions = !!(onEdit || onDelete)
  return (
    <div className={`surface-card overflow-auto ${maxHeight}`}>
      <table className='min-w-full border-separate border-spacing-0 text-left'>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`sticky top-0 bg-surface border-b border-border/60 px-[22px] py-3 text-label ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
            {showActions && <th className='sticky top-0 bg-surface border-b border-border/60 px-[22px] py-3 text-label text-right'>edit</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row._id || row.key || i} className='hover:bg-surface-hover'>
              {columns.map((col) => (
                <td key={col.key} className={`border-b border-border/40 px-[22px] py-[13px] text-caption align-top ${col.cellClassName || 'text-ink-muted'}`}>
                  {col.render ? col.render(row) : (row[col.key] ?? '-')}
                </td>
              ))}
              {showActions && (
                <td className='border-b border-border/40 px-[22px] py-[13px] text-right whitespace-nowrap'>
                  <span className='inline-flex items-center gap-1'>
                    {onEdit && <IconButton variant='ghost' icon={PencilSquareIcon} label='Edit row' onClick={() => onEdit(row)} />}
                    {onDelete && <IconButton variant='danger' icon={TrashIcon} label='Delete row' disabled={deleting} onClick={() => onDelete(row)} />}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Same rail vocabulary as DataPage's InstitutionRail (notch + bg-primary-soft
// active state) — this one keeps its own active-key comparison and its
// caller-supplied `renderRow` for the row body, since districts show a
// two-line count/region caption that colleges' plain subtitle doesn't.
function ReferenceRail({ title, count, rows, selectedKey, onSelect, renderRow, query, onQuery, placeholder, search = true }) {
  return (
    <div className='surface-card p-2.5 lg:max-h-[75vh] overflow-auto'>
      <p className='px-3 pt-2.5 pb-2 flex items-baseline gap-2 text-label'>{title} · {intFmt.format(count)}</p>
      {search && (
        <div className='flex items-center gap-2 bg-canvas border border-border rounded-pill px-3 py-[7px] mx-1 mb-2'>
          <MagnifyingGlassIcon className='w-3.5 h-3.5 text-ink-subtle shrink-0' />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder}
            className='flex-1 min-w-0 bg-transparent outline-none border-none text-[13px] text-ink placeholder:text-ink-subtle' />
        </div>
      )}
      <div className='flex flex-col gap-0.5'>
        {rows.map((row) => {
          const active = String(row.key) === String(selectedKey)
          return (
            <button key={row.key} type='button' onClick={() => onSelect(row.key)}
              className={`w-full flex items-start gap-2.5 rounded-[10px] px-3 py-[9px] text-left transition-colors ${
                active ? 'bg-primary-soft font-[650]' : 'hover:bg-surface-hover'}`}>
              <span className={`w-[3px] h-3.5 rounded-pill mt-0.5 shrink-0 ${active ? 'bg-accent' : 'bg-transparent'}`} />
              <span className='min-w-0 flex-1'>{renderRow(row)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── hook: shared edit/delete/add wiring for a reference table ──
export function useRowEditing(tableKey) {
  const config = refTableByKey(tableKey)
  const del = useDeleteRefRow(tableKey)
  const [editing, setEditing] = useState(null)
  return {
    config,
    editing,
    openEdit: (row) => setEditing({ row: { ...row }, isNew: false }),
    openAdd: (prefill = {}) => setEditing({ row: { ...config.newRow(), ...prefill }, isNew: true }),
    close: () => setEditing(null),
    remove: (row) => { if (window.confirm('Delete this row? This cannot be undone.')) del.mutate(row._id) },
    deleting: del.isPending,
  }
}

// ── Data → Districts: rail of CC districts → that district's colleges ──
export default function DistrictsTab() {
  const districts = useRefTable('community_college_geography')
  if (districts.isLoading) return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  if (districts.isError) return <Alert type='error'>Failed to load the district table.</Alert>
  return <DistrictLookup rows={districts.data?.rows || []} />
}

function DistrictLookup({ rows }) {
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)
  const ed = useRowEditing('community_college_geography')

  const districts = useMemo(() => {
    const byDistrict = groupBy(rows, (r) => r.district || 'Unmapped district')
    return [...byDistrict.entries()].map(([name, items]) => ({
      key: name,
      name,
      region: items[0]?.region || 'Unmapped region',
      colleges: items.slice().sort((a, b) => String(a.community_college).localeCompare(String(b.community_college))),
      counties: [...new Set(items.flatMap((r) => r.counties_served || []))].sort(),
    })).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const railRows = useMemo(() => {
    const q = norm(query)
    if (!q) return districts
    return districts.filter((row) =>
      norm(row.name).includes(q) || norm(row.region).includes(q) ||
      norm(row.counties.join(' ')).includes(q) ||
      row.colleges.some((c) => norm(c.community_college).includes(q)))
  }, [districts, query])

  const selected = useMemo(
    () => districts.find((row) => String(row.key) === String(selectedKey)) || districts[0] || null,
    [districts, selectedKey])

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <span className='text-[13px] text-ink-subtle'>
          {intFmt.format(rows.length)} colleges mapped to {intFmt.format(districts.length)} districts
        </span>
        <Button className='ml-auto' leadingIcon={PlusIcon}
          onClick={() => ed.openAdd(selected ? { district: selected.name, region: selected.region } : {})}>
          Add college
        </Button>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-5 items-start'>
        <ReferenceRail title='Districts' count={districts.length} rows={railRows}
          selectedKey={selected?.key} onSelect={setSelectedKey} query={query} onQuery={setQuery}
          placeholder='Find district, county, college…'
          renderRow={(row) => (
            <>
              <span className='block text-[13.5px] text-ink truncate'>{row.name}</span>
              <span className='block text-[11.5px] text-ink-subtle truncate mt-px'>{row.colleges.length} colleges · {row.region}</span>
            </>
          )} />

        {!selected ? (
          <EmptyState title='No reference rows' description='The district reference table is empty.' />
        ) : (
          <Stack gap='cozy'>
            <div className='surface-card px-[22px] py-[18px] flex flex-col gap-2.5'>
              <p className='text-[16px] font-[650] tracking-[-.01em]'>{selected.name}</p>
              <p className='text-[13px] text-ink-subtle'>{selected.region} · {selected.colleges.length} colleges</p>
              <div className='flex flex-wrap gap-2'>
                {selected.counties.map((county) => <span key={county} className='chip'>{county}</span>)}
              </div>
            </div>

            <DataTable
              rows={selected.colleges}
              onEdit={ed.openEdit} onDelete={ed.remove} deleting={ed.deleting}
              columns={[
                { key: 'community_college', label: 'Community college', cellClassName: 'text-ink' },
                { key: 'counties_served', label: 'Counties served', render: (r) => (r.counties_served || []).join(', ') || '-' },
                { key: '_id', label: 'cc id', render: (r) => <span className='font-mono'>{r._id}</span> },
              ]} />
          </Stack>
        )}
      </div>

      <RefRowModal config={ed.config} editing={ed.editing} onClose={ed.close} />
    </Stack>
  )
}

// ── one campus's hand-curated UC hard minimum (Agreements → Transfer requirements) ──
export function CampusMinimums({ schoolId }) {
  const minimums = useRefTable('transfer_minimums')
  const ed = useRowEditing('transfer_minimums')
  const [view, setView] = useState('preview')

  const rows = useMemo(() => {
    const mine = (minimums.data?.rows || []).filter((r) => Number(r.school_id) === Number(schoolId))
    return mine.sort((a, b) =>
      String(a.group_id).localeCompare(String(b.group_id)) ||
      String(a.set_id).localeCompare(String(b.set_id)) ||
      Number(a.source_order || 0) - Number(b.source_order || 0))
  }, [minimums.data, schoolId])

  const groupSetCounts = useMemo(() => {
    const counts = new Map()
    for (const [groupId, groupRows] of groupBy(rows, (r) => r.group_id || 'Ungrouped')) {
      counts.set(groupId, new Set(groupRows.map((r) => r.set_id)).size)
    }
    return counts
  }, [rows])

  if (minimums.isLoading) return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  if (minimums.isError) return <Alert type='error'>Failed to load the transfer requirements.</Alert>

  const school = rows[0]?.school || null
  const campusEntry = Object.entries(UC_SCHOOLS)
    .find(([, campus]) => Number(campus.school_id) === Number(schoolId))
  const ucCode = rows[0]?.uc_code || campusEntry?.[0] || ''
  const schoolName = school || campusEntry?.[1]?.school || null
  const unmatched = rows.filter((r) => !r.matched).length
  const ledger = minimumsToLedger(rows)

  return (
    <Stack gap='cozy'>
      <div className='surface-card px-[22px] py-[18px] flex flex-wrap items-start gap-4'>
        <div className='min-w-0'>
          <p className='text-label text-[12px]'>Hand-curated minimum transfer requirements</p>
          <p className='mt-1.5 text-[19px] font-[650] tracking-[-.01em] break-words'>
            {schoolName || 'No requirements for this campus yet'}{ucCode ? <span className='text-ink-subtle'> · {ucCode}</span> : null}
          </p>
          <p className='text-caption text-ink-muted mt-1'>
            Computer science and mathematics courses only—not the full degree · {rows.length} course entries
          </p>
        </div>
        <div className='ml-auto flex flex-wrap items-center gap-2 shrink-0'>
          {unmatched > 0 && <Badge variant='conservative'>{unmatched} not matched</Badge>}
          {/* Nothing else lives in this cluster — mounting controls beside the
              Tabs on toggle used to shove the pill sideways. */}
          <Tabs value={view} onChange={setView} options={[
            { value: 'preview', label: 'Rendered' },
            { value: 'edit', label: 'Edit rows' },
          ]} />
        </div>
      </div>

      {view === 'preview' && rows.length > 0 && (
        <div className='uui-scope motion-safe:animate-[riseIn_200ms_var(--ease-out)]'>
          <RequirementsLedger major={{ requirement_groups: ledger.requirement_groups }}
            universityCoursesById={ledger.universityCoursesById}
            preserveOrder showCompletion={false} />
        </div>
      )}

      {view === 'preview' && rows.length === 0 && (
        <div className='motion-safe:animate-[riseIn_200ms_var(--ease-out)]'>
          <EmptyState title='No transfer requirements'
            description='No hand-curated minimum transfer requirements have been added for this campus. Open Edit rows to add the first requirement.' />
        </div>
      )}

      {view === 'edit' && (
        <div className='flex flex-wrap items-center gap-2 motion-safe:animate-[riseIn_200ms_var(--ease-out)]'>
          <span className='text-caption'>Each row is one required course — group alternatives with a shared Group and distinct Sets.</span>
          <Button className='ml-auto' leadingIcon={PlusIcon} onClick={() => ed.openAdd(ucCode ? { uc_code: ucCode } : {})}>
            Add requirement
          </Button>
        </div>
      )}

      {view === 'edit' && rows.length > 0 && (
        <div className='motion-safe:animate-[riseIn_200ms_var(--ease-out)]'>
        <DataTable
          rows={rows}
          onEdit={ed.openEdit} onDelete={ed.remove} deleting={ed.deleting}
          columns={[
            { key: 'group_id', label: 'Group', cellClassName: 'text-ink-muted whitespace-nowrap' },
            {
              key: 'receiving_code',
              label: 'Required course',
              render: (r) => {
                const hasAlternatives = (groupSetCounts.get(r.group_id || 'Ungrouped') || 0) > 1
                return (
                  <span className='inline-flex flex-wrap items-center gap-2'>
                    <span className='font-mono text-ink'>{r.receiving_code}</span>
                    {hasAlternatives && <span className='text-tag text-ink-subtle font-mono'>alt {r.set_id}</span>}
                    {!r.matched && <Badge variant='conservative'>not matched</Badge>}
                  </span>
                )
              },
            },
            {
              key: 'matched_course',
              label: 'Matched UC course',
              render: (r) => {
                const match = r.matched_courses?.[0]
                if (!r.matched) return <span className='text-ink-subtle'>-</span>
                return (
                  <span>
                    <span className='font-mono text-ink'>{courseLabel(r)}</span>
                    {match?.title ? <span className='ml-2'>{match.title}</span> : null}
                  </span>
                )
              },
            },
          ]} />
        </div>
      )}

      <RefRowModal config={ed.config} editing={ed.editing} onClose={ed.close} />
    </Stack>
  )
}
