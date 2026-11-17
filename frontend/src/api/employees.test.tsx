import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { buildEmployee, errorBody } from '../test/fixtures'
import { createWrapper } from '../test/queryWrapper'
import { server } from '../test/server'
import { ApiError } from './ApiError'
import {
  useCreateEmployee,
  useDeleteEmployee,
  useEmployee,
  useEmployees,
  useRehireEmployee,
  useRestoreEmployee,
  useTerminateEmployee,
  useUpdateEmployee,
} from './employees'
import type { NewEmployee } from './types'

const newEmployee: NewEmployee = {
  full_name: 'Asha Rao',
  email: 'asha.rao@acme.test',
  gender: 'female',
  hire_date: '2024-03-01',
  country_id: 1,
  department_id: 1,
  job_title_id: 1,
  salary_cents: 8_000_000,
}

describe('useEmployees', () => {
  it('returns the page and its metadata', async () => {
    const meta = { total: 1, per_page: 25, next_cursor: null }
    server.use(
      http.get('/api/v1/employees', () => HttpResponse.json({ data: [buildEmployee()], meta })),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useEmployees({}), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.data[0].full_name).toBe('Asha Rao')
    expect(result.current.data?.meta).toEqual(meta)
  })

  it('sends the filters it is given and drops the empty ones', async () => {
    let search = ''
    server.use(
      http.get('/api/v1/employees', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({ data: [], meta: { total: 0, per_page: 25, next_cursor: null } })
      }),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(
      () => useEmployees({ q: 'asha', status: 'all', sort: '-hire_date', country_id: undefined }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(search).toBe('?q=asha&status=all&sort=-hire_date')
  })

  it('keeps the previous page on screen while the next one loads', async () => {
    server.use(
      http.get('/api/v1/employees', ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor')
        const name = cursor ? 'Second' : 'First'
        return HttpResponse.json({
          data: [buildEmployee({ full_name: name })],
          meta: { total: 2, per_page: 1, next_cursor: cursor ? null : 'abc' },
        })
      }),
    )
    const { wrapper } = createWrapper()

    const { result, rerender } = renderHook(({ cursor }) => useEmployees({ cursor }), {
      wrapper,
      initialProps: { cursor: undefined as string | undefined },
    })
    await waitFor(() => expect(result.current.data?.data[0].full_name).toBe('First'))

    rerender({ cursor: 'abc' })

    expect(result.current.data?.data[0].full_name).toBe('First')
    expect(result.current.isPlaceholderData).toBe(true)
    await waitFor(() => expect(result.current.data?.data[0].full_name).toBe('Second'))
  })

  it('surfaces a bad request as an ApiError', async () => {
    server.use(
      http.get('/api/v1/employees', () =>
        HttpResponse.json(errorBody('bad_request', 'unknown parameter(s): contry_id'), {
          status: 400,
        }),
      ),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useEmployees({}), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error).toMatchObject({ status: 400, code: 'bad_request' })
  })
})

describe('useEmployee', () => {
  it('returns the employee without the response envelope', async () => {
    server.use(
      http.get('/api/v1/employees/7', () =>
        HttpResponse.json({ data: buildEmployee({ id: 7, full_name: 'Seven' }) }),
      ),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useEmployee(7), { wrapper })

    await waitFor(() => expect(result.current.data?.full_name).toBe('Seven'))
  })

  it('reports a missing employee as not found', async () => {
    server.use(
      http.get('/api/v1/employees/9', () =>
        HttpResponse.json(errorBody('not_found', 'Employee not found'), { status: 404 }),
      ),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useEmployee(9), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as ApiError).isNotFound).toBe(true)
  })

  it('does not call the API until it has an id', async () => {
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useEmployee(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCreateEmployee', () => {
  it('posts the employee wrapped as the API expects and returns the created employee', async () => {
    let body: unknown
    server.use(
      http.post('/api/v1/employees', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ data: buildEmployee({ id: 5 }) }, { status: 201 })
      }),
    )
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateEmployee(), { wrapper })

    let created
    await act(async () => {
      created = await result.current.mutateAsync(newEmployee)
    })

    expect(body).toEqual({ employee: newEmployee })
    expect(created).toMatchObject({ id: 5 })
  })

  it('exposes field errors from a rejected employee', async () => {
    server.use(
      http.post('/api/v1/employees', () =>
        HttpResponse.json(
          errorBody('validation_failed', 'Validation failed', {
            email: ['has already been taken'],
          }),
          { status: 422 },
        ),
      ),
    )
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useCreateEmployee(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync(newEmployee).catch(() => undefined)
    })

    await waitFor(() =>
      expect((result.current.error as ApiError).fieldErrors('email')).toEqual([
        'has already been taken',
      ]),
    )
  })

  it('refreshes employee lists afterwards', async () => {
    let listRequests = 0
    server.use(
      http.get('/api/v1/employees', () => {
        listRequests += 1
        return HttpResponse.json({ data: [], meta: { total: 0, per_page: 25, next_cursor: null } })
      }),
      http.post('/api/v1/employees', () =>
        HttpResponse.json({ data: buildEmployee() }, { status: 201 }),
      ),
    )
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => ({ list: useEmployees({}), create: useCreateEmployee() }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true))
    expect(listRequests).toBe(1)

    await act(async () => {
      await result.current.create.mutateAsync(newEmployee)
    })

    await waitFor(() => expect(listRequests).toBe(2))
  })
})

describe('employee change mutations', () => {
  interface Seen {
    method: string
    path: string
    body: unknown
  }

  function recordCall(seen: Seen[]) {
    return http.all('/api/v1/employees/*', async ({ request }) => {
      const text = await request.text()
      seen.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: text ? JSON.parse(text) : undefined,
      })
      return HttpResponse.json({ data: buildEmployee({ id: 3 }) })
    })
  }

  it('updates profile fields with PATCH', async () => {
    const seen: Seen[] = []
    server.use(recordCall(seen))
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useUpdateEmployee(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 3, changes: { full_name: 'New Name' } })
    })

    expect(seen).toEqual([
      {
        method: 'PATCH',
        path: '/api/v1/employees/3',
        body: { employee: { full_name: 'New Name' } },
      },
    ])
  })

  it('terminates with a date', async () => {
    const seen: Seen[] = []
    server.use(recordCall(seen))
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTerminateEmployee(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 3, termination_date: '2025-06-01' })
    })

    expect(seen).toEqual([
      {
        method: 'POST',
        path: '/api/v1/employees/3/terminate',
        body: { termination_date: '2025-06-01' },
      },
    ])
  })

  it('rehires with an optional new salary', async () => {
    const seen: Seen[] = []
    server.use(recordCall(seen))
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useRehireEmployee(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 3, salary_cents: 9_000_000 })
    })

    expect(seen).toEqual([
      { method: 'POST', path: '/api/v1/employees/3/rehire', body: { salary_cents: 9_000_000 } },
    ])
  })

  it('soft-deletes with DELETE and restores with POST', async () => {
    const seen: Seen[] = []
    server.use(recordCall(seen))
    const { wrapper } = createWrapper()
    const { result } = renderHook(
      () => ({ del: useDeleteEmployee(), restore: useRestoreEmployee() }),
      {
        wrapper,
      },
    )

    await act(async () => {
      await result.current.del.mutateAsync(3)
      await result.current.restore.mutateAsync(3)
    })

    expect(seen).toEqual([
      { method: 'DELETE', path: '/api/v1/employees/3', body: undefined },
      { method: 'POST', path: '/api/v1/employees/3/restore', body: undefined },
    ])
  })

  it('exposes a refusal such as terminating twice', async () => {
    server.use(
      http.post('/api/v1/employees/3/terminate', () =>
        HttpResponse.json(
          errorBody('validation_failed', 'Validation failed', { base: ['is already terminated'] }),
          { status: 422 },
        ),
      ),
    )
    const { wrapper } = createWrapper()
    const { result } = renderHook(() => useTerminateEmployee(), { wrapper })

    await act(async () => {
      await result.current
        .mutateAsync({ id: 3, termination_date: '2025-06-01' })
        .catch(() => undefined)
    })

    await waitFor(() =>
      expect((result.current.error as ApiError).fieldErrors('base')).toEqual([
        'is already terminated',
      ]),
    )
  })
})
