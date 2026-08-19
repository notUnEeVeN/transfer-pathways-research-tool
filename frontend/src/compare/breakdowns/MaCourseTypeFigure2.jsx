import React from 'react'
import { Badge } from '../../components/ui'
import {
  FAITHFUL_COMPARISON_ROLES,
  MA_FIGURE2_ARCHIVE_DIRECT,
  MA_FIGURE2_FINAL_PDF,
} from '../../analyses/CourseTypeCoverage'

const mean = (values) => (
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
)

const pct = (value) => (Number.isFinite(value)
  ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
  : '—')

const list = (values) => (values.length ? `[${values.join(', ')}]` : 'none')

function multisetRemainder(source, consumedBy) {
  const remaining = new Map()
  for (const value of consumedBy) remaining.set(value, (remaining.get(value) || 0) + 1)
  const result = []
  for (const value of source) {
    const count = remaining.get(value) || 0
    if (count > 0) remaining.set(value, count - 1)
    else result.push(value)
  }
  return result
}

/**
 * Reconcile the two anonymous Figure 2 distributions without inventing a
 * university identity. Equal values cancel only within the same semantic
 * course-type role; observation indices are never joined.
 */
export function reconcileMaFigure2Distributions(
  pdfArtifact = MA_FIGURE2_FINAL_PDF,
  directArtifact = MA_FIGURE2_ARCHIVE_DIRECT,
) {
  const directByKey = new Map(directArtifact.columns.map((column) => [column.key, column]))
  const groups = pdfArtifact.columns.map((pdfColumn, index) => {
    const directColumn = directByKey.get(pdfColumn.key) || { points_pct: [] }
    const pdfValues = [...pdfColumn.points_pct].sort((a, b) => a - b)
    const directValues = [...directColumn.points_pct].sort((a, b) => a - b)
    const pdfOnly = multisetRemainder(pdfValues, directValues)
    const directOnly = multisetRemainder(directValues, pdfValues)
    const matched = pdfValues.length - pdfOnly.length
    const role = FAITHFUL_COMPARISON_ROLES[index] || {
      key: pdfColumn.key,
      label: pdfColumn.label,
    }
    return {
      key: role.key,
      roleLabel: role.label,
      categoryLabel: pdfColumn.label,
      pdfValues,
      directValues,
      pdfOnly,
      directOnly,
      matched,
      pdfMean: mean(pdfValues),
      directMean: mean(directValues),
    }
  })
  return {
    groups,
    matched: groups.reduce((sum, group) => sum + group.matched, 0),
    observations: groups.reduce((sum, group) => sum + group.pdfValues.length, 0),
  }
}

export default function MaCourseTypeFigure2() {
  const audit = reconcileMaFigure2Distributions()
  const disagreements = audit.observations - audit.matched

  return (
    <div className='surface-card p-4 flex flex-col gap-4' data-export-exclude>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='text-label'>Figure 2 source reconciliation</p>
        <Badge variant='conservative'>
          {audit.matched} of {audit.observations} observations reproduce
        </Badge>
      </div>

      <p className='text-caption text-ink-muted max-w-[88ch]'>
        This is a multiset comparison within each semantic course-type role. The final PDF does
        not label its dots by university, so no observation index or campus identity is joined.
        A match means the same whole-percentage value occurs the same number of times in that
        category.
      </p>

      <div className='grid grid-cols-1 gap-3 xl:grid-cols-2'>
        {audit.groups.map((group) => (
          <section key={group.key} className='rounded-lg border border-border p-3'>
            <div className='flex flex-wrap items-baseline gap-2'>
              <h4 className='text-body-strong text-ink'>{group.categoryLabel}</h4>
              <span className='text-tag text-ink-subtle'>{group.roleLabel}</span>
              <span className='ml-auto text-tag tabular-nums text-ink-subtle'>
                {group.matched}/{group.pdfValues.length} match
              </span>
            </div>
            <p className='mt-2 text-caption text-ink-muted tabular-nums'>
              Deposited-data rerun {list(group.directValues)} · mean {pct(group.directMean)}
            </p>
            <p className='mt-1 text-caption text-ink-muted tabular-nums'>
              Final PDF {list(group.pdfValues)} · mean {pct(group.pdfMean)}
            </p>
            <p className='mt-2 text-tag text-ink-subtle tabular-nums'>
              Rerun-only {list(group.directOnly)} · PDF-only {list(group.pdfOnly)}
            </p>
          </section>
        ))}
      </div>

      <p className='text-caption text-ink-muted max-w-[88ch]'>
        {disagreements} of {audit.observations} raw observations do not reproduce at printed
        precision. Computing and Math still round to the paper&rsquo;s 22% and 60% headlines;
        Science reproduces exactly. Non-STEM is the substantive mean disagreement: the deposited
        rerun is 69.4%, while the final PDF is 76.2%. Because the dots are anonymous, the changed
        final campus cannot be identified without the authors&rsquo; final category matrix.
      </p>
    </div>
  )
}
