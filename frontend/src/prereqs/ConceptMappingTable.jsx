import React, { useMemo, useState } from 'react'
import { Alert, Badge, Button, Combobox, Input, Modal, Select, Spinner, Stack, Switch } from '../components/ui'
import { useColleges, usePrereqGraph, useSaveCourseConcept } from '../shared/query/hooks/useData'
import { DataTable } from '../DataReferences'

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)

// Data → Prerequisites → Mapping: which concept each in-scope course carries.
// Rows come from the graph endpoint (it knows the in-scope set); edits go
// through PUT /assist/courses/:id/concept.
export default function ConceptMappingTable({ initialCollegeId = null }) {
  const colleges = useColleges()
  const [collegeId, setCollegeId] = useState(initialCollegeId)
  const graph = usePrereqGraph(collegeId)
  const save = useSaveCourseConcept()
  const [query, setQuery] = useState('')
  const [unmappedOnly, setUnmappedOnly] = useState(false)
  const [editing, setEditing] = useState(null) // { key, label, concept, note }
  const [saveError, setSaveError] = useState(null)

  const collegeOptions = useMemo(
    () => (colleges.data || []).map((c) => ({ value: c.source_id, label: c.name })),
    [colleges.data]
  )
  const conceptOptions = useMemo(() => [
    { value: '', label: 'None (not a pathway concept)' },
    ...(graph.data?.concepts || []).map((c) => ({ value: c.slug, label: `${c.name} (${c.slug})` })),
  ], [graph.data])

  const rows = useMemo(() => {
    const all = graph.data?.courses || []
    const needle = query.trim().toLowerCase()
    return all.filter((r) => {
      if (unmappedOnly && r.concept) return false
      if (!needle) return true
      return `${r.prefix} ${r.number} ${r.title} ${r.concept || ''}`.toLowerCase().includes(needle)
    })
  }, [graph.data, query, unmappedOnly])

  const commit = async () => {
    setSaveError(null)
    try {
      await save.mutateAsync({ id: editing.key, concept: editing.concept || null, note: editing.note })
      setEditing(null)
    } catch (err) {
      setSaveError(err?.response?.data?.error || 'Failed to save.')
    }
  }

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <div className='w-72'>
          <Combobox value={collegeId} onChange={setCollegeId} options={collegeOptions}
            placeholder='Pick a community college…' />
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder='Find course…'
          aria-label='Find course'
          className='bg-canvas border border-border rounded-pill px-3 py-[7px] text-[13px] text-ink placeholder:text-ink-subtle outline-none' />
        <label className='ml-auto inline-flex items-center gap-2 text-caption text-ink-muted'>
          <Switch checked={unmappedOnly} onChange={() => setUnmappedOnly((s) => !s)} /> unmapped only
        </label>
      </div>

      {collegeId == null && <Alert type='info'>Pick a college to review its in-scope courses.</Alert>}
      {collegeId != null && graph.isLoading && (
        <div className='surface-card p-10 flex justify-center'><Spinner /></div>
      )}
      {collegeId != null && graph.isError && <Alert type='error'>Failed to load the mapping.</Alert>}
      {collegeId != null && graph.data && (
        <DataTable
          rows={rows}
          onEdit={(r) => {
            setSaveError(null)
            setEditing({
              key: r.key, label: `${r.prefix} ${r.number} — ${r.title}`,
              concept: r.concept || '', note: '',
            })
          }}
          columns={[
            {
              key: 'code', label: 'Course', cellClassName: 'text-ink',
              render: (r) => <span>{r.prefix} {r.number}</span>,
            },
            { key: 'title', label: 'Title' },
            { key: 'units', label: 'Units', render: (r) => r.units ?? '-' },
            {
              key: 'concept', label: 'Concept',
              render: (r) => r.concept
                ? <span className='chip font-mono'>{r.concept}</span>
                : r.concept_source
                  ? <span className='text-ink-subtle'>none (examined)</span>
                  : <Badge variant='neutral'>Not examined</Badge>,
            },
            { key: 'concept_confidence', label: 'Confidence', render: (r) => pct(r.concept_confidence) },
            { key: 'concept_source', label: 'Source', render: (r) => r.concept_source ?? '-' },
            {
              key: 'in_scope', label: 'In scope',
              render: (r) => (r.in_scope ? 'yes' : <span className='text-ink-subtle'>manual</span>),
            },
          ]} />
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.label || ''}>
        {editing && (
          <Stack gap='cozy'>
            {saveError && <Alert type='error'>{saveError}</Alert>}
            <div>
              <p className='field-label'>Concept</p>
              <Select value={editing.concept} options={conceptOptions}
                onChange={(v) => setEditing({ ...editing, concept: v })} />
            </div>
            <div>
              <p className='field-label'>Note</p>
              <Input value={editing.note} placeholder='optional'
                onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
            </div>
            <div className='flex justify-end gap-2'>
              <Button variant='ghost' onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={commit} disabled={save.isPending}>Save</Button>
            </div>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
