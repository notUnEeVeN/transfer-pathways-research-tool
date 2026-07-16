import React, { useState } from 'react'
import { Stack, Tabs } from '../components/ui'
import ConceptGraphView from './ConceptGraphView'
import ConceptsTable from './ConceptsTable'
import ConceptMappingTable from './ConceptMappingTable'

// Data → Prerequisites: the concept graph plus its two editors.
export default function PrerequisitesTab() {
  const [view, setView] = useState('graph')
  return (
    <Stack gap='cozy'>
      <Tabs value={view} onChange={setView} options={[
        { value: 'graph', label: 'Graph' },
        { value: 'concepts', label: 'Concepts' },
        { value: 'mapping', label: 'Mapping' },
      ]} />
      {view === 'graph' && <ConceptGraphView />}
      {view === 'concepts' && <ConceptsTable />}
      {view === 'mapping' && <ConceptMappingTable />}
    </Stack>
  )
}
