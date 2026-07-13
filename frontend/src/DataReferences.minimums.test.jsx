import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import RequirementsLedger from '@frontend/components/requirements/RequirementsLedger'
import { minimumsToLedger } from './DataReferences'
import { refTableByKey } from './references/refTablesRegistry'

const rows = [
  {
    _id: 'transfer_minimum:ucsd:calc_1:a:math_20a',
    group_id: 'Calc1',
    set_id: 'A',
    source_order: 0,
    receiving_code: 'MATH 20A',
    matched: true,
    parent_ids: [11],
    matched_courses: [{ parent_id: 11, prefix: 'MATH', number: '20A', title: 'Calculus I' }],
  },
  {
    _id: 'transfer_minimum:ucsd:discrete_math:a:cse_20',
    group_id: 'DiscreteMath',
    set_id: 'A',
    source_order: 0,
    receiving_code: 'CSE 20',
    matched: true,
    parent_ids: [12],
    matched_courses: [{ parent_id: 12, prefix: 'CSE', number: '20', title: 'Discrete Mathematics' }],
  },
  {
    _id: 'transfer_minimum:ucsd:intro:a:cse_8b',
    group_id: 'Intro',
    set_id: 'A',
    source_order: 0,
    receiving_code: 'CSE 8B',
    matched: true,
    parent_ids: [18],
    matched_courses: [{ parent_id: 18, prefix: 'CSE', number: '8B', title: 'Introduction to Programming' }],
  },
  {
    _id: 'transfer_minimum:ucsd:intro:b:cse_11',
    group_id: 'Intro',
    set_id: 'B',
    source_order: 1,
    receiving_code: 'CSE 11',
    matched: false,
    parent_ids: [],
    matched_courses: [],
  },
  {
    _id: 'transfer_minimum:ucsd:data_structures:a:cse_12',
    group_id: 'DataStructures',
    set_id: 'A',
    source_order: 0,
    receiving_code: 'CSE 12',
    matched: true,
    parent_ids: [20],
    matched_courses: [{ parent_id: 20, prefix: 'CSE', number: '12', title: 'Data Structures' }],
  },
]

describe('minimumsToLedger', () => {
  it('merges atomic requirements into subject groups while preserving local alternatives', () => {
    const ledger = minimumsToLedger(rows)
    expect(ledger.requirement_groups).toHaveLength(2)
    expect(ledger.requirement_groups[0]).toMatchObject({
      title: 'Mathematics',
      group_conjunction: 'And',
    })
    expect(ledger.requirement_groups[1]).toMatchObject({
      title: 'Computer Science',
      group_conjunction: 'And',
    })
    expect(ledger.requirement_groups[0].sections.map((section) => section.title))
      .toEqual(['Calc 1', 'Discrete Math'])
    expect(ledger.requirement_groups[1].sections.map((section) => section.title))
      .toEqual(['Intro', 'Data Structures'])
    expect(ledger.requirement_groups[1].sections[0]).toMatchObject({
      section_advisement: 1,
      receivers: [{ receiving: { parent_id: 18 } }, { receiving: { kind: 'course' } }],
    })

    const { container } = render(
      <RequirementsLedger major={{ requirement_groups: ledger.requirement_groups }}
        universityCoursesById={ledger.universityCoursesById}
        preserveOrder showCompletion={false} />
    )
    expect(container.textContent).toContain('Mathematics')
    expect(container.textContent).toContain('Computer Science')
    expect(container.textContent).toContain('Calc 1')
    expect(container.textContent).toContain('Complete 1 of:')
    expect(container.textContent).toContain('CSE 8B')
    expect(container.textContent).toContain('CSE 11')
  })

  it('uses the curated count for same-set requirements and cross-set choices', () => {
    const ledger = minimumsToLedger([
      ...['31', '32', '33'].map((number, index) => ({
        _id: `uci:intro:${number}`,
        group_id: 'Intro',
        set_id: 'A',
        source_order: index,
        source_entry: [`I&C SCI ${number}`, 'A', 3],
        receiving_code: `I&C SCI ${number}`,
      })),
      ...['45C', '46'].map((number, index) => ({
        _id: `uci:programming:${number}`,
        group_id: 'Programming',
        set_id: String.fromCharCode(65 + index),
        source_order: index,
        source_entry: [`I&C SCI ${number}`, String.fromCharCode(65 + index), 1],
        receiving_code: `I&C SCI ${number}`,
      })),
    ])
    const sections = ledger.requirement_groups[0].sections
    expect(sections.find((section) => section.title === 'Intro').section_advisement).toBe(3)
    expect(sections.find((section) => section.title === 'Programming').section_advisement).toBe(1)
  })
})

describe('transfer-minimum editor mapping', () => {
  it('updates parent_ids when the linked UC course changes', () => {
    const config = refTableByKey('transfer_minimums')
    const saved = config.derive({
      uc_code: 'UCSD',
      receiving_code: 'CSE 11',
      matched_courses: [{ parent_id: 42, prefix: 'CSE', number: '11' }],
    })
    expect(saved.parent_ids).toEqual([42])
    expect(saved.matched).toBe(true)
  })
})
