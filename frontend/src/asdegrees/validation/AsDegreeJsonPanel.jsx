import React from 'react'
import JsonDocumentPanel from '../../shared/JsonDocumentPanel'
import { buildAsDegreeContext } from './asDegreeContext'

/**
 * The stored associate-degree document, open for editing through the shared
 * JSON document panel with an AS-degree-specific AI briefing.
 */
export default function AsDegreeJsonPanel({
  doc, courses = [], onChange, mode = 'edit', collegeName = null,
}) {
  return (
    <JsonDocumentPanel
      doc={doc}
      onChange={onChange}
      ariaLabel='Degree document JSON'
      redrawNote='The degree above redraws as you type.'
      buildBriefing={() => buildAsDegreeContext({ doc, courses, mode, collegeName })}
    />
  )
}
