import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { AnalyticsGroup, AnalyticsMetric, Summary } from '../api/types'
import {
  buildGenderGap,
  buildOutOfBand,
  buildStale,
  buildSummary,
  errorBody,
  outOfBandRow,
  staleRow,
  summaryRow,
} from '../test/fixtures'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/server'
import InsightsPage from './InsightsPage'

const level = (id: number) => ({ id, label: `Level ${id}` })
const levelRow = (id: number, headcount: number, value: number, formatted: string) => ({
  group: { level: level(id) },
  headcount,
  value,
  formatted,
})

/** Answers each summary the way the real API would for the question asked. */
function answer(metric: AnalyticsMetric, groupBy: AnalyticsGroup | null): Summary {
  if (groupBy === null) {
    const total =
      metric === 'sum'
        ? { group: {}, headcount: 9191, value: 489_992_744_87, formatted: '489,992,744.87 USD' }
        : { group: {}, headcount: 9191, value: 4_870_800, formatted: '48,708.00 USD' }
    return buildSummary({ metric, group_by: [], rows: [], total })
  }
  if (groupBy === 'department') {
    return buildSummary({
      metric: 'sum',
      rows: [
        summaryRow('Legal', 4, 100_000, '1,000.00 USD'),
        summaryRow('Engineering', 9, 900_000, '9,000.00 USD'),
      ],
      total: { group: {}, headcount: 13, value: 1_000_000, formatted: '10,000.00 USD' },
    })
  }
  if (groupBy === 'country') {
    return buildSummary({
      metric: 'headcount',
      unit: 'count',
      currency: null,
      group_by: ['country'],
      rows: [
        {
          group: { country: { id: 1, label: 'India' } },
          headcount: 2000,
          value: 2000,
          formatted: '2,000',
        },
        {
          group: { country: { id: 2, label: 'United States' } },
          headcount: 3000,
          value: 3000,
          formatted: '3,000',
        },
      ],
      total: { group: {}, headcount: 5000, value: 5000, formatted: '5,000' },
    })
  }
  const values: Record<string, [number, string]> = {
    p25: [3_000_000, '30,000.00 USD'],
    median: [4_000_000, '40,000.00 USD'],
    p75: [5_500_000, '55,000.00 USD'],
  }
  const [value, formatted] = values[metric]
  return buildSummary({
    metric,
    group_by: ['level'],
    rows: [
      levelRow(1, 700, value, formatted),
      levelRow(2, 500, value + 1_000_000, formatted.replace('0,0', '1,0')),
    ],
  })
}

function serveInsights(
  overrides: {
    gap?: () => Response
    band?: () => Response
    stale?: () => Response
    summary?: () => Response
  } = {},
) {
  server.use(
    http.get('/api/v1/analytics/summary', ({ request }) => {
      if (overrides.summary) return overrides.summary()
      const params = new URL(request.url).searchParams
      return HttpResponse.json({
        data: answer(
          params.get('metric') as AnalyticsMetric,
          (params.get('group_by') as AnalyticsGroup) || null,
        ),
      })
    }),
    http.get(
      '/api/v1/insights/gender_pay_gap',
      () => overrides.gap?.() ?? HttpResponse.json({ data: buildGenderGap() }),
    ),
    http.get(
      '/api/v1/insights/out_of_band',
      () =>
        overrides.band?.() ??
        HttpResponse.json({
          data: buildOutOfBand({
            total: 51,
            below: 26,
            above: 25,
            rows: [outOfBandRow({ id: 1, full_name: 'Underpaid Person' })],
          }),
        }),
    ),
    http.get(
      '/api/v1/insights/stale_salaries',
      () =>
        overrides.stale?.() ??
        HttpResponse.json({
          data: buildStale({
            total: 581,
            rows: [staleRow({ id: 2, full_name: 'Overlooked Person' })],
          }),
        }),
    ),
  )
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/insights" element={<InsightsPage />} />
    </Routes>,
    { route: '/insights' },
  )
}

const section = (name: string) => screen.getByRole('region', { name })

describe('InsightsPage', () => {
  it('shows the headline figures, short to read with the exact amount beside them', async () => {
    serveInsights()
    renderPage()

    expect(await screen.findByText('9,191')).toBeInTheDocument()
    expect(screen.getByText('Active employees')).toBeInTheDocument()
    const payroll = screen.getByText('Total payroll').closest('.card') as HTMLElement
    expect(await within(payroll).findByText('$490M')).toBeInTheDocument()
    expect(
      within(payroll).getByText('489,992,744.87 USD, sum of current salaries'),
    ).toBeInTheDocument()
    const median = screen.getByText('Median salary').closest('.card') as HTMLElement
    expect(within(median).getByText('$48,708')).toBeInTheDocument()
    expect(within(median).getByText('48,708.00 USD, all countries and roles')).toBeInTheDocument()
  })

  it('shows the like-for-like gender gap as a signed percentage', async () => {
    serveInsights()
    renderPage()

    const gap = screen.getByText('Gender pay gap, like for like').closest('.card') as HTMLElement
    expect(await within(gap).findByText('-4.1%')).toBeInTheDocument()
    expect(
      within(gap).getByText('Women compared with men in the same job title and country'),
    ).toBeInTheDocument()
  })

  it('shows a dash for the gap when there is not enough data to compare', async () => {
    serveInsights({
      gap: () =>
        HttpResponse.json({
          data: buildGenderGap({
            adjusted_gap_percent: null,
            unadjusted_gap_percent: null,
            rows: [],
          }),
        }),
    })
    renderPage()

    const gap = screen.getByText('Gender pay gap, like for like').closest('.card') as HTMLElement
    expect(await within(gap).findByText('—')).toBeInTheDocument()
  })

  it('shows a placeholder, not a wrong number, until a figure arrives', async () => {
    serveInsights()
    renderPage()

    expect(screen.getAllByText('…').length).toBeGreaterThan(0)
    await screen.findByText('9,191')
  })

  it('shows payroll by department, largest first', async () => {
    serveInsights()
    renderPage()

    const table = await within(section('Payroll by department')).findByRole('table')
    const names = within(table)
      .getAllByRole('rowheader')
      .map((h) => h.textContent)
    expect(names.slice(0, 2)).toEqual(['Engineering', 'Legal'])
  })

  it('shows people by country, largest first, as counts', async () => {
    serveInsights()
    renderPage()

    const table = await within(section('People by country')).findByRole('table')
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((h) => h.textContent)
        .slice(0, 2),
    ).toEqual(['United States', 'India'])
    expect(within(table).getByText('3,000')).toBeInTheDocument()
  })

  it('shows pay by level with the quartiles and median together', async () => {
    serveInsights()
    renderPage()

    const table = await within(section('Pay by level')).findByRole('table')
    const first = within(table).getAllByRole('row')[1]
    expect(first).toHaveTextContent('Level 1')
    expect(first).toHaveTextContent('700')
    expect(first).toHaveTextContent('30,000.00 USD')
    expect(first).toHaveTextContent('40,000.00 USD')
    expect(first).toHaveTextContent('55,000.00 USD')
  })

  it('shows the gender pay gap summary, and points to every job title', async () => {
    serveInsights()
    renderPage()

    const gap = section('Gender pay gap')
    expect(await within(gap).findByText('Staff Engineer')).toBeInTheDocument()
    expect(within(gap).getByRole('link', { name: 'See every job title' })).toHaveAttribute(
      'href',
      '/questions?question=gender-pay-gap',
    )
  })

  it('shows who is outside their band, with the counts either side', async () => {
    serveInsights()
    renderPage()

    const band = section('Paid outside their band')
    expect(
      await within(band).findByText('26 paid below and 25 paid above their band.'),
    ).toBeInTheDocument()
    expect(within(band).getByRole('link', { name: 'Underpaid Person' })).toHaveAttribute(
      'href',
      '/employees/1',
    )
    expect(within(band).getByText('Showing 1 of 51.')).toBeInTheDocument()
    expect(within(band).getByRole('link', { name: 'See who is paid below band' })).toHaveAttribute(
      'href',
      '/questions?question=paid-below-band',
    )
  })

  it('shows who has had no salary change', async () => {
    serveInsights()
    renderPage()

    const stale = section('No salary change in 24 months')
    expect(await within(stale).findByText('581 employees.')).toBeInTheDocument()
    expect(within(stale).getByRole('link', { name: 'Overlooked Person' })).toBeInTheDocument()
    expect(within(stale).getByRole('link', { name: 'See the full list' })).toHaveAttribute(
      'href',
      '/questions?question=no-raise-24-months',
    )
  })
})

describe('InsightsPage when something fails', () => {
  const broken = () =>
    HttpResponse.json(errorBody('bad_request', 'Something broke'), { status: 400 })

  it('lets the rest of the page load when one section fails, and retries just that one', async () => {
    let calls = 0
    serveInsights({
      gap: () => (++calls === 1 ? broken() : HttpResponse.json({ data: buildGenderGap() })),
    })
    renderPage()

    const gap = section('Gender pay gap')
    const alert = await within(gap).findByRole('alert')
    expect(alert).toHaveTextContent('Could not load the gender pay gap. Something broke')
    expect(await within(section('Payroll by department')).findByRole('table')).toBeInTheDocument()
    expect(
      await within(section('No salary change in 24 months')).findByText('581 employees.'),
    ).toBeInTheDocument()

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await within(gap).findByText('Staff Engineer')).toBeInTheDocument()
    expect(within(gap).queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows each failed section separately', async () => {
    serveInsights({ band: broken, stale: broken })
    renderPage()

    expect(await within(section('Paid outside their band')).findByRole('alert')).toBeInTheDocument()
    expect(
      await within(section('No salary change in 24 months')).findByRole('alert'),
    ).toBeInTheDocument()
    expect(await within(section('Payroll by department')).findByRole('table')).toBeInTheDocument()
  })

  it('reports a failing pay-by-level question once it is known, not a half-empty table', async () => {
    serveInsights({
      summary: () => HttpResponse.json(errorBody('bad_request', 'Nope'), { status: 400 }),
    })
    renderPage()

    expect(await within(section('Pay by level')).findByRole('alert')).toHaveTextContent(
      'Could not load pay by level',
    )
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(1))
  })
})
