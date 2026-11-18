import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from './client'
import { queryKeys } from './queryKeys'
import type { SalaryChange, SalaryChangeResult, SalaryRecord } from './types'

/** Newest first, as the API returns it. */
export function useSalaryRecords(employeeId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.employees.salaryRecords(employeeId ?? 0),
    queryFn: async ({ signal }) =>
      (
        await request<{ data: SalaryRecord[] }>(`/employees/${employeeId}/salary_records`, {
          signal,
        })
      ).data,
    enabled: employeeId !== undefined,
  })
}

export function useChangeSalary() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ employeeId, change }: { employeeId: number; change: SalaryChange }) =>
      (
        await request<{ data: SalaryChangeResult }>(`/employees/${employeeId}/salary_changes`, {
          method: 'POST',
          body: { salary_change: change },
        })
      ).data,
    // The list shows current salary and the detail shows history; refresh both.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all }),
      ]),
  })
}
