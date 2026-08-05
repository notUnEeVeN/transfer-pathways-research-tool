import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

const state = { scopes: [] }
vi.mock('./useVirginia', () => ({
  useVaPrerequisiteGraph: (scope = {}) => {
    state.scopes.push(scope)
    return state.query
  },
}))

import VirginiaPrerequisitesTab, { VirginiaPrerequisiteView } from './VirginiaPrerequisites'

const ok = (data) => ({ data, isLoading: false, isError: false, error: null })

const fixture = () => ({
  concepts: [
    { slug: 'precalc_1', name: 'Precalculus I', discipline: 'math', requires: [], satisfies: [] },
    { slug: 'precalc_2', name: 'Precalculus II', discipline: 'math', requires: ['precalc_1'], satisfies: [] },
    { slug: 'precalc_combined', name: 'Precalculus with Trigonometry', discipline: 'math', requires: [], satisfies: ['precalc_1', 'precalc_2'] },
    { slug: 'calc_1', name: 'Calculus I', discipline: 'math', requires: ['precalc_2'], satisfies: [] },
    { slug: 'cs_1', name: 'Programming Fundamentals', discipline: 'cs', requires: [], satisfies: [] },
    { slug: 'cs_2_oop', name: 'Object-Oriented Programming', discipline: 'cs', requires: ['cs_1'], satisfies: [] },
    { slug: 'discrete_math', name: 'Discrete Structures', discipline: 'math', requires: [], satisfies: [] },
    { slug: 'cs_3_data_structures', name: 'Data Structures', discipline: 'cs', requires: ['cs_2_oop'], satisfies: [] },
  ],
  stats: { in_scope: 9, examined: 8, mapped: 8, edges: 5 },
  courses: [
    { key: 'va:MTH161', code: 'MTH161', title: 'Precalculus I', concept: 'precalc_1', concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: true },
    { key: 'va:MTH162', code: 'MTH162', title: 'Precalculus II', concept: 'precalc_2', concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: true },
    { key: 'va:MTH167', code: 'MTH167', title: 'Precalculus with Trigonometry', concept: 'precalc_combined', concept_source: 'vccs_master', concept_confidence: 0.72, flags: ['needs_review'], in_scope: true },
    { key: 'va:MTH263', code: 'MTH263', title: 'Calculus I', concept: 'calc_1', concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: true },
    { key: 'va:CSC221', code: 'CSC221', title: 'Introduction to Problem Solving', concept: 'cs_1', concept_source: 'vccs_master', concept_confidence: 1, flags: ['statewide_exact'], in_scope: true },
    { key: 'va:CSC222', code: 'CSC222', title: 'Object-Oriented Programming', concept: 'cs_2_oop', concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: true },
    { key: 'va:CSC208', code: 'CSC208', title: 'Introduction to Discrete Structures', concept: 'discrete_math', concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: true },
    { key: 'va:EGR125', code: 'EGR125', title: 'Introduction to Engineering Methods', concept: null, concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: false },
    { key: 'va:CSC210', code: 'CSC210', title: 'Programming with C++', concept: 'cs_1', concept_source: 'vccs_master', concept_confidence: 0.7, flags: ['needs_review'], in_scope: true },
    { key: 'va:CSC223', code: 'CSC223', title: 'Data Structures and Analysis of Algorithms', concept: 'cs_3_data_structures', concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: true,
      lands_as: { identifier: 'CS310', name: 'Data Structures', notes: 'Major credit subject to advising' } },
    { key: 'va:SDV100', code: 'SDV100', title: 'College Success Skills', concept: null, concept_source: 'vccs_master', concept_confidence: 1, flags: [], in_scope: true },
  ],
  edges: [
    { from: 'va:MTH161', to: 'va:MTH162', kind: 'prerequisite', minimum_grade: 'C' },
    { from: 'va:MTH167', to: 'va:MTH263', kind: 'prerequisite', group: 'mth263-paths' },
    { from: 'va:MTH161', to: 'va:MTH263', kind: 'prerequisite', group: 'mth263-paths' },
    { from: 'va:MTH162', to: 'va:MTH263', kind: 'prerequisite', group: 'mth263-paths' },
    { from: 'va:CSC222', to: 'va:CSC223', kind: 'prerequisite', raw: 'Prerequisite: CSC 222 or departmental consent.' },
    { from: 'va:CSC208', to: 'va:CSC223', kind: 'corequisite', raw: 'Corequisite: CSC 208 or equivalent.' },
    { from: 'va:EGR125', to: 'va:CSC210', kind: 'prerequisite', group: 'csc210-paths', option: true },
  ],
  rules: [
    {
      course_key: 'va:MTH263',
      paths: [
        { all_of: [{ course_key: 'va:MTH167', minimum_grade: 'C' }] },
        { all_of: [{ course_key: 'va:MTH161', minimum_grade: 'C' }, { course_key: 'va:MTH162', minimum_grade: 'C' }] },
      ],
      raw_clauses: ['Completion of MTH 167 or MTH 161/162 or equivalent with a grade of C or better.'],
      source_url: 'https://courses.vccs.edu/courses/MTH263',
    },
    {
      course_key: 'va:CSC223',
      paths: [{ all_of: [{ course_key: 'va:CSC222' }] }],
      raw: 'CSC 222 or departmental consent.',
      kind: 'prerequisite',
    },
    {
      dependent_course_key: 'va:CSC223',
      paths: [{ all_of: [{ course_key: 'va:CSC208' }] }],
      raw: 'CSC 208 or equivalent.',
      kind: 'corequisite',
    },
  ],
  missing: [{ key: 'va:PHY241', code: 'PHY241', title: 'University Physics I', required_by: ['PHY242'] }],
  scope: { coverage: 'complete' },
})

beforeEach(() => {
  state.scopes = []
  state.query = ok(fixture())
})

describe('statewide Virginia prerequisite view', () => {
  it('keeps nested alternatives, grade thresholds, raw clauses, and corequisites readable', () => {
    render(<VirginiaPrerequisiteView />)
    expect(screen.getByText(/MTH263: MTH167 \(minimum C\) OR \(MTH161 \(minimum C\) \+ MTH162 \(minimum C\)\)/)).toBeTruthy()
    expect(screen.getByText(/Completion of MTH 167 or MTH 161\/162/i)).toBeTruthy()
    expect(screen.getAllByText(/Corequisite:/).length).toBeGreaterThan(0)
    const details = screen.getByRole('table', { name: /published prerequisite and corequisite/i })
    expect(within(details).getByText('Corequisite')).toBeTruthy()
    expect(within(details).getByText('CSC208')).toBeTruthy()
    expect(screen.getByLabelText(/^EGR 125 Introduction to Engineering Methods,/)).toBeTruthy()
  })

  it('renders coded eligibility as a non-course condition, not a course prerequisite', () => {
    const data = fixture()
    data.rules = [{
      course_key: 'va:EGR121',
      kind: 'prerequisite',
      paths: [{
        all_of: [{
          type: 'non_course',
          code: 'ENG111',
          course_key: 'va:ENG111',
          condition: 'eligibility',
          raw: 'ENG 111 eligible',
        }],
      }],
      raw: 'ENG 111 eligible; MTH 162 or MTH 167, or equivalent; or departmental approval.',
    }]
    state.query = ok(data)
    render(<VirginiaPrerequisiteView />)
    expect(screen.getByText(/EGR121: ENG 111 eligible/)).toBeTruthy()
    expect(screen.queryByText(/EGR121: ENG111(?:\s|$)/)).toBeNull()
  })

  it('offers a read-only mapping queue with search and review filters', () => {
    render(<VirginiaPrerequisitesTab />)
    fireEvent.click(screen.getByRole('tab', { name: 'Mapping Review' }))
    expect(screen.getByText('Read only')).toBeTruthy()

    fireEvent.change(screen.getByLabelText(/filter Virginia mapping by review status/i),
      { target: { value: 'flagged' } })
    const table = screen.getByRole('table', { name: /Virginia VCCS course concept mapping/i })
    expect(within(table).getByText('MTH167')).toBeTruthy()
    expect(within(table).queryByText('CSC221')).toBeNull()

    fireEvent.change(screen.getByLabelText(/search Virginia prerequisite mapping/i),
      { target: { value: 'no match' } })
    expect(screen.getByText('No matching mappings')).toBeTruthy()
  })

  it('handles loading, error, and empty responses explicitly', () => {
    state.query = { data: undefined, isLoading: true, isError: false, error: null }
    const { rerender } = render(<VirginiaPrerequisiteView />)
    state.query = { data: undefined, isLoading: false, isError: true, error: new Error('boom') }
    rerender(<VirginiaPrerequisiteView />)
    expect(screen.getByText(/could not load/i)).toBeTruthy()
    state.query = ok({ concepts: [], courses: [], rules: [], edges: [], stats: {} })
    rerender(<VirginiaPrerequisiteView />)
    expect(screen.getByText('No mapped prerequisite courses')).toBeTruthy()
  })

  it('does not present the shared template as published Virginia data when the corpus is absent', () => {
    state.query = ok({
      concepts: fixture().concepts,
      concept_rules: [{ from: 'cs_1', to: 'cs_2_oop' }],
      courses: [], rules: [], edges: [],
      stats: { no_result: true, corpus_available: false },
      scope: { coverage: 'unavailable', corpus_imported: false },
    })
    const { rerender } = render(<VirginiaPrerequisiteView />)
    expect(screen.getByText('No prerequisite data')).toBeTruthy()
    expect(screen.getByText(/corpus has not been imported/i)).toBeTruthy()
    expect(screen.queryByText(/published statewide VCCS course relationships/i)).toBeNull()

    rerender(<VirginiaPrerequisitesTab />)
    fireEvent.click(screen.getByRole('tab', { name: 'Mapping Review' }))
    expect(screen.getByText('No prerequisite data')).toBeTruthy()
    expect(screen.queryByRole('table', { name: /course concept mapping/i })).toBeNull()
  })

  it.each([
    {
      status: 'generation_mismatch',
      title: 'Prerequisite import mismatch',
      detail: /different import generations/i,
    },
    {
      status: 'incomplete_import',
      title: 'Prerequisite import incomplete',
      detail: /only part of the Virginia prerequisite corpus is present/i,
    },
  ])('explains a $status corpus without calling it never imported', ({ status, title, detail }) => {
    state.query = ok({
      concepts: [], courses: [], rules: [], edges: [],
      stats: { no_result: true, corpus_available: false, corpus_status: status },
      scope: { coverage: 'unavailable', corpus_imported: false, corpus_status: status },
    })
    render(<VirginiaPrerequisiteView />)
    expect(screen.getByText(title)).toBeTruthy()
    expect(screen.getByText(detail)).toBeTruthy()
    expect(screen.queryByText(/has not been imported yet/i)).toBeNull()
  })
})

describe('institution projections', () => {
  it('shows missing supply and warns for the non-VCCS Richard Bland exception', () => {
    const data = fixture()
    data.scope = { coverage: 'not_vccs', incomplete: true }
    data.coverage_warnings = [{ code: 'institution_local_courses', count: 10,
      message: 'Institution-local courses need separate evidence.' }]
    state.query = ok(data)
    render(<VirginiaPrerequisiteView college='Richard Bland College' />)
    expect(screen.getByText(/does not use the shared VCCS course numbering/i)).toBeTruthy()
    expect(screen.getByText(/no local prerequisite policy is claimed/i)).toBeTruthy()
    expect(screen.queryByText(/projects the published statewide VCCS prerequisite baseline/i)).toBeNull()
    expect(screen.getByText(/Institution-local courses need separate evidence\. \(10\)/)).toBeTruthy()
    expect(screen.getByText('Missing from this college’s gathered supply')).toBeTruthy()
    expect(screen.getByText(/PHY241/)).toBeTruthy()
    expect(state.scopes.at(-1)).toEqual({ college: 'Richard Bland College', university: null })
  })

  it('labels the receiving view as transfer preparation and shows the lands-as crosswalk', () => {
    render(<VirginiaPrerequisiteView university='George Mason University' />)
    expect(screen.getByText(/Transfer preparation, not university prerequisites/i)).toBeTruthy()
    expect(screen.getByText('Accepted VCCS crosswalk')).toBeTruthy()
    expect(screen.getByText('CS310')).toBeTruthy()
    expect(screen.getByText(/not a degree-applicability verdict/i)).toBeTruthy()
    expect(state.scopes.at(-1)).toEqual({ college: null, university: 'George Mason University' })
  })
})
