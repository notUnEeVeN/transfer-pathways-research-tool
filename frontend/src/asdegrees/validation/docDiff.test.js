import { describe, expect, it } from 'vitest'
import { diffDocs, stampAiAssistedGroups } from './docDiff'

const group = (groupId, label = groupId) => ({
  group_id: groupId,
  label_seen: label,
  source: 'extracted',
  confidence: 0.8,
})

describe('diffDocs', () => {
  it('reports added, removed, and changed groups', () => {
    const before = {
      degree_title_seen: 'Old title',
      requirement_groups: [group('core'), group('remove_me')],
    }
    const after = {
      degree_title_seen: 'Old title',
      requirement_groups: [group('core', 'Renamed core'), group('new_group')],
    }

    expect(diffDocs(before, after).map(({ group_id, kind }) => ({ group_id, kind }))).toEqual([
      { group_id: 'remove_me', kind: 'removed' },
      { group_id: 'core', kind: 'changed' },
      { group_id: 'new_group', kind: 'added' },
    ])
  })

  it('reports changed document fields without treating timestamps as edits', () => {
    const before = {
      status: 'found', degree_title_seen: 'Old', updated_at: '2026-01-01',
      requirement_groups: [group('core')],
    }
    const after = {
      status: 'ambiguous', degree_title_seen: 'New', updated_at: '2026-02-01',
      requirement_groups: [group('core')],
    }

    expect(diffDocs(before, after)).toEqual([
      expect.objectContaining({ group_id: 'status', kind: 'doc_field', before: 'found', after: 'ambiguous' }),
      expect.objectContaining({ group_id: 'degree_title_seen', kind: 'doc_field', before: 'Old', after: 'New' }),
    ])
  })

  it('surfaces group reorder and canonical fields outside the common allowlist', () => {
    const before = {
      covered_concepts: ['cs_1'],
      requirement_groups: [group('a'), group('b')],
    }
    const after = {
      covered_concepts: ['cs_2'],
      requirement_groups: [group('b'), group('a')],
    }

    expect(diffDocs(before, after).map(({ group_id, kind }) => ({ group_id, kind }))).toEqual([
      { group_id: 'b', kind: 'changed' },
      { group_id: 'a', kind: 'changed' },
      { group_id: 'covered_concepts', kind: 'doc_field' },
    ])
  })

  it('does not report a change for object-key ordering alone', () => {
    expect(diffDocs(
      { verification: { verified: false, notes: null }, requirement_groups: [] },
      { verification: { notes: null, verified: false }, requirement_groups: [] },
    )).toEqual([])
  })
})

describe('stampAiAssistedGroups', () => {
  it('marks only added or changed groups and clears stale curator stamps', () => {
    const before = { requirement_groups: [group('same'), group('core')] }
    const proposed = {
      requirement_groups: [
        group('same'),
        { ...group('core', 'Changed'), curated_by: 'old-user', curated_at: 'yesterday' },
        group('new_group'),
      ],
    }

    const stamped = stampAiAssistedGroups(before, proposed)

    expect(stamped.requirement_groups[0]).not.toHaveProperty('curated_via')
    expect(stamped.requirement_groups[1]).toMatchObject({
      source: 'curated', confidence: null, curated_via: 'ai_assist', curated_by: null,
    })
    expect(stamped.requirement_groups[1]).not.toHaveProperty('curated_at')
    expect(stamped.requirement_groups[2]).toMatchObject({
      source: 'curated', confidence: null, curated_via: 'ai_assist', curated_by: null,
    })
  })

  it('preserves user verification fields and invalidates a prior verified stamp', () => {
    const before = {
      verification: {
        verified: true,
        verified_by: 'partner-1',
        verified_at: 'yesterday',
        notes: 'Human-authored evidence.',
      },
      requirement_groups: [group('core')],
    }
    const proposed = {
      verification: {
        verified: true,
        verified_by: 'ai',
        verified_at: 'now',
        notes: 'AI-authored text',
      },
      requirement_groups: [group('core', 'Corrected core')],
    }

    expect(stampAiAssistedGroups(before, proposed).verification).toEqual({
      verified: false,
      verified_by: null,
      verified_at: null,
      notes: 'Human-authored evidence.',
    })
  })
})
