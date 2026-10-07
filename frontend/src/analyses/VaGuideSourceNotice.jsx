import React from 'react'

export default function VaGuideSourceNotice({ rows, estimatedCourses = false }) {
  const estimated = rows.filter((row) => row.method_status === 'estimated' || row.va_source_warnings?.length)
  return (
    <p className='text-caption text-ink-muted'>
      Transfer-guide model; course supply is a catalog or schedule snapshot.
      {estimated.length > 0 && <> {estimated.length} of {rows.length} cells depend on unresolved guide conditions or credit interpretations; they remain estimates. Hover a cell for its source warning.</>}
      {estimatedCourses && <> Course counts are inferred from credit blocks and rounded to integers; they are not an enumerated count of actual classes.</>}
    </p>
  )
}
