import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { Button } from '../../../components/ui'
import { schoolNameOf, openAssist } from '../lib/auditFormat'

// Header card for an agreement doc preview: major, school · CC (+ optional
// sub-caption), and the ASSIST.org deep-link button. `showAssist` defaults to
// true (website behavior); the desktop tool passes false because it docks a
// native ASSIST pane instead.
export default function DocHead({ doc, assistUrl, sub, showAssist = true }) {
  return (
    <div className='surface-card px-[22px] py-5 flex items-start gap-3.5'>
      <div className='min-w-0'>
        <h2 className='text-[22px] font-[650] tracking-[-.012em] break-words'>{doc.major}</h2>
        <div className='mt-1 flex items-center gap-2 text-[13.5px] text-ink-muted flex-wrap'>
          <span className='font-semibold text-ink'>{schoolNameOf(doc)}</span>
          <span className='text-border-strong'>·</span>
          <span className='italic'>
            {doc.community_college}
            {sub ? ` · ${sub}` : ''}
          </span>
        </div>
      </div>
      {showAssist && (
        <Button
          variant='secondary'
          size='sm'
          trailingIcon={ArrowTopRightOnSquareIcon}
          onClick={() => openAssist(assistUrl)}
          disabled={!assistUrl}
          className='ml-auto shrink-0'
        >
          ASSIST.org
        </Button>
      )}
    </div>
  )
}
