import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '../../shared/api/apiClient'
import { useAuth } from '../../shared/hooks/useAuth'

const COHORT_QUERY = 'as-degree-validation-cohort'

function cohortQueryKey(uid) {
  return [COHORT_QUERY, uid]
}

/** The team's shared list of community colleges selected for deep validation. */
export function useValidationCohort() {
  const { user } = useAuth()
  return useQuery({
    queryKey: cohortQueryKey(user?.uid),
    queryFn: () => apiClient
      .get('/curated/as-degree-validation-cohort')
      .then((response) => response.data),
    enabled: !!user?.uid,
    staleTime: 60 * 1000,
  })
}

/** Replace the shared cohort and refresh its derived validation progress. */
export function useSetValidationCohort() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ college_ids }) => apiClient
      .put('/curated/as-degree-validation-cohort', { college_ids })
      .then((response) => response.data),
    onSuccess: () => queryClient.invalidateQueries({
      queryKey: cohortQueryKey(user?.uid),
    }),
  })
}

export const _cohortQueryKey = cohortQueryKey
