import React, { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, PencilSquareIcon, TrashIcon, PlusIcon } from '@heroicons/react/24/outline'
import { Alert, Badge, Button, EmptyState, Input, Spinner, Stack } from './components/ui'
import { useRefTable, useDeleteRefRow } from './shared/query/hooks/useData'
import { refTableByKey } from './references/refTablesRegistry'
import RefRowModal from './references/RefRowModal'
import RouteHint from './components/RouteHint'

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

// ── shared table with optional per-row edit/delete ──
function DataTable({ columns, rows, maxHeight = 'max-h-[68vh]', onEdit, onDelete, deleting }) {
  const showActions = !!(onEdit || onDelete)
  return (
    <div className={`surface-card overflow-auto ${maxHeight}`}>
      <table className='min-w-full border-separate border-spacing-0 text-left'>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`sticky top-0 bg-surface border-b border-border px-3 py-2 text-label ${col.className || ''}`}>
                {col.label}
              </th>
            ))}
            {showActions && <th className='sticky top-0 bg-surface border-b border-border px-2 py-2 text-label text-right'>edit</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row._id || row.key || i} className='hover:bg-surface-hover'>
              {columns.map((col) => (
                <td key={col.key} className={`border-b border-border px-3 py-1.5 text-caption align-top ${col.cellClassName || 'text-ink-muted'}`}>
                  {col.render ? col.render(row) : (row[col.key] ?? '-')}
                </td>
              ))}
              {showActions && (
                <td className='border-b border-border px-2 py-1 text-right whitespace-nowrap'>
                  {onEdit && <Button variant='ghost' leadingIcon={PencilSquareIcon} onClick={() => onEdit(row)} />}
                  {onDelete && <Button variant='ghost' leadingIcon={TrashIcon} disabled={deleting} onClick={() => onDelete(row)} />}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReferenceRail({ title, count, rows, selectedKey, onSelect, renderRow, query, onQuery, placeholder, search = true }) {
  return (
    <div className='surface-card p-3 lg:max-h-[75vh] overflow-auto'>
      <p className='text-label mb-2'>{title} · {intFmt.format(count)}</p>
      {search && (
        <div className='mb-3'>
          <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder}
            leadingIcon={MagnifyingGlassIcon} />
        </div>
      )}
      <div className='space-y-1'>
        {rows.map((row) => {
          const active = String(row.key) === String(selectedKey)
          return (
            <button key={row.key} type='button' onClick={() => onSelect(row.key)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md border transition-colors ${
                active ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-hover'}`}>
              {renderRow(row)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── hook: shared edit/delete/add wiring for a reference table ──
function useRowEditing(tableKey) {
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
        <span className='text-caption text-ink-subtle'>
          {intFmt.format(rows.length)} colleges mapped to {intFmt.format(districts.length)} districts
        </span>
        <RouteHint path='/api/assist/institutions?kind=community_college' />
        <Button className='ml-auto' leadingIcon={PlusIcon}
          onClick={() => ed.openAdd(selected ? { district: selected.name, region: selected.region } : {})}>
          Add college
        </Button>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start'>
        <ReferenceRail title='Districts' count={districts.length} rows={railRows}
          selectedKey={selected?.key} onSelect={setSelectedKey} query={query} onQuery={setQuery}
          placeholder='Find district, county, college…'
          renderRow={(row) => (
            <>
              <p className='text-body leading-snug'>{row.name}</p>
              <p className='text-caption text-ink-subtle mt-0.5'>{row.colleges.length} colleges · {row.region}</p>
            </>
          )} />

        {!selected ? (
          <EmptyState title='No reference rows' description='The district reference table is empty.' />
        ) : (
          <Stack gap='cozy'>
            <div className='surface-card p-4'>
              <p className='text-body-strong'>{selected.name}</p>
              <p className='text-caption text-ink-muted mt-1'>{selected.region} · {selected.colleges.length} colleges</p>
              <div className='mt-3 flex flex-wrap gap-2'>
                {selected.counties.map((county) => <Badge key={county}>{county}</Badge>)}
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

// ── one campus's hand-curated UC hard minimum (Agreements → Min requirements) ──
export function CampusMinimums({ schoolId }) {
  const minimums = useRefTable('transfer_minimums')
  const ed = useRowEditing('transfer_minimums')

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
  if (minimums.isError) return <Alert type='error'>Failed to load the UC minimums table.</Alert>

  const school = rows[0]?.school || null
  const ucCode = rows[0]?.uc_code || ''
  const unmatched = rows.filter((r) => !r.matched).length

  return (
    <Stack gap='cozy'>
      <div className='surface-card p-4 flex flex-wrap items-start gap-4'>
        <div className='min-w-0'>
          <p className='text-body-strong'>{school || 'No minimums for this campus yet'}{ucCode ? <span className='text-ink-subtle'> · {ucCode}</span> : null}</p>
          <p className='text-caption text-ink-muted mt-0.5'>Hand-curated hard minimum · {rows.length} course entries</p>
        </div>
        <div className='ml-auto flex items-center gap-2 shrink-0'>
          {unmatched > 0 && <Badge variant='conservative'>{unmatched} not matched</Badge>}
          <Button leadingIcon={PlusIcon} onClick={() => ed.openAdd(ucCode ? { uc_code: ucCode } : {})}>
            Add requirement
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
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
      )}

      <RefRowModal config={ed.config} editing={ed.editing} onClose={ed.close} />
    </Stack>
  )
}
