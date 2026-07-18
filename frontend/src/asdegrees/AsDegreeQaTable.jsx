import React, { useMemo, useState } from 'react'
import { Alert, Badge, Button, Select, Input, Spinner, Stack, Tabs } from '../components/ui'
import { useAsDegrees } from '../shared/query/hooks/useData'
import { DataTable } from '../DataReferences'

export const DEGREE_TYPE_LABEL = {
  ast: 'CS A.S.-T',
  local_cs_as: 'Local CS A.S.',
  local_computing: 'Other computing',
}

const TYPE_OPTIONS = [
  { value: 'ast', label: 'CS A.S.-T' },
  { value: 'local_cs_as', label: 'Local CS A.S.' },
  { value: 'local_computing', label: 'Other computing' },
  { value: 'all', label: 'All records' },
]

const FILTER_OPTIONS = [
  { value: 'all', label: 'All quality states' },
  { value: 'flagged', label: 'Flagged only' },
  { value: 'duplicates', label: 'Duplicate candidates' },
  { value: 'template_default', label: 'Has template placeholders' },
  { value: 'not_found', label: 'Not found / ambiguous' },
  { value: 'unverified', label: 'Unverified only' },
]

const SORT_OPTIONS = [
  { value: 'college', label: 'Sort: college' },
  { value: 'degree_type', label: 'Sort: degree type' },
  { value: 'coverage', label: 'Sort: lowest core coverage' },
  { value: 'confidence', label: 'Sort: lowest confidence' },
]

const TYPE_ORDER = { ast: 0, local_cs_as: 1, local_computing: 2 }
const STATUS_VARIANT = { found: 'success', none_found: 'neutral', ambiguous: 'conservative' }

const confidencePct = (value) => value == null ? '—' : `${Math.round(value * 100)}%`
const coveragePct = (value) => value == null ? '—' : `${Math.round(value)}%`

const matchesFilter = (row, filter) => {
  if (filter === 'flagged') return row.flags.length > 0
  if (filter === 'duplicates') return row.flags.includes('duplicate_candidate')
  if (filter === 'template_default') return row.flags.includes('template_default_groups')
  if (filter === 'not_found') return row.status !== 'found'
  if (filter === 'unverified') return !row.verified
  return true
}

const compareNullable = (a, b, fallback = Number.POSITIVE_INFINITY) =>
  (a ?? fallback) - (b ?? fallback)

export default function AsDegreeQaTable({ degreeType = 'ast', onDegreeTypeChange = () => {}, onOpen }) {
  const selectedType = degreeType === 'all' ? null : degreeType
  const asDegrees = useAsDegrees(selectedType)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('college')

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = (asDegrees.data?.rows || []).filter((row) => {
      if (!matchesFilter(row, filter)) return false
      if (!needle) return true
      return `${row.college_name} ${row.degree_title_seen || ''} ${DEGREE_TYPE_LABEL[row.degree_type] || ''} ${(row.flags || []).join(' ')}`
        .toLowerCase().includes(needle)
    })
    return filtered.slice().sort((a, b) => {
      if (sort === 'degree_type') {
        return (TYPE_ORDER[a.degree_type] ?? 99) - (TYPE_ORDER[b.degree_type] ?? 99)
          || String(a.college_name).localeCompare(String(b.college_name))
      }
      if (sort === 'coverage') {
        return compareNullable(a.coverage_pct, b.coverage_pct)
          || String(a.college_name).localeCompare(String(b.college_name))
      }
      if (sort === 'confidence') {
        return compareNullable(a.confidence_min, b.confidence_min)
          || String(a.college_name).localeCompare(String(b.college_name))
      }
      return String(a.college_name).localeCompare(String(b.college_name))
    })
  }, [asDegrees.data, query, filter, sort])

  if (asDegrees.isLoading) return <Spinner />
  if (asDegrees.isError) return <Alert type='error'>Could not load associate degrees.</Alert>

  return (
    <Stack gap='cozy'>
      <Tabs value={degreeType} onChange={onDegreeTypeChange} options={TYPE_OPTIONS} />
      <div className='flex flex-wrap items-center gap-3'>
        <Input value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder='Search colleges or degree titles…' aria-label='Search associate degrees' />
        <div className='w-60'>
          <Select value={filter} onChange={setFilter} options={FILTER_OPTIONS} aria-label='Filter quality state' />
        </div>
        <div className='w-56'>
          <Select value={sort} onChange={setSort} options={SORT_OPTIONS} aria-label='Sort degree records' />
        </div>
        <span className='text-caption text-ink-subtle'>
          {rows.length} of {asDegrees.data?.n ?? asDegrees.data?.rows?.length ?? 0}
        </span>
      </div>
      <DataTable
        rows={rows}
        columns={[
          { key: 'college_name', label: 'College' },
          { key: 'degree_type', label: 'Type',
            render: (row) => <Badge variant={row.degree_type === 'ast' ? 'success' : 'neutral'}>
              {DEGREE_TYPE_LABEL[row.degree_type] || row.degree_type}
            </Badge> },
          { key: 'degree_title_seen', label: 'Degree as printed' },
          { key: 'status', label: 'Status',
            render: (row) => <Badge variant={STATUS_VARIANT[row.status] || 'neutral'}>{row.status}</Badge> },
          { key: 'coverage_pct', label: 'Core coverage', render: (row) => coveragePct(row.coverage_pct) },
          { key: 'units', label: 'Units',
            render: (row) => row.status === 'found'
              ? `${row.units_accounted} / ${row.total_units} ${row.unit_system === 'quarter' ? 'qtr' : 'sem'}`
              : '—' },
          { key: 'confidence_min', label: 'Min conf.', render: (row) => confidencePct(row.confidence_min) },
          { key: 'flags', label: 'Flags',
            render: (row) => row.flags.length
              ? <span className='flex flex-wrap gap-1'>{row.flags.map((flag) => (
                <Badge key={flag} variant='conservative'>{flag}</Badge>
              ))}</span>
              : <span className='text-ink-subtle'>clean</span> },
          { key: 'open', label: '',
            render: (row) => <Button variant='ghost' onClick={() => onOpen?.(row)}>Inspect</Button> },
        ]}
      />
    </Stack>
  )
}
