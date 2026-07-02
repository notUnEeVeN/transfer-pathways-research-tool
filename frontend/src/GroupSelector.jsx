import { useState, useEffect, useContext } from 'react'
import { PencilSquareIcon } from '@heroicons/react/24/outline'
import { Select, Button } from './components/ui'
import { useAuditGroupings } from '@frontend/query/hooks/useAudit'
import { AssistSuppressContext } from './assistSuppress'
import GroupingsManager from './pages/Audit/components/groupings/GroupingsManager'

/**
 * Desktop group scope picker. Sets `filter.groupingId` on the Shell's shared
 * audit filter, which rescopes every read across Audit / Review / Stats (the
 * hooks already key off `filter`). "All majors" → `groupingId: null`.
 *
 * Mirrors the website's selector (Audit.jsx FilterBar): a `<Select>` of saved
 * groupings plus a "Manage…" button opening the shared `GroupingsManager`
 * Modal — create / rename / delete. On create, the new group is auto-applied;
 * deleting the active group clears the selection.
 */
export default function GroupSelector({ filter, setFilter, className = '' }) {
  const [open, setOpen] = useState(false)
  const groupingsQ = useAuditGroupings()
  const groupings = groupingsQ.data || []

  // The native ASSIST pane renders above all HTML, so hide it while the Manage
  // modal is open (so it doesn't cover it). The Shell re-asserts the pane when
  // suppression clears. No-op outside the Shell / where the pane is already hidden.
  const suppressAssist = useContext(AssistSuppressContext)
  useEffect(() => {
    suppressAssist?.(open)
    return () => suppressAssist?.(false)
  }, [open, suppressAssist])

  const apply = (id) => setFilter({ ...filter, groupingId: id })
  const clear = () => setFilter({ ...filter, groupingId: null })

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select
        value={filter.groupingId || ''}
        onChange={(v) => (v ? apply(v) : clear())}
        options={[
          { value: '', label: 'All majors' },
          ...groupings.map((g) => ({ value: g._id, label: `${g.name} (${g.member_count})` }))
        ]}
        className='w-56'
      />
      <Button variant='secondary' size='sm' leadingIcon={PencilSquareIcon} onClick={() => setOpen(true)}>
        Manage…
      </Button>
      <GroupingsManager
        open={open}
        onClose={() => setOpen(false)}
        groupings={groupings}
        activeGroupingId={filter.groupingId || null}
        onApply={(id) => { apply(id); setOpen(false) }}
        onCleared={clear}
      />
    </div>
  )
}
