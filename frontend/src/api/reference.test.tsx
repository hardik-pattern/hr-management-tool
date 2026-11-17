import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { createWrapper } from '../test/queryWrapper'
import { server } from '../test/server'
import { useCountries, useCurrencies, useDepartments, useJobTitles } from './reference'

describe('reference data hooks', () => {
  it.each([
    ['countries', useCountries, { id: 1, code: 'US', name: 'United States', currency_code: 'USD' }],
    [
      'currencies',
      useCurrencies,
      { id: 1, code: 'USD', name: 'US Dollar', minor_unit_exponent: 2, rate_to_usd: '1.0' },
    ],
    ['departments', useDepartments, { id: 1, name: 'Engineering' }],
    [
      'job_titles',
      useJobTitles,
      { id: 1, name: 'Staff Engineer', level: 5, department_id: 1, department_name: 'Engineering' },
    ],
  ])('loads %s without the response envelope', async (path, hook, row) => {
    server.use(http.get(`/api/v1/reference/${path}`, () => HttpResponse.json({ data: [row] })))
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => hook(), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual([row]))
  })

  it('is fetched once and then served from the cache', async () => {
    let requests = 0
    server.use(
      http.get('/api/v1/reference/departments', () => {
        requests += 1
        return HttpResponse.json({ data: [{ id: 1, name: 'Engineering' }] })
      }),
    )
    const { wrapper } = createWrapper()

    const first = renderHook(() => useDepartments(), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    const second = renderHook(() => useDepartments(), { wrapper })

    expect(second.result.current.data).toHaveLength(1)
    expect(second.result.current.isFetching).toBe(false)
    expect(requests).toBe(1)
  })
})
