import type { EmployeeFilters, SummaryParams } from './types'

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
  // Pay figures depend on every employee and salary, so they share one prefix
  // that any change to an employee refreshes.
  analytics: {
    all: ['analytics'] as const,
    summary: (params: SummaryParams) => ['analytics', 'summary', params] as const,
    genderPayGap: () => ['analytics', 'gender_pay_gap'] as const,
    outOfBand: (direction: string, limit: number) =>
      ['analytics', 'out_of_band', direction, limit] as const,
    staleSalaries: (months: number, limit: number) =>
      ['analytics', 'stale_salaries', months, limit] as const,
    questions: () => ['analytics', 'questions'] as const,
    answer: (id: string) => ['analytics', 'answer', id] as const,
  },
  employees: {
    all: ['employees'] as const,
    list: (filters: EmployeeFilters) => ['employees', 'list', filters] as const,
    detail: (id: number) => ['employees', 'detail', id] as const,
    salaryRecords: (id: number) => ['employees', 'salary_records', id] as const,
  },
}
