import React from 'react'
import { Input, Select } from '../../components/ui'

/**
 * The five scalars the server demands on a `found` row.
 *
 * They live in a form rather than in the JSON box because a typo in one of
 * them is the most common reason a save bounces, and because they are the part
 * a person reads straight off the catalog page. The requirement groups stay in
 * the document below — a form cannot state a four-level choice rule honestly.
 */
export default function AsDegreeHeaderFields({ doc, onChange }) {
  const set = (patch) => onChange({ ...doc, ...patch })

  return (
    <div className='surface-card grid gap-4 p-4 sm:grid-cols-2'>
      <div className='sm:col-span-2'>
        <label className='field-label' htmlFor='as-title'>Degree title as printed</label>
        <Input id='as-title' value={doc.degree_title_seen || ''}
          placeholder='Computer Science A.S.-T'
          onChange={(e) => set({ degree_title_seen: e.target.value })} />
      </div>
      <div className='sm:col-span-2'>
        <label className='field-label' htmlFor='as-url'>Catalog URL</label>
        <Input id='as-url' value={doc.catalog_url || ''}
          placeholder='https://catalog.example.edu/…'
          onChange={(e) => set({ catalog_url: e.target.value })} />
      </div>
      <div>
        <label className='field-label' htmlFor='as-year'>Catalog year</label>
        <Input id='as-year' value={doc.catalog_year || ''} placeholder='2025-26'
          onChange={(e) => set({ catalog_year: e.target.value })} />
      </div>
      <div>
        <label className='field-label' htmlFor='as-units'>Total units</label>
        <Input id='as-units' type='number' value={doc.total_units ?? ''} placeholder='60'
          onChange={(e) => set({
            total_units: e.target.value === '' ? null : Number(e.target.value),
          })} />
      </div>
      <div>
        <span className='field-label'>Unit system</span>
        <Select value={doc.unit_system || 'semester'}
          onChange={(unit_system) => set({ unit_system })}
          aria-label='Unit system'
          options={[
            { value: 'semester', label: 'Semester' },
            { value: 'quarter', label: 'Quarter' },
          ]} />
      </div>
    </div>
  )
}
