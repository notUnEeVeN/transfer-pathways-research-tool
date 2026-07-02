import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Button from '../buttons/Button'
import MoveToPopover from '../overlays/MoveToPopover'

// Floating bar shown while rows are selected: move-to, (optional) delete, cancel.
// Used by the Roadmap timeline (move + delete) and the Still-need pool (send to a
// term — `moveLabel` relabels the action and `onDelete` is omitted to hide Delete).
export default function BulkActionBar({
  count,
  moveToOpen,
  setMoveToOpen,
  destinations,
  onMove,
  onDelete,
  onCancel,
  moveLabel = 'Move to…'
}) {
  return (
    <div
      role='region'
      aria-label='Bulk actions'
      className='fixed bottom-6 left-1/2 -translate-x-1/2 z-70 surface-elevated flex items-center gap-2 pl-4 pr-2 h-11'
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <span className='text-body-strong shrink-0' role='status' aria-live='polite'>
        <span className='font-mono text-ink'>{count}</span>
        <span className='text-ink-subtle'> selected</span>
      </span>
      <span className='w-px h-5 bg-border mx-1 shrink-0' />
      <div className='relative'>
        <Button variant='secondary' size='sm' leadingIcon={ArrowRightIcon} onClick={() => setMoveToOpen((v) => !v)}>
          {moveLabel}
        </Button>
        <MoveToPopover
          open={moveToOpen}
          onClose={() => setMoveToOpen(false)}
          destinations={destinations}
          onSelect={onMove}
        />
      </div>
      {onDelete && (
        <Button variant='danger' size='sm' leadingIcon={XMarkIcon} onClick={onDelete}>
          Delete
        </Button>
      )}
      <Button variant='ghost' size='sm' onClick={onCancel}>
        Cancel
      </Button>
    </div>
  )
}
