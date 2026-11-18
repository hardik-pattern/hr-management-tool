import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import {
  buildAnswer,
  buildEmployee,
  buildGenderGap,
  buildOutOfBand,
  buildStale,
  buildSummary,
  errorBody,
  questionList,
} from '../test/fixtures'
import { createWrapper } from '../test/queryWrapper'
import { server } from '../test/server'
import {
  useGenderPayGap,
  useOutOfBand,
  useQuestionAnswer,
  useQuestions,
  useStaleSalaries,
  useSummary,
} from './analytics'
import { useDeleteEmployee } from './employees'

describe('useSummary', () => {
  it('asks for the metric, groupings as one comma separated value, and filters, leaving out what is empty', async () => {
    let search = ''
    server.use(
      http.get('/api/v1/analytics/summary', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({ data: buildSummary() })
      }),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(
      () =>
        useSummary({
          metric: 'median',
          group_by: ['department', 'country'],
          country_id: 3,
          status: undefined,
        }),
      { wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(search).toBe('?metric=median&country_id=3&group_by=department%2Ccountry')
    expect(result.current.data?.total.formatted).toBe('8,000.00 USD')
  })

  it('sends no grouping when none is chosen', async () => {
    let search = ''
    server.use(
      http.get('/api/v1/analytics/summary', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({ data: buildSummary() })
      }),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSummary({ metric: 'headcount', group_by: [] }), {
      wrapper,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(search).toBe('?metric=headcount')
  })

  it('surfaces a refused question as an ApiError', async () => {
    server.use(
      http.get('/api/v1/analytics/summary', () =>
        HttpResponse.json(errorBody('bad_request', 'metric must be one of: a'), { status: 400 }),
      ),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useSummary({ metric: 'median' }), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 400, code: 'bad_request' })
  })
})

describe('the insight hooks', () => {
  it('load the gender pay gap', async () => {
    server.use(
      http.get('/api/v1/insights/gender_pay_gap', () =>
        HttpResponse.json({ data: buildGenderGap() }),
      ),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useGenderPayGap(), { wrapper })

    await waitFor(() => expect(result.current.data?.adjusted_gap_percent).toBe(-4.1))
  })

  it('ask for who is outside their band, in a direction and up to a limit', async () => {
    let search = ''
    server.use(
      http.get('/api/v1/insights/out_of_band', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({ data: buildOutOfBand() })
      }),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useOutOfBand('below', 5), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(search).toBe('?direction=below&limit=5')
  })

  it('ask for who has gone without a salary change, for a period and up to a limit', async () => {
    let search = ''
    server.use(
      http.get('/api/v1/insights/stale_salaries', ({ request }) => {
        search = new URL(request.url).search
        return HttpResponse.json({ data: buildStale() })
      }),
    )
    const { wrapper } = createWrapper()

    const { result } = renderHook(() => useStaleSalaries(12, 5), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(search).toBe('?months=12&limit=5')
  })
})

describe('the questions hooks', () => {
  it('list the catalog, fetched once', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/questions', () => {
        calls += 1
        return HttpResponse.json({ data: questionList })
      }),
    )
    const { wrapper } = createWrapper()

    const first = renderHook(() => useQuestions(), { wrapper })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))
    renderHook(() => useQuestions(), { wrapper })

    expect(first.result.current.data).toHaveLength(4)
    expect(calls).toBe(1)
  })

  it('answer one question, and wait for an id', async () => {
    server.use(
      http.get('/api/v1/questions/gender-pay-gap/answer', () =>
        HttpResponse.json({ data: buildAnswer('gender-pay-gap') }),
      ),
    )
    const { wrapper } = createWrapper()

    const idle = renderHook(() => useQuestionAnswer(undefined), { wrapper })
    expect(idle.result.current.fetchStatus).toBe('idle')

    const { result } = renderHook(() => useQuestionAnswer('gender-pay-gap'), { wrapper })
    await waitFor(() => expect(result.current.data?.kind).toBe('gender_pay_gap'))
  })
})

describe('keeping the figures fresh', () => {
  it('refreshes pay figures after an employee is changed, since they summarise everyone', async () => {
    let summaryCalls = 0
    server.use(
      http.get('/api/v1/analytics/summary', () => {
        summaryCalls += 1
        return HttpResponse.json({ data: buildSummary() })
      }),
      http.delete('/api/v1/employees/3', () =>
        HttpResponse.json({ data: buildEmployee({ id: 3 }) }),
      ),
    )
    const { wrapper } = createWrapper()
    const { result } = renderHook(
      () => ({ summary: useSummary({ metric: 'sum' }), remove: useDeleteEmployee() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.summary.isSuccess).toBe(true))
    expect(summaryCalls).toBe(1)

    await act(async () => {
      await result.current.remove.mutateAsync(3)
    })

    await waitFor(() => expect(summaryCalls).toBe(2))
  })
})
