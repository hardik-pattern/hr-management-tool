import type { EmployeeFilters } from './types'

// One place for cache keys so invalidation cannot drift from the queries.
// Everything about employees shares the ['employees'] prefix, so a single
// invalidation after any change refreshes lists, details and histories.
export const queryKeys = {
  reference: {
    all: ['reference'] as const,
    countries: () => ['reference', 'countries'] as const,
    currencies: () => ['reference', 'currencies'] as const,
    departments: () => ['reference', 'departments'] as const,
    jobTitles: () => ['reference', 'job_titles'] as const,
  },
  employees: {
    all: ['employees'] as const,
    list: (filters: EmployeeFilters) => ['employees', 'list', filters] as const,
    detail: (id: number) => ['employees', 'detail', id] as const,
    salaryRecords: (id: number) => ['employees', 'salary_records', id] as const,
  },
}
