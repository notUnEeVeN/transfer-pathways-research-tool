import { ArrowUturnLeftIcon, XMarkIcon } from '@heroicons/react/24/outline'
import Button from '../buttons/Button'

// Floating "Removed N · Undo" toast. Used by the Roadmap timeline; pairs with
// the useUndoToast hook.
export default function UndoToast({ message, onUndo, onDismiss }) {
  return (
    <div
      role='status'
      aria-live='polite'
      className='fixed bottom-6 left-1/2 -translate-x-1/2 z-70 surface-elevated flex items-center gap-2 pl-4 pr-2 h-11'
      style={{ boxShadow: 'var(--shadow-lg)' }}
    >
      <span className='text-body'>{message}</span>
      <Button variant='secondary' size='sm' leadingIcon={ArrowUturnLeftIcon} onClick={onUndo}>
        Undo
      </Button>
      <button
        type='button'
        onClick={onDismiss}
        aria-label='Dismiss'
        className='grid place-items-center w-7 h-7 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-hover transition-colors'
      >
        <XMarkIcon className='w-4 h-4' />
      </button>
    </div>
  )
}
