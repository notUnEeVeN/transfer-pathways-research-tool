import React, { useEffect, useState } from 'react'
import { Stack, Tabs } from '../components/ui'
import ConceptGraphView from './ConceptGraphView'
import ConceptsTable from './ConceptsTable'
import ConceptMappingTable from './ConceptMappingTable'
import MajorPicker from '../shared/majors/MajorPicker'
import { useMajorChoice } from '../shared/majors/MajorContext'

// Data → Prerequisites: the concept graph plus its two editors.
export default function PrerequisitesTab({ onRoute = null }) {
  const [view, setView] = useState('graph')
  const { slug: majorSlug, setSlug } = useMajorChoice('prerequisites')

  useEffect(() => {
    onRoute?.({ path: `/api/curated/prerequisite-graph?majorSlug=${majorSlug}` })
  }, [majorSlug, onRoute])

  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <Tabs value={view} onChange={setView} options={[
          { value: 'graph', label: 'Graph' },
          { value: 'concepts', label: 'Concepts' },
          { value: 'mapping', label: 'Mapping' },
        ]} />
        <MajorPicker value={majorSlug} onChange={setSlug} capability='prerequisites'
          className='ml-auto w-60 max-w-full' />
      </div>
      {view === 'graph' && <ConceptGraphView majorSlug={majorSlug} />}
      {view === 'concepts' && <ConceptsTable />}
      {view === 'mapping' && <ConceptMappingTable majorSlug={majorSlug} />}
    </Stack>
  )
}
