import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Button, Input, Select, Spinner, Stack, StatStrip, Tabs } from '../components/ui'
import { DataTable } from '../DataReferences'
import { useAsDegreeAvailability } from '../shared/query/hooks/useData'
import AsDegreeQaTable from './AsDegreeQaTable'
import AsDegreeSchoolView from './AsDegreeSchoolView'
import { DEGREE_TYPE_LABEL } from '../shared/lib/asDegreeTypes'

const AVAILABILITY_LABEL = {
  available: 'Available',
  confirmed_none: 'Confirmed none',
  data_gap: 'Data gap',
  duplicate_candidate: 'Duplicate candidate',
}

const AVAILABILITY_VARIANT = {
  available: 'success',
  confirmed_none: 'neutral',
  data_gap: 'conservative',
  duplicate_candidate: 'conservative',
}

const COVERAGE_FILTERS = [
  { value: 'all', label: 'All colleges' },
  { value: 'ast_available', label: 'CS A.S.-T available' },
  { value: 'ast_none', label: 'Confirmed no CS A.S.-T' },
  { value: 'ast_gap', label: 'CS A.S.-T data gaps' },
  { value: 'multiple', label: 'Multiple stored types' },
]

const COVERAGE_SORTS = [
  { value: 'ast_status', label: 'Sort: CS A.S.-T status' },
  { value: 'college', label: 'Sort: college' },
  { value: 'local_status', label: 'Sort: local CS A.S. status' },
]

const STATUS_ORDER = { data_gap: 0, confirmed_none: 1, duplicate_candidate: 2, available: 3 }

function TypeAvailability({ value, type, row, onOpen }) {
  const titleCount = value.inventory_titles?.length || 0
  return (
    <div className='flex flex-col items-start gap-1'>
      <Badge variant={AVAILABILITY_VARIANT[value.status] || 'neutral'}>
        {AVAILABILITY_LABEL[value.status] || value.status}
      </Badge>
      {value.degree_title_seen && (
        <span className='max-w-[240px] text-[11.5px] text-ink-subtle'>{value.degree_title_seen}</span>
      )}
      {type === 'local_other' && titleCount > 0 && (
        <span className='text-[11.5px] text-ink-subtle'>{titleCount} catalog program{titleCount === 1 ? '' : 's'}</span>
      )}
      {value.record_id && (
        <Button variant='ghost' onClick={() => onOpen({
          college_id: row.college_id,
          community_college_id: row.community_college_id,
          college_name: row.college_name,
          degree_type: type,
        })}>Inspect</Button>
      )}
    </div>
  )
}

function CoverageTable({ data, onOpen }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('ast_status')
  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return (data?.rows || []).filter((row) => {
      if (needle && !`${row.college_name} ${row.district || ''} ${row.region || ''}`.toLowerCase().includes(needle)) {
        return false
      }
      if (filter === 'ast_available') return row.types.ast.status === 'available'
      if (filter === 'ast_none') return row.types.ast.status === 'confirmed_none'
      if (filter === 'ast_gap') return row.types.ast.status === 'data_gap'
      if (filter === 'multiple') {
        return Object.values(row.types).filter((value) => value.record_id).length > 1
      }
      return true
    }).slice().sort((a, b) => {
      if (sort === 'ast_status') {
        return (STATUS_ORDER[a.types.ast.status] ?? 99) - (STATUS_ORDER[b.types.ast.status] ?? 99)
          || a.college_name.localeCompare(b.college_name)
      }
      if (sort === 'local_status') {
        return (STATUS_ORDER[a.types.local_as.status] ?? 99) - (STATUS_ORDER[b.types.local_as.status] ?? 99)
          || a.college_name.localeCompare(b.college_name)
      }
      return a.college_name.localeCompare(b.college_name)
    })
  }, [data, filter, query, sort])

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <Input value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder='Search colleges, districts, regions…' aria-label='Search degree availability' />
        <div className='w-60'>
          <Select value={filter} onChange={setFilter} options={COVERAGE_FILTERS} aria-label='Filter degree availability' />
        </div>
        <div className='w-56'>
          <Select value={sort} onChange={setSort} options={COVERAGE_SORTS} aria-label='Sort degree availability' />
        </div>
        <span className='text-caption text-ink-subtle'>{rows.length} of {data?.rows?.length || 0} colleges</span>
      </div>
      <DataTable rows={rows} columns={[
        { key: 'college_name', label: 'College' },
        { key: 'ast', label: 'CS A.S.-T',
          render: (row) => <TypeAvailability value={row.types.ast} type='ast' row={row} onOpen={onOpen} /> },
        { key: 'local_as', label: 'Local CS A.S.',
          render: (row) => <TypeAvailability value={row.types.local_as} type='local_as' row={row} onOpen={onOpen} /> },
        { key: 'local_other', label: 'Other computing',
          render: (row) => <TypeAvailability value={row.types.local_other} type='local_other' row={row} onOpen={onOpen} /> },
        { key: 'source', label: 'Inventory source',
          render: (row) => row.inventory_source_url
            ? <a className='underline' href={row.inventory_source_url} target='_blank' rel='noreferrer'>catalog evidence</a>
            : '—' },
      ]} />
    </Stack>
  )
}

export default function AsDegreesTab({ onRoute = () => {} }) {
  const availability = useAsDegreeAvailability()
  const [view, setView] = useState('coverage')
  const [degreeType, setDegreeType] = useState('ast')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (selected) {
      onRoute({ path: `/api/curated/as-degrees?college_id=cc:${selected.community_college_id}` })
    } else if (view === 'coverage') {
      onRoute({ path: '/api/curated/as-degree-availability' })
    } else {
      const query = degreeType === 'all' ? '' : `?degree_type=${degreeType}`
      onRoute({ path: `/api/curated/as-degrees${query}` })
    }
  }, [degreeType, onRoute, selected, view])

  if (selected) {
    return (
      <Stack gap='cozy'>
        <div className='flex flex-wrap items-center gap-3'>
          <Button variant='ghost' onClick={() => setSelected(null)}>← Back to associate degrees</Button>
          <span className='text-caption text-ink-subtle'>{selected.college_name}</span>
          <Badge variant={selected.degree_type === 'ast' ? 'success' : 'neutral'}>
            {DEGREE_TYPE_LABEL[selected.degree_type] || selected.degree_type}
          </Badge>
        </div>
        <AsDegreeSchoolView collegeId={selected.community_college_id}
          initialDegreeType={selected.degree_type} />
      </Stack>
    )
  }

  const ast = availability.data?.counts?.ast
  const local = availability.data?.counts?.local_as
  const computing = availability.data?.counts?.local_other
  const tiles = [
    { label: 'Colleges surveyed', value: availability.data?.counts?.total_colleges ?? '—' },
    { label: 'CS A.S.-T analyzable', value: ast?.available ?? '—', sub: '/exports/cs-ast-degrees', accent: true },
    { label: 'CS A.S.-T data gaps', value: ast?.data_gap ?? '—', sub: 'offered, requirements missing',
      tone: ast?.data_gap ? 'danger' : undefined },
    { label: 'Confirmed no CS A.S.-T', value: ast?.confirmed_none ?? '—', sub: 'catalog inventory finding' },
    { label: 'Other stored types', value: local && computing
      ? `${local.available} local · ${computing.available + computing.duplicate_candidate} other`
      : '—', sub: `${computing?.duplicate_candidate ?? 0} duplicate candidates` },
  ]

  return (
    <Stack gap='cozy'>
      <div>
        <h2 className='text-title'>Associate Degrees</h2>
        <p className='text-body text-ink-muted mt-1'>
          CS A.S.-T is the isolated analysis cohort; availability keeps confirmed absences separate from extraction gaps.
        </p>
      </div>
      <StatStrip tiles={tiles} />
      <Tabs value={view} onChange={setView} options={[
        { value: 'coverage', label: 'School coverage' },
        { value: 'records', label: 'Degree records' },
      ]} />
      {view === 'coverage' && availability.isLoading && <Spinner />}
      {view === 'coverage' && availability.isError && <Alert type='error'>Could not load degree availability.</Alert>}
      {view === 'coverage' && availability.data && <CoverageTable data={availability.data} onOpen={setSelected} />}
      {view === 'records' && (
        <AsDegreeQaTable degreeType={degreeType} onDegreeTypeChange={setDegreeType} onOpen={setSelected} />
      )}
    </Stack>
  )
}
