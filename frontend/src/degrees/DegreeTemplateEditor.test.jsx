import React from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import DegreeTemplateEditor from './DegreeTemplateEditor'

const hooks = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue({ ok: true }),
}))

vi.mock('@frontend/query/hooks/useData', () => ({
  useSaveDegreeRequirement: () => ({ mutateAsync: hooks.save, isPending: false }),
  useUniversityCourses: () => ({
    data: [{ parent_id: 10, prefix: 'MATH', number: '51', title: 'Linear Algebra' }],
    isLoading: false,
  }),
}))

const document = {
  _id: 'degree:79',
  legacy_id: '79',
  kind: 'degree',
  institution_id: 'uc:79',
  school_id: 79,
  school: 'UC Berkeley',
  program: 'EECS, B.S.',
  total_units: 120,
  source_url: 'https://example.test/degree',
  requirement_groups: [{
    title: 'Lower-division mathematics',
    tier: 'transferable',
    is_required: true,
    group_conjunction: 'And',
    sections: [{
      section_advisement: 1,
      tier: 'transferable',
      receivers: [{
        receiving: { kind: 'course', parent_id: 10, units: 4 },
        articulation_status: null,
        options: [],
        tier: 'transferable',
      }],
    }],
  }],
}

describe('DegreeTemplateEditor', () => {
  const scrollTo = window.scrollTo
  beforeAll(() => { window.scrollTo = vi.fn() })
  afterAll(() => { window.scrollTo = scrollTo })

  it('opens the structured requirement editor and saves the canonical document', async () => {
    hooks.save.mockClear()
    const onSaved = vi.fn()
    const { getByRole, getByDisplayValue, getByText } = render(
      <DegreeTemplateEditor open initialDocument={document}
        schoolId={79} school='UC Berkeley' majorSlug='cs'
        onClose={() => {}} onSaved={onSaved} />
    )

    expect(getByDisplayValue('EECS, B.S.')).toBeTruthy()
    expect(getByDisplayValue('Lower-division mathematics')).toBeTruthy()
    expect(getByText('Complete 1: MATH 51')).toBeTruthy()

    fireEvent.click(getByRole('button', { name: 'Edit requirement' }))
    expect(getByRole('dialog', { name: 'Edit degree requirement' })).toBeTruthy()
    expect(getByText('1 selected')).toBeTruthy()

    fireEvent.click(getByRole('button', { name: 'Cancel' }))
    fireEvent.click(getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(hooks.save).toHaveBeenCalledTimes(1))
    expect(hooks.save.mock.calls[0][0]).toMatchObject({
      _id: 'degree:79',
      major_slug: 'cs',
      program: 'EECS, B.S.',
      requirement_groups: [{ title: 'Lower-division mathematics' }],
    })
    expect(onSaved).toHaveBeenCalled()
  })
})
