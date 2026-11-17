import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { request } from './client'
import { queryKeys } from './queryKeys'
import type {
  Employee,
  EmployeeFilters,
  EmployeeList,
  EmployeeUpdate,
  NewEmployee,
  Rehire,
} from './types'

const unwrap = async (promise: Promise<{ data: Employee }>) => (await promise).data

export function useEmployees(filters: EmployeeFilters) {
  return useQuery({
    queryKey: queryKeys.employees.list(filters),
    queryFn: ({ signal }) => request<EmployeeList>('/employees', { query: { ...filters }, signal }),
    // Keep showing the previous page while the next one loads, instead of flashing empty.
    placeholderData: keepPreviousData,
  })
}

export function useEmployee(id: number | undefined) {
  return useQuery({
    queryKey: queryKeys.employees.detail(id ?? 0),
    queryFn: ({ signal }) => unwrap(request<{ data: Employee }>(`/employees/${id}`, { signal })),
    enabled: id !== undefined,
  })
}

/**
 * A mutation that changes an employee. Every change refreshes everything
 * under ['employees'] (lists, details, salary histories), which is simpler
 * and safer than patching each cache entry by hand.
 */
function useEmployeeMutation<TVariables>(call: (variables: TVariables) => Promise<Employee>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: call,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.employees.all }),
  })
}

export const useCreateEmployee = () =>
  useEmployeeMutation((employee: NewEmployee) =>
    unwrap(request<{ data: Employee }>('/employees', { method: 'POST', body: { employee } })),
  )

export const useUpdateEmployee = () =>
  useEmployeeMutation(({ id, changes }: { id: number; changes: EmployeeUpdate }) =>
    unwrap(
      request<{ data: Employee }>(`/employees/${id}`, {
        method: 'PATCH',
        body: { employee: changes },
      }),
    ),
  )

export const useTerminateEmployee = () =>
  useEmployeeMutation(({ id, termination_date }: { id: number; termination_date: string }) =>
    unwrap(
      request<{ data: Employee }>(`/employees/${id}/terminate`, {
        method: 'POST',
        body: { termination_date },
      }),
    ),
  )

export const useRehireEmployee = () =>
  useEmployeeMutation(({ id, ...options }: { id: number } & Rehire) =>
    unwrap(
      request<{ data: Employee }>(`/employees/${id}/rehire`, { method: 'POST', body: options }),
    ),
  )

/** Soft delete: the record is hidden, not destroyed, and can be restored. */
export const useDeleteEmployee = () =>
  useEmployeeMutation((id: number) =>
    unwrap(request<{ data: Employee }>(`/employees/${id}`, { method: 'DELETE' })),
  )

export const useRestoreEmployee = () =>
  useEmployeeMutation((id: number) =>
    unwrap(request<{ data: Employee }>(`/employees/${id}/restore`, { method: 'POST' })),
  )
