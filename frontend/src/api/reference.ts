import { useQuery } from '@tanstack/react-query'
import { request } from './client'
import { queryKeys } from './queryKeys'
import type { Country, Currency, Department, JobTitle } from './types'

// Lookup lists change rarely, so they are cached for the whole session.
const STALE_FOREVER = Infinity

function useReferenceList<T>(key: readonly string[], path: string) {
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => (await request<{ data: T[] }>(path, { signal })).data,
    staleTime: STALE_FOREVER,
  })
}

export const useCountries = () =>
  useReferenceList<Country>(queryKeys.reference.countries(), '/reference/countries')

export const useCurrencies = () =>
  useReferenceList<Currency>(queryKeys.reference.currencies(), '/reference/currencies')

export const useDepartments = () =>
  useReferenceList<Department>(queryKeys.reference.departments(), '/reference/departments')

export const useJobTitles = () =>
  useReferenceList<JobTitle>(queryKeys.reference.jobTitles(), '/reference/job_titles')
