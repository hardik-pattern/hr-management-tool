import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { buildEmployee, buildSalaryRecord, errorBody } from '../test/fixtures'
import { createWrapper } from '../test/queryWrapper'
import { server } from '../test/server'
import type { ApiError } from './ApiError'
import { useChangeSalary, useSalaryRecords } from './salary'

describe('useSalaryRecords', () => {
  it('returns the history as the API orders it (newest first)', async () => {
    const records = [
      buildSalaryRecord({ id: 2, reason: 'merit' }),
      buildSalaryRecord({ id: 1, reason: 'hire' }),
    ]
    server.use(
      http.get('/api/v1/employees/4/salary_records', () => HttpResponse.json({ data: records })),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSalaryRecords(4), { wrapper })

    await waitFor(() =>
      expect(result.current.data?.map((r) => r.reason)).toEqual(['merit', 'hire']),
    )
  })

  it('waits for an employee id', () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSalaryRecords(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useChangeSalary', () => {
  const change = { amount_cents: 9_000_000, effective_from: '2025-06-01', reason: 'merit' } as const

  it('posts the change and returns the new record with the updated employee', async () => {
    let body: unknown
    server.use(
      http.post('/api/v1/employees/4/salary_changes', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          {
            data: {
              salary_record: buildSalaryRecord({ id: 9, reason: 'merit' }),
              employee: buildEmployee({ id: 4 }),
            },
          },
          { status: 201 },
        )
      }),
    )
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useChangeSalary(), { wrapper })

    let outcome
    await act(async () => {
      outcome = await result.current.mutateAsync({ employeeId: 4, change })
    })

    expect(body).toEqual({ salary_change: change })
    expect(outcome).toMatchObject({ salary_record: { id: 9 }, employee: { id: 4 } })
  })

  it('refreshes the history and the employee after a change', async () => {
    let historyRequests = 0
    server.use(
      http.get('/api/v1/employees/4/salary_records', () => {
        historyRequests += 1
        return HttpResponse.json({ data: [buildSalaryRecord()] })
      }),
      http.post('/api/v1/employees/4/salary_changes', () =>
        HttpResponse.json(
          {
            data: {
              salary_record: buildSalaryRecord({ id: 2 }),
              employee: buildEmployee({ id: 4 }),
            },
          },
          { status: 201 },
        ),
      ),
    )
    const { wrapper } = createWrapper()
    const { result } = renderHook(
      () => ({ history: useSalaryRecords(4), change: useChangeSalary() }),
      {
        wrapper,
      },
    )
    await waitFor(() => expect(result.current.history.isSuccess).toBe(true))

    await act(async () => {
      await result.current.change.mutateAsync({ employeeId: 4, change })
    })

    await waitFor(() => expect(historyRequests).toBe(2))
  })

  it('exposes a refused change with its field errors', async () => {
    server.use(
      http.post('/api/v1/employees/4/salary_changes', () =>
        HttpResponse.json(
          errorBody('validation_failed', 'Validation failed', {
            effective_from: ['cannot be in the future'],
          }),
          { status: 422 },
        ),
      ),
    )
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useChangeSalary(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ employeeId: 4, change }).catch(() => undefined)
    })

    await waitFor(() =>
      expect((result.current.error as ApiError).fieldErrors('effective_from')).toEqual([
        'cannot be in the future',
      ]),
    )
  })
})
