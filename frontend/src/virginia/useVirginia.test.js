import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ useQuery: vi.fn() }))

vi.mock('@tanstack/react-query', () => ({
  useMutation: vi.fn(),
  useQuery: mocks.useQuery,
  useQueryClient: vi.fn(),
}))
vi.mock('@frontend/api/apiClient', () => ({ default: { get: vi.fn() } }))
vi.mock('@frontend/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'user-1' } }),
}))

import apiClient from '@frontend/api/apiClient'
import { useVaPrerequisiteGraph } from './useVirginia'

describe('useVaPrerequisiteGraph', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset()
    apiClient.get.mockReset()
    apiClient.get.mockResolvedValue({ data: { courses: [] } })
  })

  it('uses an isolated statewide cache entry and sends no empty query parameters', async () => {
    useVaPrerequisiteGraph()
    const options = mocks.useQuery.mock.calls[0][0]
    expect(options.queryKey).toEqual([
      'va', 'prerequisite-graph:statewide', 'user-1',
    ])
    await options.queryFn()
    expect(apiClient.get).toHaveBeenCalledWith('/va/prerequisite-graph', undefined)
  })

  it('keys and requests a community-college projection by its full name', async () => {
    useVaPrerequisiteGraph({ college: 'Blue Ridge Community College' })
    const options = mocks.useQuery.mock.calls[0][0]
    expect(options.queryKey).toEqual([
      'va', 'prerequisite-graph:college:Blue Ridge Community College', 'user-1',
      { college: 'Blue Ridge Community College' },
    ])
    await options.queryFn()
    expect(apiClient.get).toHaveBeenCalledWith('/va/prerequisite-graph', {
      params: { college: 'Blue Ridge Community College' },
    })
  })

  it('keeps a university transfer-preparation projection separate from college data', async () => {
    useVaPrerequisiteGraph({ university: 'George Mason University' })
    const options = mocks.useQuery.mock.calls[0][0]
    expect(options.queryKey).toEqual([
      'va', 'prerequisite-graph:university:George Mason University', 'user-1',
      { university: 'George Mason University' },
    ])
    await options.queryFn()
    expect(apiClient.get).toHaveBeenCalledWith('/va/prerequisite-graph', {
      params: { university: 'George Mason University' },
    })
  })

  it('keys a college-to-university projection by both selectors', async () => {
    useVaPrerequisiteGraph({
      college: 'Blue Ridge Community College',
      university: 'George Mason University',
    })
    const options = mocks.useQuery.mock.calls[0][0]
    expect(options.queryKey[1]).toBe(
      'prerequisite-graph:pair:Blue Ridge Community College:George Mason University')
    await options.queryFn()
    expect(apiClient.get).toHaveBeenCalledWith('/va/prerequisite-graph', {
      params: {
        college: 'Blue Ridge Community College',
        university: 'George Mason University',
      },
    })
  })
})
