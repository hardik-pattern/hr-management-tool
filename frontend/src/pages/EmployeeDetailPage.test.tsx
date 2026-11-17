import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { buildEmployee, buildSalaryRecord, errorBody } from '../test/fixtures'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/server'
import EmployeeDetailPage from './EmployeeDetailPage'

const history = [
  buildSalaryRecord({
    id: 3,
    amount_cents: 6_600_000,
    effective_from: '2025-04-01',
    reason: 'promotion',
    formatted: '66,000.00 USD',
  }),
  buildSalaryRecord({
    id: 2,
    amount_cents: 6_000_000,
    effective_from: '2024-09-01',
    reason: 'merit',
    formatted: '60,000.00 USD',
  }),
  buildSalaryRecord({
    id: 1,
    amount_cents: 5_000_000,
    effective_from: '2024-03-01',
    reason: 'hire',
    formatted: '50,000.00 USD',
  }),
]

function serveEmployee(employee = buildEmployee({ id: 7 }), records = history) {
  server.use(
    http.get('/api/v1/employees/7', () => HttpResponse.json({ data: employee })),
    http.get('/api/v1/employees/7/salary_records', () => HttpResponse.json({ data: records })),
  )
}

function renderDetail(
  route: Parameters<typeof renderWithProviders>[1] = { route: '/employees/7' },
) {
  return renderWithProviders(
    <Routes>
      <Route path="/employees/:id" element={<EmployeeDetailPage />} />
    </Routes>,
    route,
  )
}

describe('EmployeeDetailPage', () => {
  it('shows a loading indicator, then the employee', async () => {
    serveEmployee()
    renderDetail()

    expect(screen.getByRole('status')).toHaveTextContent('Loading employee')
    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument()
  })

  it('shows the profile', async () => {
    serveEmployee()
    renderDetail()

    await screen.findByRole('heading', { name: 'Asha Rao' })
    const profile = screen.getByRole('heading', { name: 'Profile' }).closest('.card') as HTMLElement
    for (const text of [
      'E000001',
      'asha.rao@acme.test',
      'Female',
      'Engineering',
      'Software Engineer',
      'United States',
      '1 Mar 2024',
      'Active',
    ]) {
      expect(within(profile).getByText(text)).toBeInTheDocument()
    }
  })

  it('shows the current salary, and since when it applies', async () => {
    serveEmployee(
      buildEmployee({
        id: 7,
        salary: { amount_cents: 6_600_000, currency: 'USD', formatted: '66,000.00 USD' },
      }),
    )
    renderDetail()

    expect(await screen.findByLabelText('Current salary')).toHaveTextContent('66,000.00 USD')
    expect(await screen.findByText('Since 1 Apr 2025')).toBeInTheDocument()
  })

  it('lists the salary history newest first, with reasons and the change from the previous entry', async () => {
    serveEmployee()
    renderDetail()

    const table = await screen.findByRole('table', { name: 'Salary history, newest first' })
    const rows = within(table).getAllByRole('row').slice(1)
    const cells = rows.map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    )

    expect(cells).toEqual([
      ['1 Apr 2025', 'Promotion', '66,000.00 USD', '+10.0%'],
      ['1 Sept 2024', 'Merit increase', '60,000.00 USD', '+20.0%'],
      ['1 Mar 2024', 'Hire', '50,000.00 USD', '—'],
    ])
  })

  it('shows when a terminated employee left', async () => {
    serveEmployee(buildEmployee({ id: 7, status: 'terminated', termination_date: '2025-05-31' }))
    renderDetail()

    expect(await screen.findByText('Terminated')).toBeInTheDocument()
    expect(screen.getByText('Left on 31 May 2025')).toBeInTheDocument()
  })

  it('shows non-binary and undisclosed genders readably', async () => {
    serveEmployee(buildEmployee({ id: 7, gender: 'non_binary' }))
    renderDetail()

    expect(await screen.findByText('Non-binary')).toBeInTheDocument()
  })

  it('says so when there are no salary records', async () => {
    serveEmployee(buildEmployee({ id: 7 }), [])
    renderDetail()

    expect(await screen.findByText('No salary records.')).toBeInTheDocument()
  })
})

describe('EmployeeDetailPage navigation', () => {
  it('goes back to the list with the filters and sort it was opened from', async () => {
    serveEmployee()
    renderDetail({
      route: { pathname: '/employees/7', state: { listSearch: '?q=asha&sort=-hire_date' } },
    })
    await screen.findByRole('heading', { name: 'Asha Rao' })

    expect(screen.getByRole('link', { name: /Back to employees/ })).toHaveAttribute(
      'href',
      '/employees?q=asha&sort=-hire_date',
    )
  })

  it('goes back to the plain list when opened directly', async () => {
    serveEmployee()
    renderDetail()
    await screen.findByRole('heading', { name: 'Asha Rao' })

    expect(screen.getByRole('link', { name: /Back to employees/ })).toHaveAttribute(
      'href',
      '/employees',
    )
  })
})

describe('EmployeeDetailPage problems', () => {
  it('says the employee was not found for an unknown or deleted id', async () => {
    server.use(
      http.get('/api/v1/employees/7', () =>
        HttpResponse.json(errorBody('not_found', 'Employee not found'), { status: 404 }),
      ),
      http.get('/api/v1/employees/7/salary_records', () =>
        HttpResponse.json(errorBody('not_found', 'Employee not found'), { status: 404 }),
      ),
    )
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Employee not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Back to employees/ })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not call the API for an address that is not a valid id', async () => {
    renderDetail({ route: '/employees/abc' })

    expect(await screen.findByRole('heading', { name: 'Employee not found' })).toBeInTheDocument()
  })

  it('shows a retryable error when the employee cannot be loaded', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/employees/7', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(errorBody('bad_request', 'Something broke'), { status: 400 })
          : HttpResponse.json({ data: buildEmployee({ id: 7 }) })
      }),
      http.get('/api/v1/employees/7/salary_records', () => HttpResponse.json({ data: history })),
    )
    renderDetail()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load this employee. Something broke')

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument()
  })

  it('still shows the profile when only the salary history fails, and lets you retry it', async () => {
    let historyCalls = 0
    server.use(
      http.get('/api/v1/employees/7', () => HttpResponse.json({ data: buildEmployee({ id: 7 }) })),
      http.get('/api/v1/employees/7/salary_records', () => {
        historyCalls += 1
        return historyCalls === 1
          ? HttpResponse.json(errorBody('bad_request', 'History unavailable'), { status: 400 })
          : HttpResponse.json({ data: history })
      }),
    )
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument()
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load the salary history')

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(
      await screen.findByRole('table', { name: 'Salary history, newest first' }),
    ).toBeInTheDocument()
  })

  it('shows a banner for a deleted employee', async () => {
    serveEmployee(buildEmployee({ id: 7, deleted_at: '2025-06-01T10:00:00.000Z' }))
    renderDetail()

    expect(await screen.findByText(/deleted on 1 Jun 2025/)).toBeInTheDocument()
  })
})
