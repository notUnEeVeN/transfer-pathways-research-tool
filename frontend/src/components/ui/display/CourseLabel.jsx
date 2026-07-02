import React from 'react'

/**
 * Canonical course-identity typography: a bold "PREFIX NUMBER" followed by the
 * muted " · title". Renders inline content only — the caller owns the wrapping
 * element and its truncation/width, since course rows live in many layouts
 * (picker buttons, recap lines, modal rows). Use anywhere a course is named so
 * the bold/muted split and the separator stay identical everywhere.
 */
export default function CourseLabel({ course }) {
  return (
    <>
      <span className='text-body-strong'>
        {course.prefix} {course.number}
      </span>
      <span className='text-ink-subtle'> · {course.title}</span>
    </>
  )
}
