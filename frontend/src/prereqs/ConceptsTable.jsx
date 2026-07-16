import React, { useMemo, useState } from 'react'
import { PlusIcon } from '@heroicons/react/24/outline'
import { Alert, Button, EmptyState, Spinner, Stack } from '../components/ui'
import { useRefTable } from '../shared/query/hooks/useData'
import { DataTable, useRowEditing } from '../DataReferences'
import RefRowModal from '../references/RefRowModal'

// Data → Prerequisites → Concepts: the editable canonical vocabulary + rules.
export default function ConceptsTable() {
  const q = useRefTable('prereq_concepts')
  const ed = useRowEditing('prereq_concepts')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const all = (q.data?.rows || []).slice()
      .sort((a, b) => String(a.discipline).localeCompare(String(b.discipline))
        || String(a.slug).localeCompare(String(b.slug)))
    const needle = query.trim().toLowerCase()
    if (!needle) return all
    return all.filter((r) => ed.config.searchText(r).toLowerCase().includes(needle))
  }, [q.data, query, ed.config])

  if (q.isLoading) return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  if (q.isError) return <Alert type='error'>Failed to load the concept table.</Alert>

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Find concept…'
          className='bg-canvas border border-border rounded-pill px-3 py-[7px] text-[13px] text-ink placeholder:text-ink-subtle outline-none' />
        <Button className='ml-auto' leadingIcon={PlusIcon} onClick={() => ed.openAdd()}>Add concept</Button>
      </div>
      {!rows.length ? (
        <EmptyState title='No concepts yet'
          description='Add concepts here or run scripts/import_course_concepts.py after the classification session.' />
      ) : (
        <DataTable
          rows={rows}
          onEdit={ed.openEdit} onDelete={ed.remove} deleting={ed.deleting}
          columns={[
            { key: 'slug', label: 'Slug', render: (r) => <span className='font-mono'>{r.slug}</span> },
            { key: 'name', label: 'Name', cellClassName: 'text-ink' },
            { key: 'discipline', label: 'Discipline' },
            {
              key: 'requires', label: 'Requires',
              render: (r) => (r.requires || []).length
                ? <span className='inline-flex flex-wrap gap-1.5'>
                    {(r.requires || []).map((s) => <span key={s} className='chip font-mono'>{s}</span>)}
                  </span>
                : '-',
            },
            { key: 'note', label: 'Note' },
          ]} />
      )}
      <RefRowModal config={ed.config} editing={ed.editing} onClose={ed.close} />
    </Stack>
  )
}
