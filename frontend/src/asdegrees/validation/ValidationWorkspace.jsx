import React, { useState } from 'react'
import { AcademicCapIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { Button, Panel } from '../../components/ui'
import AsDegreeEditor from './AsDegreeEditor'
import ValidationDashboard from './ValidationDashboard'

/** Small mount adapter that keeps all validation state out of DataPage. */
export default function ValidationWorkspace({ initialCollegeId = null }) {
  const [open, setOpen] = useState(false)
  const [editorCollegeId, setEditorCollegeId] = useState(null)

  return (
    <div className='mt-6'>
      {!open ? (
        <Panel
          title='Deep validation workspace'
          icon={AcademicCapIcon}
          action={(
            <Button variant='secondary' onClick={() => setOpen(true)}>
              Open workspace
            </Button>
          )}
        >
          <p className='text-body text-ink-muted'>
            Select a college cohort, correct canonical degree requirements, and verify the records
            used by the pathway visualizations.
          </p>
        </Panel>
      ) : (
        <div>
          <div className='mb-5 flex flex-wrap justify-end gap-2'>
            {initialCollegeId != null && (
              <Button
                variant='secondary'
                leadingIcon={PencilSquareIcon}
                onClick={() => setEditorCollegeId(Number(initialCollegeId))}
              >
                Edit this college
              </Button>
            )}
            <Button variant='ghost' onClick={() => setOpen(false)}>Close workspace</Button>
          </div>
          <ValidationDashboard onOpenEditor={setEditorCollegeId} />
        </div>
      )}

      {editorCollegeId != null && (
        <AsDegreeEditor
          collegeId={editorCollegeId}
          onClose={() => setEditorCollegeId(null)}
        />
      )}
    </div>
  )
}
