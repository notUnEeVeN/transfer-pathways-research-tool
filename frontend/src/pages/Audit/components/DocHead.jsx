import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { Button } from '../../../components/ui'
import { schoolNameOf, openAssist } from '../lib/auditFormat'

// Header for an agreement doc preview: major, school, CC + sub-caption, and the
// ASSIST.org deep-link button. `showAssist` defaults to true (website behavior);
// the desktop tool passes false because it docks a native ASSIST pane instead.
export default function DocHead({ doc, assistUrl, sub, showAssist = true }) {
  return (
    <div className='flex items-start justify-between gap-4 pb-5 hairline-b'>
      <div className='min-w-0'>
        <h2 className='text-heading-lg break-words'>{doc.major}</h2>
        <p className='text-caption mt-0.5'>{schoolNameOf(doc)}</p>
        <p className='text-caption text-ink-subtle italic'>
          {doc.community_college}
          {sub ? ` · ${sub}` : ''}
        </p>
      </div>
      {showAssist && (
        <Button
          variant='secondary'
          size='sm'
          trailingIcon={ArrowTopRightOnSquareIcon}
          onClick={() => openAssist(assistUrl)}
          disabled={!assistUrl}
        >
          ASSIST.org
        </Button>
      )}
    </div>
  )
}
