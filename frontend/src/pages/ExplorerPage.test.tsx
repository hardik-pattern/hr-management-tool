import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import type { Summary } from '../api/types'
import { buildSummary, errorBody, summaryRow } from '../test/fixtures'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/server'
import ExplorerPage from './ExplorerPage'

function Where() {
  return <p data-testid="where">{useLocation().search}</p>
}

/** Serves summaries from +respond+ and records the query string of every request. */
function serveSummary(
  respond: (params: URLSearchParams) => Summary = () => buildSummary({ metric: 'median' }),
) {
  const searches: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/analytics/summary', ({ request }) => {
      const params = new URL(request.url).searchParams
      searches.push(params)
      return HttpResponse.json({ data: respond(params) })
    }),
  )
  return searches
}

async function renderExplorer(route = '/explorer') {
  const view = renderWithProviders(
    <>
      <Routes>
        <Route path="/explorer" element={<ExplorerPage />} />
      </Routes>
      <Where />
    </>,
    { route },
  )
  await screen.findByRole('option', { name: 'Japan' }) // reference lists are in
  return view
}

const last = (searches: URLSearchParams[]) => searches[searches.length - 1]
const field = (name: string) => screen.getByLabelText(name)

describe('the starting question', () => {
  it('is median pay by department for active employees', async () => {
    const searches = serveSummary()
    await renderExplorer()

    expect(
      await screen.findByRole('table', { name: 'Median pay by department' }),
    ).toBeInTheDocument()
    expect(searches[0].get('metric')).toBe('median')
    expect(searches[0].get('group_by')).toBe('department')
    expect(searches[0].get('status')).toBe('active')
    expect(field('Measure')).toHaveDisplayValue('Median pay')
    expect(field('Group by')).toHaveDisplayValue('Department')
    expect(field('Then by')).toHaveDisplayValue('Nothing')
  })

  it('says in plain words what was asked', async () => {
    serveSummary(() => buildSummary({ metric: 'median' }))
    await renderExplorer()

    const asked = (await screen.findByRole('heading', { name: 'What was asked' }))
      .parentElement as HTMLElement
    expect(asked).toHaveTextContent('Measure: Median pay')
    expect(asked).toHaveTextContent('Grouped by: Department')
    expect(asked).toHaveTextContent('Employees: Active employees')
    expect(asked).toHaveTextContent('Amounts: US dollars (USD)')
  })

  it('shows the answer with the overall figure at the foot', async () => {
    serveSummary()
    await renderExplorer()

    const table = await screen.findByRole('table')
    expect(within(table).getByText('6,000.00 USD')).toBeInTheDocument()
    expect(within(table).getAllByRole('row').at(-1)).toHaveTextContent('8,000.00 USD')
  })
})

describe('choosing the measure and the groupings', () => {
  it('asks for the measure chosen and puts it in the address', async () => {
    const searches = serveSummary()
    await renderExplorer()

    await userEvent.selectOptions(field('Measure'), 'Highest pay')

    await waitFor(() => expect(last(searches).get('metric')).toBe('max'))
    expect(screen.getByTestId('where')).toHaveTextContent('?metric=max')
  })

  it('groups by one thing, then offers a second that cannot repeat the first', async () => {
    const searches = serveSummary()
    await renderExplorer()

    await userEvent.selectOptions(field('Group by'), 'Country')
    await waitFor(() => expect(last(searches).get('group_by')).toBe('country'))

    const second = within(field('Then by'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(second).toEqual(['Nothing', 'Department', 'Job title', 'Gender', 'Level'])

    await userEvent.selectOptions(field('Then by'), 'Gender')
    await waitFor(() => expect(last(searches).get('group_by')).toBe('country,gender'))
  })

  it('cannot add a second grouping until there is a first', async () => {
    serveSummary()
    await renderExplorer('/explorer?group_by=')

    expect(field('Group by')).toHaveDisplayValue('Nothing (one overall figure)')
    expect(field('Then by')).toBeDisabled()
  })

  it('clears the second grouping when the first is cleared', async () => {
    const searches = serveSummary()
    await renderExplorer('/explorer?group_by=country,gender')
    expect(field('Then by')).toHaveDisplayValue('Gender')

    await userEvent.selectOptions(field('Group by'), 'Nothing (one overall figure)')

    await waitFor(() => expect(last(searches).has('group_by')).toBe(false))
    expect(field('Then by')).toBeDisabled()
  })

  it('shows just the overall figure when nothing is grouped', async () => {
    serveSummary(() =>
      buildSummary({
        metric: 'median',
        group_by: [],
        rows: [],
        total: { group: {}, headcount: 9191, value: 4_870_800, formatted: '48,708.00 USD' },
      }),
    )
    await renderExplorer('/explorer?group_by=')

    const table = await screen.findByRole('table', { name: 'Median pay' })
    expect(within(table).getAllByRole('row').at(-1)).toHaveTextContent('Everyone')
    expect(within(table).getAllByRole('row').at(-1)).toHaveTextContent('48,708.00 USD')
  })
})

describe('choosing who is included', () => {
  it('filters by country, gender, level and status', async () => {
    const searches = serveSummary()
    await renderExplorer()

    await userEvent.selectOptions(field('Country'), 'Japan')
    await userEvent.selectOptions(field('Gender'), 'Women')
    await userEvent.selectOptions(field('Level'), 'Level 3')
    await userEvent.selectOptions(field('Employees'), 'Employees who have left')

    await waitFor(() => {
      const params = last(searches)
      expect(params.get('country_id')).toBe('2')
      expect(params.get('gender')).toBe('female')
      expect(params.get('level')).toBe('3')
      expect(params.get('status')).toBe('terminated')
    })
  })

  it('offers only the job titles of the chosen department', async () => {
    serveSummary()
    await renderExplorer()

    await userEvent.selectOptions(field('Department'), 'Sales')

    const titles = within(field('Job title'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(titles).toEqual(['All job titles', 'Account Executive'])
  })

  it('drops a chosen job title that does not belong to the new department', async () => {
    const searches = serveSummary()
    await renderExplorer('/explorer?department_id=1&job_title_id=2')
    expect(field('Job title')).toHaveDisplayValue('Staff Engineer')

    await userEvent.selectOptions(field('Department'), 'Sales')

    await waitFor(() => expect(last(searches).get('department_id')).toBe('2'))
    expect(last(searches).has('job_title_id')).toBe(false)
  })

  it('names the filters in plain words in what was asked', async () => {
    serveSummary(() =>
      buildSummary({
        metric: 'median',
        filters: { country_id: 2, department_id: 1, gender: 'female', level: 3 },
      }),
    )
    await renderExplorer('/explorer?country_id=2&department_id=1&gender=female&level=3')

    const asked = (await screen.findByRole('heading', { name: 'What was asked' }))
      .parentElement as HTMLElement
    expect(asked).toHaveTextContent('Only in country: Japan')
    expect(asked).toHaveTextContent('Only in department: Engineering')
    expect(asked).toHaveTextContent('Only: Women')
    expect(asked).toHaveTextContent('Only level: 3')
  })
})

describe('the address and resetting', () => {
  it('starts from the question in the address', async () => {
    const searches = serveSummary()
    await renderExplorer('/explorer?metric=iqr&group_by=level&status=all')

    await screen.findByRole('table')
    expect(searches[0].get('metric')).toBe('iqr')
    expect(searches[0].get('group_by')).toBe('level')
    expect(searches[0].get('status')).toBe('all')
    expect(field('Measure')).toHaveDisplayValue('Pay spread (75th minus 25th percentile)')
  })

  it('offers Reset only once the question has changed, and returns to the start', async () => {
    const searches = serveSummary()
    await renderExplorer()
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()

    await userEvent.selectOptions(field('Measure'), 'Highest pay')
    await userEvent.click(await screen.findByRole('button', { name: 'Reset' }))

    await waitFor(() => expect(last(searches).get('metric')).toBe('median'))
    expect(field('Measure')).toHaveDisplayValue('Median pay')
    expect(screen.getByTestId('where')).toHaveTextContent('')
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })
})

describe('reading the answer', () => {
  it('can put the largest first without asking the server again', async () => {
    const searches = serveSummary(() =>
      buildSummary({
        rows: [summaryRow('Alpha', 1, 100, '1.00 USD'), summaryRow('Beta', 1, 300, '3.00 USD')],
      }),
    )
    await renderExplorer()
    const names = () => screen.getAllByRole('rowheader').map((h) => h.textContent)
    await waitFor(() => expect(names().slice(0, 2)).toEqual(['Alpha', 'Beta']))
    const requests = searches.length

    await userEvent.click(screen.getByLabelText('Largest first'))

    expect(names().slice(0, 2)).toEqual(['Beta', 'Alpha'])
    expect(searches.length).toBe(requests)
  })

  it('says so when nobody matches', async () => {
    serveSummary(() =>
      buildSummary({ rows: [], total: { group: {}, headcount: 0, value: null, formatted: null } }),
    )
    await renderExplorer()

    expect(await screen.findByText('No employees match.')).toBeInTheDocument()
  })
})

describe('when the question is refused or fails', () => {
  it('shows the problem and retries', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/analytics/summary', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(errorBody('bad_request', 'metric must be one of: a, b'), {
              status: 400,
            })
          : HttpResponse.json({ data: buildSummary() })
      }),
    )
    await renderExplorer()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load the answer. metric must be one of')
    expect(field('Measure')).toBeInTheDocument()

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})
