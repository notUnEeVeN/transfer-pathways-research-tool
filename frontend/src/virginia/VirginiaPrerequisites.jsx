import React, { useMemo, useState } from 'react'
import { Alert, Badge, EmptyState, Panel, Spinner, Stack, StatStrip, Tabs } from '../components/ui'
import PrereqGraph from '../prereqs/PrereqGraph'
import { useVaPrerequisiteGraph } from './useVirginia'

const codeOf = (row = {}) => {
  if (row.code) return String(row.code).replace(/\s+/g, '').toUpperCase()
  return `${row.prefix || ''}${row.number || ''}`.replace(/\s+/g, '').toUpperCase()
    || String(row.key || '').replace(/^va:(?:crs:)?/, '')
}

const splitCode = (row) => {
  if (row.prefix || row.number) {
    return { prefix: row.prefix || '', number: row.number || '' }
  }
  const code = codeOf(row)
  const match = /^([A-Z&]+)(.*)$/.exec(code)
  return { prefix: match?.[1] || code, number: match?.[2] || '' }
}

const courseLabel = (row) => {
  if (!row) return 'Unknown course'
  const code = codeOf(row)
  return [code, row.title].filter(Boolean).join(' — ') || String(row.key || 'Unknown course')
}

const normalizedCourses = (rows = []) => rows.map((row) => ({
  ...row,
  key: row.key || `va:${codeOf(row)}`,
  ...splitCode(row),
  title: row.title || codeOf(row),
  units: row.units ?? row.credits ?? null,
}))

const count = (value) => Number(value || 0).toLocaleString()

function LoadingOrError({ query, children }) {
  if (query.isLoading) return <div className='surface-card p-10 flex justify-center'><Spinner /></div>
  if (query.isError || query.error) {
    return <Alert type='error'>Could not load the Virginia prerequisite data.</Alert>
  }
  if (!query.data) return <EmptyState title='No prerequisite data' description='The Virginia prerequisite corpus has not been imported yet.' />
  const corpusUnavailable = query.data.stats?.corpus_available === false
    || query.data.scope?.corpus_imported === false
    || query.data.scope?.coverage === 'unavailable'
  if (corpusUnavailable) {
    const status = query.data.stats?.corpus_status || query.data.scope?.corpus_status
    if (status === 'generation_mismatch') {
      return <EmptyState title='Prerequisite import mismatch'
        description='The Virginia prerequisite mapping and requisite collections come from different import generations. Re-import both artifacts together.' />
    }
    if (status === 'incomplete_import') {
      return <EmptyState title='Prerequisite import incomplete'
        description='Only part of the Virginia prerequisite corpus is present. Import both the mapping and requisite artifacts together.' />
    }
    return <EmptyState title='No prerequisite data'
      description='The Virginia prerequisite corpus has not been imported yet.' />
  }
  return children(query.data)
}

function ScopeNote({ mode, college, university }) {
  if (mode === 'university') {
    return (
      <Alert type='info'>
        <strong>Transfer preparation, not university prerequisites.</strong>{' '}
        This is the published VCCS sequence among courses accepted by {university}. Acceptance
        does not prove that a course applies to the Computer Science degree or that the university
        uses the same prerequisite policy on its own campus.
      </Alert>
    )
  }
  if (mode === 'college') {
    if (/richard bland/i.test(college || '')) {
      return (
        <Alert type='info'>
          Richard Bland uses an institution-local course namespace rather than the shared VCCS
          numbering and prerequisite baseline. Requirement-scoped courses remain visible for
          verification, but no local prerequisite policy is claimed here.
        </Alert>
      )
    }
    return (
      <Alert type='info'>
        This projects the published statewide VCCS prerequisite baseline onto courses carried by
        {` ${college}`}. A college may add local prerequisites or corequisites, so local catalog
        policy can be stricter than the shared baseline shown here.
      </Alert>
    )
  }
  return (
    <Alert type='info'>
      These are published statewide VCCS course relationships. They are separate from transfer
      equivalencies, and individual colleges may add local prerequisites or corequisites.
    </Alert>
  )
}

function ScopeCoverageWarning({ scope, college }) {
  const objectScope = scope && typeof scope === 'object' ? scope : {}
  const notVccs = objectScope.not_vccs === true
    || objectScope.coverage === 'not_vccs'
    || objectScope.authority === 'not_vccs'
    || /richard bland/i.test(college || '')
  const incomplete = objectScope.incomplete === true
    || objectScope.complete === false
    || objectScope.coverage === 'incomplete'
  if (!notVccs && !incomplete) return null
  return (
    <Alert type='info'>
      {notVccs
        ? 'This institution does not use the shared VCCS course numbering. The statewide VCCS baseline is incomplete here; institution-local prerequisite evidence is required.'
        : 'Prerequisite coverage is incomplete for this scope.'}
      {objectScope.note ? ` ${objectScope.note}` : ''}
    </Alert>
  )
}

function CoverageWarnings({ rows = [] }) {
  if (!Array.isArray(rows) || !rows.length) return null
  return (
    <Alert type='warning'>
      <strong>Coverage notes.</strong>
      <ul className='mt-1.5 list-disc pl-5'>
        {rows.map((row, index) => (
          <li key={row.code || index}>
            {row.message || row.note || String(row)}
            {row.count != null ? ` (${count(row.count)})` : ''}
          </li>
        ))}
      </ul>
    </Alert>
  )
}

function MissingCourses({ rows = [], mode }) {
  if (!Array.isArray(rows) || !rows.length) return null
  const title = mode === 'college'
    ? 'Missing from this college’s gathered supply'
    : 'Unresolved courses in the published sequence'
  return (
    <Panel title={title}>
      <p className='text-caption ink-subtle mb-3'>
        These requirements stay visible instead of being replaced by a more distant prerequisite.
      </p>
      <ul className='grid gap-2 sm:grid-cols-2' aria-label='Missing prerequisite courses'>
        {rows.map((item, index) => {
          const row = typeof item === 'string' ? { code: item } : item
          const requiredBy = row.required_by || row.requiredBy || row.for_courses || []
          return (
            <li key={row.key || row.code || index} className='surface-sunken rounded-md px-3 py-2'>
              <p className='text-caption font-semibold'>{courseLabel(row)}</p>
              {row.reason && <p className='text-tag text-ink-subtle mt-1'>{row.reason}</p>}
              {requiredBy.length > 0 && (
                <p className='text-tag text-ink-subtle mt-1'>Required by {requiredBy.join(', ')}</p>
              )}
            </li>
          )
        })}
      </ul>
    </Panel>
  )
}

function RelationshipDetails({ edges = [], courses = [] }) {
  if (!edges.length) return null
  const byKey = new Map(courses.map((row) => [row.key, row]))
  const corequisites = edges.filter((edge) => edge.kind === 'corequisite')
  return (
    <Panel title='Published relationship details'>
      {corequisites.length > 0 && (
        <p className='text-caption ink-subtle mb-3'>
          Corequisites are listed here rather than drawn as prerequisite arrows.
        </p>
      )}
      <div className='overflow-x-auto'>
        <table className='w-full text-caption' aria-label='Published prerequisite and corequisite relationships'>
          <thead>
            <tr className='border-b border-border text-left'>
              <th className='py-2 pr-3 text-label'>Relationship</th>
              <th className='py-2 pr-3 text-label'>Required course</th>
              <th className='py-2 pr-3 text-label'>For course</th>
              <th className='py-2 text-label'>Published detail</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((edge, index) => {
              const from = byKey.get(edge.from) || { key: edge.from, code: String(edge.from).replace(/^va:(?:crs:)?/, '') }
              const to = byKey.get(edge.to) || { key: edge.to, code: String(edge.to).replace(/^va:(?:crs:)?/, '') }
              return (
                <tr key={`${edge.from}:${edge.to}:${edge.kind || 'prerequisite'}:${index}`}
                  className='border-b border-border last:border-0 align-top'>
                  <td className='py-2.5 pr-3'>
                    <Badge variant={edge.kind === 'corequisite' ? 'conservative' : 'neutral'}>
                      {edge.kind === 'corequisite' ? 'Corequisite' : 'Prerequisite'}
                    </Badge>
                  </td>
                  <td className='py-2.5 pr-3 font-mono'>{codeOf(from)}</td>
                  <td className='py-2.5 pr-3 font-mono'>{codeOf(to)}</td>
                  <td className='py-2.5 text-ink-muted'>
                    {edge.minimum_grade ? `Minimum grade ${edge.minimum_grade}` : edge.raw || '—'}
                    {edge.group && <span className='ml-2 text-tag text-ink-subtle'>grouped formula</span>}
                    {edge.missing && <span className='ml-2 text-tag text-conservative'>missing</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

const rawText = (value) => {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return value.text || value.raw || value.clause || value.note || value.condition || ''
}

const conditionText = (condition) => {
  if (typeof condition === 'string') return condition.replace(/^va:(?:crs:)?/, '')
  if (!condition || typeof condition !== 'object') return ''
  const code = condition.code || condition.course_code || condition.course
    || condition.course_key || condition.key
  const wording = rawText(condition)
  // Eligibility/placement/consent conditions may carry a course code for
  // provenance without making that course a prerequisite. Render the
  // published condition first so `ENG 111 eligible` is not reduced to ENG111.
  const base = condition.type === 'non_course'
    ? wording || (code ? String(code).replace(/^va:(?:crs:)?/, '') : '')
    : code ? String(code).replace(/^va:(?:crs:)?/, '') : wording
  const label = condition.type === 'non_course' && base
    ? base.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase())
    : base
  const grade = condition.minimum_grade || condition.grade
  return [label, grade ? `(minimum ${grade})` : null, condition.equivalent_allowed ? 'or equivalent' : null]
    .filter(Boolean).join(' ')
}

const pathFormula = (paths = []) => paths.map((path) => {
  const conditions = Array.isArray(path) ? path : path?.all_of || path?.conditions || []
  return conditions.map(conditionText).filter(Boolean).join(' + ')
}).filter(Boolean).map((formula) => formula.includes(' + ') ? `(${formula})` : formula).join(' OR ')

function PublishedRuleDetails({ rules = [], courses = [] }) {
  const courseRules = courses.flatMap((course) => {
    const groups = course.requisite_groups || course.requisites || course.published_requisites || []
    return groups.map((group) => ({
      ...group,
      course_key: group.course_key || course.key,
      source_url: group.source_url || course.requisite_source_url || course.source_url,
    }))
  })
  const expandedRules = [...rules, ...courseRules].flatMap((rule) => {
    const groups = rule.groups || rule.requisite_groups
    if (!Array.isArray(groups)) return [rule]
    return groups.map((group) => ({
      ...group,
      course_key: group.course_key || rule.course_key || rule.key || rule.code,
      source_url: group.source_url || rule.source_url,
    }))
  })
  const rows = expandedRules.map((rule, index) => {
    const paths = rule.paths || rule.prerequisite_paths || []
    const corequisitePaths = rule.corequisite_paths || rule.corequisites || []
    const parsedFormula = pathFormula(paths)
    const formula = rule.kind === 'corequisite' ? '' : parsedFormula
    const corequisites = rule.kind === 'corequisite' ? parsedFormula : pathFormula(corequisitePaths)
    const rawClauses = (rule.raw_clauses || rule.clauses || [])
      .map(rawText).filter(Boolean)
    const raw = rawText(rule.raw)
    const target = conditionText(rule.course || rule.course_key || rule.dependent_course_key
      || rule.course_code || rule.code || rule.to)
    const flags = Array.isArray(rule.flags) ? rule.flags.map(String) : []
    return {
      key: rule._id || rule.id || `${target || 'rule'}:${rule.kind || 'prerequisite'}:${index}`,
      target,
      formula,
      corequisites,
      rawClauses: rawClauses.length ? rawClauses : raw ? [raw] : [],
      sourceUrl: rule.source_url || rule.url || null,
      status: rule.status || null,
      flags,
      needsReview: rule.status === 'unparsed'
        || flags.some((flag) => /unparsed|unsupported|needs_review|local_override|audit_incomplete/i.test(flag)),
    }
  }).filter((row) => row.formula || row.corequisites || row.rawClauses.length)
  if (!rows.length) return null
  return (
    <Panel title='Published rule formulas'>
      <p className='text-caption ink-subtle mb-3'>
        The published source text is authoritative. In its parsed formula, “+” means all courses
        in that path and “OR” separates complete alternatives. Flagged formulas need review;
        graph arrows above are only a visual overview.
      </p>
      <div className='grid gap-2'>
        {rows.map((row) => (
          <details key={row.key} className='surface-sunken rounded-md px-3 py-2'>
            <summary className='cursor-pointer text-caption font-semibold'>
              {row.target || 'Published rule'}{row.formula ? `: ${row.formula}` : ''}
              {row.needsReview ? ' · review needed' : ''}
            </summary>
            <div className='mt-2 grid gap-1 text-caption text-ink-muted'>
              {row.corequisites && <p><strong>Corequisite:</strong> {row.corequisites}</p>}
              {(row.status || row.flags.length > 0) && (
                <p><strong>Parser status:</strong>{' '}
                  {[row.status, ...row.flags].filter(Boolean).join(' · ')}</p>
              )}
              {row.rawClauses.map((clause, index) => <p key={index}><strong>Source:</strong> {clause}</p>)}
              {row.sourceUrl && (
                <p><a href={row.sourceUrl} target='_blank' rel='noreferrer'
                  className='text-primary hover:underline'>Open VCCS source</a></p>
              )}
            </div>
          </details>
        ))}
      </div>
    </Panel>
  )
}

function AcceptedCrosswalk({ courses, university }) {
  const rows = courses.filter((row) => row.lands_as)
  if (!rows.length) return null
  const target = (landsAs) => typeof landsAs === 'string'
    ? { identifier: landsAs }
    : landsAs || {}
  return (
    <Panel title='Accepted VCCS crosswalk'>
      <p className='text-caption ink-subtle mb-3'>
        The receiving identifier is the published equivalency at {university}; it is not a degree-applicability verdict.
      </p>
      <div className='overflow-x-auto'>
        <table className='w-full text-caption' aria-label={`Accepted VCCS courses at ${university}`}>
          <thead>
            <tr className='border-b border-border text-left'>
              <th className='py-2 pr-3 text-label'>VCCS course</th>
              <th className='py-2 pr-3 text-label'>Lands as</th>
              <th className='py-2 text-label'>Receiving title / notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const landsAs = target(row.lands_as)
              return (
                <tr key={row.key} className='border-b border-border last:border-0 align-top'>
                  <td className='py-2.5 pr-3'><span className='font-mono'>{codeOf(row)}</span> · {row.title}</td>
                  <td className='py-2.5 pr-3 font-mono'>{landsAs.identifier || '—'}</td>
                  <td className='py-2.5 text-ink-muted'>
                    {[landsAs.name, landsAs.notes].filter(Boolean).join(' · ') || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function GraphContents({ data, mode, college, university }) {
  const courses = normalizedCourses(data.courses || [])
  const concepts = data.concepts || []
  const conceptIndex = Object.fromEntries(concepts.map((concept) => [concept.slug, concept]))
  const edges = data.edges || []
  const prerequisiteEdges = edges
    .filter((edge) => edge.kind !== 'corequisite' && !edge.missing && !edge.provisional)
    .map((edge) => ({ ...edge, option: Boolean(edge.option) }))
  const edgeCourseKeys = new Set(prerequisiteEdges.flatMap((edge) => [edge.from, edge.to]))
  const mappedCourses = courses.filter((course) => course.concept && !course.missing)
  // Published VCCS course formulas are authoritative even when a structural
  // course has no shared semantic concept. Keep those edge endpoints visible
  // in the graph (in the neutral lane) instead of silently dropping the rule.
  const graphCourses = courses.filter((course) => !course.missing
    && (course.concept || edgeCourseKeys.has(course.key)))
  const s = data.stats || {}
  const missing = Array.isArray(data.missing) ? data.missing : []

  const tiles = mode === 'statewide'
    ? [
      { label: 'In-scope Virginia courses', value: count(s.in_scope ?? courses.length) },
      { label: 'Examined', value: count(s.examined ?? courses.filter((row) => row.concept_source).length) },
      { label: 'Mapped', value: count(s.mapped ?? mappedCourses.length) },
      { label: 'Published relationships', value: count(s.edges ?? edges.length) },
    ]
    : [
      { label: mode === 'university' ? 'Accepted VCCS courses' : 'In-scope courses', value: count(s.in_scope ?? courses.length) },
      { label: 'Mapped', value: count(s.mapped ?? mappedCourses.length) },
      { label: 'Prerequisites', value: count(edges.filter((edge) => edge.kind !== 'corequisite').length) },
      { label: mode === 'college' ? 'Missing supply' : 'Unresolved', value: count(missing.length), accent: missing.length === 0 },
    ]

  let graph
  if (graphCourses.length) {
    graph = <PrereqGraph mode='college' courses={graphCourses} edges={prerequisiteEdges} conceptIndex={conceptIndex} />
  } else if (mode === 'statewide' && concepts.length) {
    const conceptRules = (data.concept_rules || []).filter((rule) => rule.from && rule.to)
    graph = <PrereqGraph mode='canonical' concepts={concepts}
      rules={conceptRules.length ? conceptRules : undefined} />
  } else {
    graph = (
      <EmptyState title='No mapped prerequisite courses'
        description='The endpoint returned no concept-mapped courses for this scope.' />
    )
  }

  return (
    <Stack gap='cozy'>
      <ScopeNote mode={mode} college={college} university={university} />
      <ScopeCoverageWarning scope={data.scope} college={college} />
      <CoverageWarnings rows={data.coverage_warnings || []} />
      <StatStrip tiles={tiles} />
      {graph}
      <MissingCourses rows={missing} mode={mode} />
      <PublishedRuleDetails rules={data.rules || []} courses={courses} />
      <RelationshipDetails edges={edges} courses={courses} />
      {mode === 'university' && <AcceptedCrosswalk courses={courses} university={university} />}
    </Stack>
  )
}

export function VirginiaPrerequisiteView({ college = null, university = null }) {
  const mode = university ? 'university' : college ? 'college' : 'statewide'
  const graph = useVaPrerequisiteGraph({ college, university })
  return (
    <LoadingOrError query={graph}>
      {(data) => <GraphContents data={data} mode={mode} college={college} university={university} />}
    </LoadingOrError>
  )
}

const mappingStatus = (row) => {
  const reviewFlags = (row.flags || []).some((flag) => (
    /needs_review|ambiguous|invalid|local_override|audit_incomplete|unparsed|non_vccs|institution_local|no_master/i
      .test(String(flag))
  ))
  if (row.review_status === 'flagged' || row.needs_review || reviewFlags) return 'flagged'
  if (row.concept) return 'mapped'
  if (row.examined || row.concept_source) return 'examined_null'
  return 'unexamined'
}

function MappingContents({ data }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const courses = normalizedCourses(data.courses || [])
  const names = Object.fromEntries((data.concepts || []).map((concept) => [concept.slug, concept.name]))
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return courses.filter((row) => {
      if (status !== 'all' && mappingStatus(row) !== status) return false
      if (!needle) return true
      return [codeOf(row), row.title, row.concept, names[row.concept], row.concept_note, ...(row.flags || [])]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
    })
  }, [courses, names, search, status])

  return (
    <Stack gap='cozy'>
      <Alert type='info'>
        Each Virginia CS-scope course is classified once. This table is read-only; flags identify rows
        that still need adjudication before the mapping is treated as verified.
      </Alert>
      <div className='surface-card px-4 py-3 flex flex-wrap gap-3 items-end'>
        <label className='flex-1 min-w-[230px]'>
          <span className='text-label block mb-1.5'>Search mapping</span>
          <input aria-label='Search Virginia prerequisite mapping' value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder='Course, title, concept, flag…'
            className='w-full rounded-md border border-border bg-surface px-3 py-2 text-caption outline-none focus:border-primary' />
        </label>
        <label className='w-48 max-w-full'>
          <span className='text-label block mb-1.5'>Review status</span>
          <select aria-label='Filter Virginia mapping by review status' value={status}
            onChange={(event) => setStatus(event.target.value)}
            className='w-full rounded-md border border-border bg-surface px-3 py-2 text-caption'>
            <option value='all'>All rows</option>
            <option value='mapped'>Mapped</option>
            <option value='examined_null'>Examined, no concept</option>
            <option value='flagged'>Flagged</option>
            <option value='unexamined'>Unexamined</option>
          </select>
        </label>
        <Badge variant='neutral'>Read only</Badge>
      </div>

      {!rows.length ? (
        <EmptyState title='No matching mappings' description='Change the search or review-status filter.' />
      ) : (
        <div className='surface-card overflow-x-auto'>
          <table className='w-full text-caption' aria-label='Virginia VCCS course concept mapping'>
            <thead>
              <tr className='border-b border-border text-left'>
                <th className='px-4 py-2.5 text-label'>Course</th>
                <th className='px-4 py-2.5 text-label'>Title</th>
                <th className='px-4 py-2.5 text-label'>Concept</th>
                <th className='px-4 py-2.5 text-label'>Confidence</th>
                <th className='px-4 py-2.5 text-label'>Review</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowStatus = mappingStatus(row)
                return (
                  <tr key={row.key} className='border-b border-border last:border-0 align-top'>
                    <td className='px-4 py-3 font-mono'>{codeOf(row)}</td>
                    <td className='px-4 py-3'>{row.title}</td>
                    <td className='px-4 py-3'>
                      {row.concept ? <><span>{names[row.concept] || row.concept}</span><p className='text-tag text-ink-subtle'>{row.concept}</p></> : '—'}
                    </td>
                    <td className='px-4 py-3 tabular-nums'>
                      {row.concept_confidence == null ? '—' : `${Math.round(Number(row.concept_confidence) * 100)}%`}
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex flex-wrap gap-1'>
                        <Badge variant={rowStatus === 'flagged' ? 'conservative' : rowStatus === 'mapped' ? 'success' : 'neutral'}>
                          {rowStatus === 'examined_null' ? 'Examined · no concept' : rowStatus.replace('_', ' ')}
                        </Badge>
                        {(row.flags || []).map((flag) => <Badge key={flag} variant='neutral'>{flag}</Badge>)}
                      </div>
                      {row.concept_note && <p className='text-tag text-ink-subtle mt-1.5'>{row.concept_note}</p>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Stack>
  )
}

export function VirginiaMappingReview() {
  const mapping = useVaPrerequisiteGraph()
  return (
    <LoadingOrError query={mapping}>
      {(data) => <MappingContents data={data} />}
    </LoadingOrError>
  )
}

export default function VirginiaPrerequisitesTab() {
  const [view, setView] = useState('graph')
  return (
    <Stack gap='cozy'>
      <div className='flex flex-wrap items-center gap-3'>
        <Tabs value={view} onChange={setView} options={[
          { value: 'graph', label: 'Published Graph' },
          { value: 'mapping', label: 'Mapping Review' },
        ]} />
        <Badge variant='neutral' className='ml-auto'>Computer Science · Virginia</Badge>
      </div>
      {view === 'graph' ? <VirginiaPrerequisiteView /> : <VirginiaMappingReview />}
    </Stack>
  )
}
