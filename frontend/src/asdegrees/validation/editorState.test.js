import { describe, expect, it } from 'vitest'
import {
  addGroup,
  addOption,
  addReceiver,
  addSection,
  moveGroup,
  moveOption,
  moveReceiver,
  moveSection,
  normalizeGroupIdDraft,
  removeGroup,
  removeOption,
  removeReceiver,
  removeSection,
  setDocField,
  setGroupIdDraft,
  setGroupCourses,
  setOptionCourses,
  setUnresolvedCourses,
  setVerification,
  setVerificationNotes,
  toEditableDoc,
  updateGroup,
  updateOption,
  updateReceiver,
  updateSection,
  validateLocal,
} from './editorState'

const receiver = (courseIds = [101]) => ({
  receiving: null,
  articulation_status: 'articulated',
  not_articulated_reason: null,
  options: [{
    course_ids: courseIds,
    course_conjunction: 'and',
    course_keys: courseIds.map((id) => `cc:${id}`),
  }],
  options_conjunction: 'and',
  hash_id: null,
})

const degreeDoc = () => ({
  _id: 'as_degree:110:local_cs_as',
  legacy_id: '110:local_cs_as',
  kind: 'as_degree',
  community_college_id: 110,
  college_id: 'cc:110',
  degree_type: 'local_cs_as',
  major_slug: 'cs',
  template_ref: 'as_degree_template:cs_local',
  status: 'found',
  degree_title_seen: 'Computer Science, A.S.',
  catalog_url: 'https://catalog.example.edu/cs-as',
  catalog_year: '2025-2026',
  unit_system: 'semester',
  total_units: 60,
  covered_concepts: ['cs_1'],
  verification: {
    verified: false,
    verified_by: null,
    verified_at: null,
    notes: 'Check the cross-listed course manually.',
  },
  extraction: { artifact: 'fixture.json', model: 'fixture-model' },
  requirement_groups: [
    {
      group_id: 'core_programming',
      template_group: 'core_programming',
      label_seen: 'Required Core',
      source: 'extracted',
      confidence: 0.93,
      curated_by: null,
      curated_at: null,
      is_required: true,
      group_conjunction: 'And',
      group_advisement: null,
      group_unit_advisement: null,
      group_min_distinct_sections: null,
      group_max_distinct_sections: null,
      group_section_min_courses: null,
      ge_area: null,
      units_fill: false,
      unresolved_courses_seen: [{ course_code_seen: 'CS 199' }],
      sections: [{
        section_advisement: null,
        unit_advisement: null,
        receivers: [receiver()],
      }],
    },
    {
      group_id: 'electives',
      template_group: 'electives',
      label_seen: 'Electives',
      source: 'curated',
      confidence: null,
      curated_by: 'reviewer-old',
      curated_at: '2026-07-01T00:00:00.000Z',
      units_fill: true,
      unresolved_courses_seen: [],
    },
  ],
  curated_by: 'reviewer-old',
  curated_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
})

describe('toEditableDoc', () => {
  it('extracts the canonical row, strips view fields, and preserves unknown canonical fields', () => {
    const source = degreeDoc()
    const editable = toEditableDoc({
      doc: source,
      courses_by_id: { 'cc:101': { code: 'CS 101' } },
      missing_core_concepts: ['cs_2_oop'],
      coverage_pct: 50,
      ge_breakdowns: {},
    })

    expect(editable).toMatchObject({
      _id: source._id,
      legacy_id: source.legacy_id,
      kind: 'as_degree',
      extraction: source.extraction,
      covered_concepts: ['cs_1'],
      verification: source.verification,
    })
    expect(editable).not.toHaveProperty('courses_by_id')
    expect(editable).not.toHaveProperty('coverage_pct')

    editable.requirement_groups[0].label_seen = 'Changed locally'
    expect(source.requirement_groups[0].label_seen).toBe('Required Core')
  })

  it('derives save-friendly identity and verification defaults without dropping fields', () => {
    const editable = toEditableDoc({
      _id: 'as_degree:22:ast',
      community_college_id: 22,
      college_id: 'cc:22',
      degree_type: 'ast',
      major_slug: 'cs',
      status: 'found',
      custom_canonical_field: { keep: true },
    })

    expect(editable.legacy_id).toBe('22:ast')
    expect(editable.kind).toBe('as_degree')
    expect(editable.verification).toEqual({
      verified: false, verified_by: null, verified_at: null, notes: null,
    })
    expect(editable.requirement_groups).toEqual([])
    expect(editable.custom_canonical_field).toEqual({ keep: true })
  })
})

describe('group editing', () => {
  it('marks every touched group curated, clears confidence, and stamps provenance immutably', () => {
    const source = degreeDoc()
    const edited = updateGroup(
      source,
      'core_programming',
      { label_seen: 'Programming Core', confidence: 0.5 },
      { by: 'reviewer-1', at: '2026-07-22T12:00:00.000Z' }
    )

    expect(edited.requirement_groups[0]).toMatchObject({
      label_seen: 'Programming Core',
      source: 'curated',
      confidence: null,
      curated_by: 'reviewer-1',
      curated_at: '2026-07-22T12:00:00.000Z',
    })
    expect(source.requirement_groups[0]).toMatchObject({
      label_seen: 'Required Core', source: 'extracted', confidence: 0.93,
    })

    const serverStamped = updateGroup(edited, 'core_programming', { ge_area: 'calgetc' })
    expect(serverStamped.requirement_groups[0]).toMatchObject({
      source: 'curated', confidence: null, curated_by: null, curated_at: null,
    })
  })

  it('adds slug-safe unique groups with editor-safe defaults and reorders/removes them', () => {
    const source = degreeDoc()
    const added = addGroup(source, 'Core Programming')
    const group = added.requirement_groups.at(-1)

    expect(group).toMatchObject({
      group_id: 'core_programming_2',
      template_group: null,
      label_seen: 'Core Programming',
      source: 'curated',
      confidence: null,
      is_required: true,
      units_fill: false,
      sections: [{ section_advisement: null, unit_advisement: null, receivers: [] }],
    })
    expect(source.requirement_groups).toHaveLength(2)

    const moved = moveGroup(added, 'core_programming_2', 'up')
    expect(moved.requirement_groups.map((item) => item.group_id))
      .toEqual(['core_programming', 'core_programming_2', 'electives'])
    expect(moved.requirement_groups[1].source).toBe('curated')

    const removed = removeGroup(moved, 'core_programming_2')
    expect(removed.requirement_groups.map((item) => item.group_id))
      .toEqual(['core_programming', 'electives'])
  })

  it('preserves an in-progress group id and normalizes it uniquely on blur', () => {
    const source = degreeDoc()
    const typing = setGroupIdDraft(source, 1, 'core_programming')

    expect(typing.requirement_groups[1].group_id).toBe('core_programming')
    expect(typing.requirement_groups[1]).toMatchObject({
      template_group: null,
      source: 'curated',
      confidence: null,
    })
    expect(normalizeGroupIdDraft(typing, 1).requirement_groups[1].group_id)
      .toBe('core_programming_2')
  })
})

describe('section, receiver, and option editing', () => {
  it('builds canonical receiver options and course-key mirrors', () => {
    const source = degreeDoc()
    const edited = setGroupCourses(source, 'core_programming', 0, 0, [202, 'cc:203', 202])
    const group = edited.requirement_groups[0]
    const changedReceiver = group.sections[0].receivers[0]

    expect(changedReceiver).toMatchObject({
      receiving: null,
      articulation_status: 'articulated',
      options_conjunction: 'and',
      options: [{
        course_ids: [202, 203],
        course_conjunction: 'and',
        course_keys: ['cc:202', 'cc:203'],
      }],
    })
    expect(group).toMatchObject({ source: 'curated', confidence: null })
    expect(source.requirement_groups[0].sections[0].receivers[0].options[0].course_ids)
      .toEqual([101])
  })

  it('offers composable immutable helpers for each nesting level', () => {
    let doc = addSection(degreeDoc(), 'core_programming', { section_advisement: 1 })
    expect(doc.requirement_groups[0].sections).toHaveLength(2)

    doc = updateSection(doc, 'core_programming', 1, { unit_advisement: 4 })
    expect(doc.requirement_groups[0].sections[1]).toMatchObject({
      section_advisement: 1, unit_advisement: 4, receivers: [],
    })

    doc = addReceiver(doc, 'core_programming', 1, [301])
    doc = updateReceiver(doc, 'core_programming', 1, 0, { options_conjunction: 'or' })
    expect(doc.requirement_groups[0].sections[1].receivers[0]).toMatchObject({
      receiving: null,
      articulation_status: 'articulated',
      options_conjunction: 'or',
      options: [{ course_ids: [301], course_keys: ['cc:301'] }],
    })

    doc = addOption(doc, 'core_programming', 1, 0, [302])
    doc = updateOption(doc, 'core_programming', 1, 0, 1, { course_ids: [303, 304] })
    expect(doc.requirement_groups[0].sections[1].receivers[0].options[1]).toEqual({
      course_ids: [303, 304],
      course_conjunction: 'and',
      course_keys: ['cc:303', 'cc:304'],
    })
  })

  it('moves and removes nested rows without mutating the input tree', () => {
    const source = degreeDoc()
    let doc = addSection(source, 'core_programming', {
      receivers: [receiver([201]), receiver([202])],
    })
    doc = addOption(doc, 'core_programming', 1, 0, [203])
    doc = setOptionCourses(doc, 'core_programming', 1, 0, 1, [204, '', null])
    doc = moveOption(doc, 'core_programming', 1, 0, 1, 'up')
    expect(doc.requirement_groups[0].sections[1].receivers[0].options[0].course_ids)
      .toEqual([204])

    doc = moveReceiver(doc, 'core_programming', 1, 1, 'up')
    expect(doc.requirement_groups[0].sections[1].receivers[0].options[0].course_ids)
      .toEqual([202])
    doc = removeReceiver(doc, 'core_programming', 1, 0)
    doc = removeOption(doc, 'core_programming', 1, 0, 1)
    expect(doc.requirement_groups[0].sections[1].receivers).toHaveLength(1)
    expect(doc.requirement_groups[0].sections[1].receivers[0].options).toHaveLength(1)

    doc = moveSection(doc, 'core_programming', 1, 'up')
    expect(doc.requirement_groups[0].sections[0].receivers[0].options[0].course_ids)
      .toEqual([204])
    doc = removeSection(doc, 'core_programming', 0)
    expect(doc.requirement_groups[0].sections).toHaveLength(1)
    expect(source.requirement_groups[0].sections).toHaveLength(1)

    doc = setUnresolvedCourses(doc, 'core_programming', [{ course_code_seen: 'CS 299' }])
    expect(doc.requirement_groups[0].unresolved_courses_seen)
      .toEqual([{ course_code_seen: 'CS 299' }])
  })
})

describe('document and verification state', () => {
  it('drops requirement groups when status leaves found without mutating the source', () => {
    const source = degreeDoc()
    const noneFound = setDocField(source, 'status', 'none_found')

    expect(noneFound.status).toBe('none_found')
    expect(noneFound).not.toHaveProperty('requirement_groups')
    expect(source.requirement_groups).toHaveLength(2)

    const foundAgain = setDocField(noneFound, 'status', 'found')
    expect(foundAgain.requirement_groups).toEqual([])
  })

  it('stamps verification while preserving user-authored notes, and clears stamps on reopen', () => {
    const source = degreeDoc()
    const verified = setVerification(source, true, {
      by: 'reviewer-2', at: new Date('2026-07-22T15:30:00.000Z'),
    })

    expect(verified.verification).toEqual({
      verified: true,
      verified_by: 'reviewer-2',
      verified_at: '2026-07-22T15:30:00.000Z',
      notes: 'Check the cross-listed course manually.',
    })
    expect(source.verification.verified).toBe(false)

    const withNotes = setVerificationNotes(verified, 'Reviewed against the 2026 catalog.')
    const reopened = setVerification(withNotes, false)
    expect(reopened.verification).toEqual({
      verified: false,
      verified_by: null,
      verified_at: null,
      notes: 'Reviewed against the 2026 catalog.',
    })
  })
})

describe('validateLocal', () => {
  it('accepts the canonical fixture and reports cheap validator failures', () => {
    expect(validateLocal(degreeDoc())).toEqual([])

    const invalid = degreeDoc()
    invalid.catalog_url = 'catalog.example.edu/cs-as'
    invalid.total_units = 0
    invalid.requirement_groups[0].group_id = 'Bad Group ID'
    invalid.requirement_groups[0].sections[0].receivers[0]
      .options[0].course_keys = ['cc:999']

    const errors = validateLocal(invalid)
    expect(errors).toEqual(expect.arrayContaining([
      'catalog_url must be an http(s) URL',
      'total_units must be a positive number',
      'each group needs a group_id matching ^[a-z0-9_]+$',
      'group Bad Group ID: course_keys must mirror course_ids as cc:<n>',
    ]))
  })

  it('flags duplicate ids and groups that violate source/default rules', () => {
    const invalid = degreeDoc()
    invalid.requirement_groups.push({
      group_id: 'core_programming',
      template_group: 'different_group',
      source: 'curated',
      confidence: 0.8,
      sections: [],
    })

    const errors = validateLocal(invalid)
    expect(errors).toEqual(expect.arrayContaining([
      'duplicate group_id: core_programming',
      'group core_programming: template_group must equal group_id or be null',
      'group core_programming: confidence must be null unless source is extracted',
      'group core_programming: sections must be a non-empty array',
    ]))
  })
})
