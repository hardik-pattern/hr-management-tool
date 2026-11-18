import { useQuery } from '@tanstack/react-query'
import { request } from './client'
import { queryKeys } from './queryKeys'
import type {
  GenderPayGap,
  OutOfBand,
  QuestionAnswer,
  QuestionInfo,
  StaleSalaries,
  Summary,
  SummaryParams,
} from './types'

/** The summary endpoint takes groupings as one comma separated value. */
function summaryQuery(params: SummaryParams) {
  const { group_by, ...rest } = params
  return { ...rest, group_by: group_by?.join(',') }
}

export function useSummary(params: SummaryParams) {
  return useQuery({
    queryKey: queryKeys.analytics.summary(params),
    queryFn: async ({ signal }) =>
      (
        await request<{ data: Summary }>('/analytics/summary', {
          query: summaryQuery(params),
          signal,
        })
      ).data,
  })
}

export function useGenderPayGap() {
  return useQuery({
    queryKey: queryKeys.analytics.genderPayGap(),
    queryFn: async ({ signal }) =>
      (await request<{ data: GenderPayGap }>('/insights/gender_pay_gap', { signal })).data,
  })
}

export function useOutOfBand(direction: 'any' | 'below' | 'above' = 'any', limit = 50) {
  return useQuery({
    queryKey: queryKeys.analytics.outOfBand(direction, limit),
    queryFn: async ({ signal }) =>
      (
        await request<{ data: OutOfBand }>('/insights/out_of_band', {
          query: { direction, limit },
          signal,
        })
      ).data,
  })
}

export function useStaleSalaries(months = 24, limit = 50) {
  return useQuery({
    queryKey: queryKeys.analytics.staleSalaries(months, limit),
    queryFn: async ({ signal }) =>
      (
        await request<{ data: StaleSalaries }>('/insights/stale_salaries', {
          query: { months, limit },
          signal,
        })
      ).data,
  })
}

export function useQuestions() {
  return useQuery({
    queryKey: queryKeys.analytics.questions(),
    queryFn: async ({ signal }) =>
      (await request<{ data: QuestionInfo[] }>('/questions', { signal })).data,
    // The catalog is fixed, so it is fetched once per session.
    staleTime: Infinity,
  })
}

export function useQuestionAnswer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.analytics.answer(id ?? ''),
    queryFn: async ({ signal }) =>
      (await request<{ data: QuestionAnswer }>(`/questions/${id}/answer`, { signal })).data,
    enabled: id !== undefined,
  })
}
