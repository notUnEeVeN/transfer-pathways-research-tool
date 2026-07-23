import React from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { Combobox } from '../../components/ui'
import { courseByIdKey, courseLabel, groupCourseIds } from './asDegreeCourses'

/**
 * One requirement group's courses, opened in place under its heading: remove a
 * course, or look one up and add it.
 *
 * Anything a flat list cannot state honestly — a real choose-N, an "A and B"
 * pairing — never reaches here (DegreePanel decides what is editable) and goes
 * to the assistant instead.
 */
export default function GroupCourseEditor({ group, coursesById, courseOptions, onChange }) {
  const ids = groupCourseIds(group)
  return (
    <div className='mt-2 surface-card px-4 py-3'>
      <div className='flex flex-col gap-1'>
        {ids.map((id) => (
          <div key={id} className='flex items-center gap-2'>
            <span className='text-body flex-1 min-w-0 truncate'>
              {courseLabel(coursesById?.[courseByIdKey(id)]) || `Course ${id}`}
            </span>
            <button type='button' aria-label={`Remove course ${id}`}
              onClick={() => onChange(ids.filter((x) => x !== id))}
              className='shrink-0 rounded-pill p-1 text-ink-subtle hover:bg-danger-soft hover:text-danger'>
              <XMarkIcon className='w-4 h-4' aria-hidden='true' />
            </button>
          </div>
        ))}
        {!ids.length && <p className='text-caption text-ink-subtle'>No courses in this group.</p>}
      </div>
      <Combobox value='' options={courseOptions} placeholder='Add a course…'
        className='mt-2'
        onChange={(value) => value && onChange([...ids, Number(value)])} />
    </div>
  )
}
