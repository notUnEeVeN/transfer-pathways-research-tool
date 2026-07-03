import React, { useMemo, useState } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { Alert, Badge, EmptyState, Input, Spinner, Stack, Tabs } from './components/ui'
import { useAnalysisRaw } from './shared/query/hooks/useData'

const intFmt = new Intl.NumberFormat()

function norm(value) {
  return String(value || '').toLowerCase()
}

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

function DataTable({ columns, rows, maxHeight = 'max-h-[68vh]' }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReferenceRail({ title, count, rows, selectedKey, onSelect, renderRow, query, onQuery, placeholder }) {
  return (
    <div className='surface-card p-3 lg:max-h-[75vh] overflow-auto'>
      <p className='text-label mb-2'>{title} · {intFmt.format(count)}</p>
      <Input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder={placeholder}
        leadingIcon={MagnifyingGlassIcon}
        className='mb-3'
      />
      <div className='space-y-1'>
        {rows.map((row) => {
          const active = String(row.key) === String(selectedKey)
          return (
            <button
              key={row.key}
              type='button'
              onClick={() => onSelect(row.key)}
              className={`w-full text-left px-2.5 py-1.5 rounded-md border transition-colors ${
                active ? 'border-primary bg-primary-soft' : 'border-transparent hover:bg-surface-hover'
              }`}
            >
              {renderRow(row)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DistrictLookup({ rows }) {
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)

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
      norm(row.name).includes(q) ||
      norm(row.region).includes(q) ||
      norm(row.counties.join(' ')).includes(q) ||
      row.colleges.some((college) => norm(college.community_college).includes(q))
    )
  }, [districts, query])

  const selected = useMemo(() => {
    return districts.find((row) => String(row.key) === String(selectedKey)) || districts[0] || null
  }, [districts, selectedKey])

  return (
    <Stack gap='cozy'>
      <p className='text-caption text-ink-subtle'>
        {intFmt.format(rows.length)} colleges mapped to {intFmt.format(districts.length)} districts
      </p>

      <div className='grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start'>
        <ReferenceRail
          title='Districts'
          count={districts.length}
          rows={railRows}
          selectedKey={selected?.key}
          onSelect={setSelectedKey}
          query={query}
          onQuery={setQuery}
          placeholder='Find district, county, college…'
          renderRow={(row) => (
            <>
              <p className='text-body leading-snug'>{row.name}</p>
              <p className='text-caption text-ink-subtle mt-0.5'>
                {row.colleges.length} colleges · {row.region}
              </p>
            </>
          )}
        />

        {!selected ? (
          <EmptyState title='No reference rows' description='The district reference table is empty.' />
        ) : (
          <Stack gap='cozy'>
            <div className='surface-card p-4'>
              <p className='text-body-strong'>{selected.name}</p>
              <p className='text-caption text-ink-muted mt-1'>
                {selected.region} · {selected.colleges.length} colleges
              </p>
              <div className='mt-3 flex flex-wrap gap-2'>
                {selected.counties.map((county) => (
                  <Badge key={county}>{county}</Badge>
                ))}
              </div>
            </div>

            <DataTable
              rows={selected.colleges}
              columns={[
                { key: 'community_college', label: 'Community college', cellClassName: 'text-ink' },
                { key: 'counties_served', label: 'Counties served', render: (r) => (r.counties_served || []).join(', ') || '-' },
                { key: '_id', label: 'cc id', render: (r) => <span className='font-mono'>{r._id}</span> },
              ]}
            />
          </Stack>
        )}
      </div>
    </Stack>
  )
}

function UcMinimumsLookup({ rows }) {
  const [query, setQuery] = useState('')
  const [selectedKey, setSelectedKey] = useState(null)

  const campuses = useMemo(() => {
    const byCampus = groupBy(rows, (r) => String(r.school_id))
    return [...byCampus.entries()].map(([key, items]) => {
      const sorted = items.slice().sort((a, b) =>
        String(a.group_id).localeCompare(String(b.group_id)) ||
        String(a.set_id).localeCompare(String(b.set_id)) ||
        Number(a.source_order || 0) - Number(b.source_order || 0)
      )
      return {
        key,
        school: sorted[0]?.school || `School ${key}`,
        ucCode: sorted[0]?.uc_code || '',
        requirements: sorted,
        matched: sorted.filter((r) => r.matched).length,
        groups: [...new Set(sorted.map((r) => r.group_id))].sort(),
        alternativeGroups: [...groupBy(sorted, (r) => r.group_id).values()].filter((groupRows) =>
          new Set(groupRows.map((r) => r.set_id)).size > 1
        ).length,
      }
    }).sort((a, b) => a.school.localeCompare(b.school))
  }, [rows])

  const railRows = useMemo(() => {
    const q = norm(query)
    if (!q) return campuses
    return campuses.filter((campus) =>
      norm(campus.school).includes(q) ||
      norm(campus.ucCode).includes(q) ||
      campus.requirements.some((row) =>
        norm(row.group_id).includes(q) ||
        norm(row.receiving_code).includes(q) ||
        norm(courseLabel(row)).includes(q)
      )
    )
  }, [campuses, query])

  const selected = campuses.find((row) => String(row.key) === String(selectedKey)) || campuses[0] || null
  const selectedRows = selected?.requirements || []
  const selectedGroupSetCounts = useMemo(() => {
    const counts = new Map()
    for (const [groupId, groupRows] of groupBy(selectedRows, (r) => r.group_id || 'Ungrouped')) {
      counts.set(groupId, new Set(groupRows.map((r) => r.set_id)).size)
    }
    return counts
  }, [selectedRows])

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <span className='text-caption text-ink-subtle'>
          {intFmt.format(rows.length)} imported hard-minimum requirements · {intFmt.format(campuses.length)} UC campuses
        </span>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start'>
        <ReferenceRail
          title='UC campuses'
          count={campuses.length}
          rows={railRows}
          selectedKey={selected?.key}
          onSelect={setSelectedKey}
          query={query}
          onQuery={setQuery}
          placeholder='Find UCB, calculus, CSE…'
          renderRow={(campus) => (
            <>
              <p className='text-body leading-snug'>
                {campus.school}
                {campus.ucCode && <span className='ml-2 text-caption font-mono text-ink-subtle'>{campus.ucCode}</span>}
              </p>
              <p className='text-caption text-ink-subtle mt-0.5'>
                {campus.requirements.length} courses · {campus.groups.length} groups
                {campus.matched < campus.requirements.length
                  ? ` · ${campus.requirements.length - campus.matched} not matched`
                  : ''}
              </p>
            </>
          )}
        />

        {!selected ? (
          <EmptyState title='No minimums imported' description='The UC hard-minimum reference table is empty.' />
        ) : (
          <Stack gap='cozy'>
            <div className='surface-card p-4 flex flex-wrap items-start gap-4'>
              <div className='min-w-0'>
                <p className='text-body-strong'>{selected.school}</p>
                <p className='text-caption text-ink-muted mt-1'>
                  {selected.ucCode} · {selected.requirements.length} required course entries
                </p>
              </div>
              <div className='ml-auto flex flex-wrap gap-2'>
                {selected.matched < selected.requirements.length && (
                  <Badge variant='conservative'>
                    {selected.requirements.length - selected.matched} not matched
                  </Badge>
                )}
              </div>
            </div>

            <DataTable
              rows={selectedRows}
              columns={[
                { key: 'group_id', label: 'Group', cellClassName: 'text-ink-muted whitespace-nowrap' },
                {
                  key: 'receiving_code',
                  label: 'Required course',
                  render: (r) => {
                    const hasAlternatives = (selectedGroupSetCounts.get(r.group_id || 'Ungrouped') || 0) > 1
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
              ]}
            />
          </Stack>
        )}
      </div>
    </Stack>
  )
}

export default function DataReferences() {
  const [tab, setTab] = useState('minimums')
  const districts = useAnalysisRaw('ref_cc_districts')
  const minimums = useAnalysisRaw('ref_uc_transfer_requirements')

  if (districts.isLoading || minimums.isLoading) {
    return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  }

  if (districts.isError || minimums.isError) {
    return <Alert type='error'>Failed to load reference tables.</Alert>
  }

  return (
    <Stack gap='section'>
      <div className='flex flex-wrap items-center gap-3'>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'minimums', label: 'UC minimums' },
            { value: 'districts', label: 'CC districts' },
          ]}
        />
        <span className='text-caption text-ink-subtle'>
          Live reference tables from /analysis/raw
        </span>
      </div>

      {tab === 'minimums' && <UcMinimumsLookup rows={minimums.data?.rows || []} />}
      {tab === 'districts' && <DistrictLookup rows={districts.data?.rows || []} />}
    </Stack>
  )
}
