import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { todayIso } from '../lib/format'
import { buildEmployee, buildSalaryRecord, errorBody } from '../test/fixtures'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/server'
import EmployeeDetailPage from './EmployeeDetailPage'

const money = (cents: number, code: string, formatted: string) => ({
  amount_cents: cents,
  currency: code,
  formatted,
})
const usd = money(7_500_000, 'USD', '75,000.00 USD')
const yen = money(8_000_000, 'JPY', '8,000,000 JPY')

const hireRecord = buildSalaryRecord({
  id: 1,
  effective_from: '2024-03-01',
  reason: 'hire',
  ...usd,
})
const latestRecord = buildSalaryRecord({
  id: 2,
  effective_from: '2025-01-15',
  reason: 'merit',
  ...usd,
})

interface Posted {
  body: unknown
}

/**
 * Serves employee 7 with the given salary and history. A successful change
 * updates both, as the real API would, and the POST bodies are recorded.
 */
function serve(
  options: { salary?: typeof usd; status?: 'active' | 'terminated'; failure?: Response } = {},
) {
  const { salary = usd, status = 'active', failure } = options
  let employee = buildEmployee({
    id: 7,
    hire_date: '2024-03-01',
    status,
    salary,
    termination_date: status === 'terminated' ? '2025-02-01' : null,
  })
  let history = [latestRecord, hireRecord]
  const posted: Posted[] = []

  server.use(
    http.get('/api/v1/employees/7', () => HttpResponse.json({ data: employee })),
    http.get('/api/v1/employees/7/salary_records', () => HttpResponse.json({ data: history })),
    http.post('/api/v1/employees/7/salary_changes', async ({ request }) => {
      const body = (await request.json()) as {
        salary_change: { amount_cents: number; effective_from: string; reason: string }
      }
      posted.push({ body })
      if (failure) return failure.clone()
      const change = body.salary_change
      const formatted = `${(change.amount_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${salary.currency}`
      employee = {
        ...employee,
        salary: { ...salary, amount_cents: change.amount_cents, formatted },
      }
      const record = buildSalaryRecord({
        id: 3,
        effective_from: change.effective_from,
        reason: change.reason as 'merit',
        amount_cents: change.amount_cents,
        currency: salary.currency,
        formatted,
      })
      history = [record, ...history]
      return HttpResponse.json({ data: { salary_record: record, employee } }, { status: 201 })
    }),
  )
  return posted
}

async function renderDetail() {
  renderWithProviders(
    <Routes>
      <Route path="/employees/:id" element={<EmployeeDetailPage />} />
    </Routes>,
    { route: '/employees/7' },
  )
  await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })
  // The dialog needs the history, to know the earliest date it can use.
  await screen.findByRole('table', { name: 'Salary history, newest first' })
}

async function openDialog() {
  await renderDetail()
  await userEvent.click(screen.getByRole('button', { name: 'Change salary' }))
  return screen.getByRole('dialog')
}

const submit = (dialog: HTMLElement) =>
  userEvent.click(within(dialog).getByRole('button', { name: 'Change salary' }))
const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

describe('the Change salary button', () => {
  it('is offered for an active employee', async () => {
    serve()
    await renderDetail()

    expect(screen.getByRole('button', { name: 'Change salary' })).toBeInTheDocument()
  })

  it('is not offered for a terminated employee, whose salary the API will not change', async () => {
    serve({ status: 'terminated' })
    await renderDetail()

    expect(screen.queryByRole('button', { name: 'Change salary' })).not.toBeInTheDocument()
  })
})

describe('the dialog', () => {
  it('shows the current salary and the currency, which cannot be changed', async () => {
    serve()
    const dialog = await openDialog()

    expect(within(dialog).getByText('Change salary for Asha Rao')).toBeInTheDocument()
    expect(within(dialog).getByText('75,000.00 USD')).toBeInTheDocument()
    expect(within(dialog).getByText('USD')).toBeInTheDocument()
  })

  it('starts today, with merit as the reason, and cannot start before the latest record', async () => {
    serve()
    const dialog = await openDialog()

    const starts = within(dialog).getByLabelText('Starts')
    expect(starts).toHaveValue(todayIso())
    expect(starts).toHaveAttribute('min', '2025-01-15')
    expect(starts).toHaveAttribute('max', todayIso())
    expect(within(dialog).getByLabelText('Reason')).toHaveDisplayValue('Merit increase')
  })

  it('offers only the reasons the API accepts for a change', async () => {
    serve()
    const dialog = await openDialog()

    const reasons = within(within(dialog).getByLabelText('Reason'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(reasons).toEqual(['Merit increase', 'Promotion', 'Adjustment', 'Correction'])
  })

  it('previews the size of the change as the amount is typed', async () => {
    serve()
    const dialog = await openDialog()
    const amount = within(dialog).getByLabelText('New salary')

    await userEvent.type(amount, '82500')
    expect(within(dialog).getByText('+10.0% from 75,000.00 USD')).toBeInTheDocument()

    await userEvent.clear(amount)
    await userEvent.type(amount, '71250')
    expect(within(dialog).getByText('-5.0% from 75,000.00 USD')).toBeInTheDocument()

    await userEvent.clear(amount)
    await userEvent.type(amount, '75000')
    expect(within(dialog).getByText('No change from 75,000.00 USD')).toBeInTheDocument()
  })

  it('shows no preview for an empty or invalid amount', async () => {
    serve()
    const dialog = await openDialog()
    const amount = within(dialog).getByLabelText('New salary')

    await userEvent.type(amount, 'abc')

    expect(within(dialog).queryByText(/from 75,000.00 USD/)).not.toBeInTheDocument()
  })
})

describe('saving a change', () => {
  it('sends the amount in minor units, the date and the reason, then shows the new salary and history', async () => {
    const posted = serve()
    const dialog = await openDialog()

    await userEvent.type(within(dialog).getByLabelText('New salary'), '82500.5')
    await userEvent.selectOptions(within(dialog).getByLabelText('Reason'), 'Promotion')
    await submit(dialog)

    await closed()
    expect(posted).toEqual([
      {
        body: {
          salary_change: {
            amount_cents: 8_250_050,
            effective_from: todayIso(),
            reason: 'promotion',
          },
        },
      },
    ])
    expect(await screen.findByText('Salary changed to 82,500.50 USD.')).toBeInTheDocument()
    expect(await screen.findByLabelText('Current salary')).toHaveTextContent('82,500.50 USD')
    const table = screen.getByRole('table', { name: 'Salary history, newest first' })
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(4))
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Promotion')
  })

  it('uses whole units for a currency without decimals', async () => {
    const posted = serve({ salary: yen })
    const dialog = await openDialog()
    expect(within(dialog).getByText('JPY')).toBeInTheDocument()

    await userEvent.type(within(dialog).getByLabelText('New salary'), '8800000')
    expect(within(dialog).getByText('+10.0% from 8,000,000 JPY')).toBeInTheDocument()
    await submit(dialog)

    await closed()
    expect(posted[0].body).toMatchObject({ salary_change: { amount_cents: 8_800_000 } })
  })

  it('accepts a date as late as the latest record, and as early as today', async () => {
    const posted = serve()
    const dialog = await openDialog()

    await userEvent.type(within(dialog).getByLabelText('New salary'), '80000')
    fireEvent.change(within(dialog).getByLabelText('Starts'), { target: { value: '2025-01-15' } })
    await submit(dialog)

    await closed()
    expect(posted[0].body).toMatchObject({ salary_change: { effective_from: '2025-01-15' } })
  })

  it('can restate the same salary, for a correction', async () => {
    const posted = serve()
    const dialog = await openDialog()

    await userEvent.type(within(dialog).getByLabelText('New salary'), '75000')
    await userEvent.selectOptions(within(dialog).getByLabelText('Reason'), 'Correction')
    await submit(dialog)

    await closed()
    expect(posted).toHaveLength(1)
  })
})

describe('mistakes caught before sending', () => {
  async function attempt(amount: string, date?: string) {
    const posted = serve()
    const dialog = await openDialog()
    if (amount) await userEvent.type(within(dialog).getByLabelText('New salary'), amount)
    if (date !== undefined)
      fireEvent.change(within(dialog).getByLabelText('Starts'), { target: { value: date } })
    await submit(dialog)
    return posted
  }

  it.each([
    ['', undefined, 'Enter the new salary.'],
    ['abc', undefined, 'Enter an amount like 50000 or 50000.50.'],
    ['0', undefined, 'The salary must be more than zero.'],
    ['80000', '', 'Enter the date the new salary starts.'],
    ['80000', '2999-01-01', 'The date cannot be in the future.'],
    ['80000', '2024-12-31', 'The date cannot be before the latest salary record (15 Jan 2025).'],
  ])('amount %j and date %j: "%s"', async (amount, date, message) => {
    const posted = await attempt(amount, date)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(posted).toHaveLength(0)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('when the API refuses', () => {
  const refusal = (details: Record<string, string[]>) =>
    HttpResponse.json(errorBody('validation_failed', 'Validation failed', details), { status: 422 })

  it('explains why inside the dialog, which stays open with what was typed', async () => {
    serve({ failure: refusal({ employee: ['has been terminated'] }) })
    const dialog = await openDialog()
    await userEvent.type(within(dialog).getByLabelText('New salary'), '80000')

    await submit(dialog)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Employee has been terminated.',
    )
    expect(within(dialog).getByLabelText('New salary')).toHaveValue('80000')
    expect(screen.queryByText(/Salary changed to/)).not.toBeInTheDocument()
  })

  it('tells the user when the server cannot be reached', async () => {
    serve()
    server.use(http.post('/api/v1/employees/7/salary_changes', () => HttpResponse.error()))
    const dialog = await openDialog()
    await userEvent.type(within(dialog).getByLabelText('New salary'), '80000')

    await submit(dialog)

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not reach the server')
  })

  it('does nothing on Cancel', async () => {
    const posted = serve()
    const dialog = await openDialog()
    await userEvent.type(within(dialog).getByLabelText('New salary'), '80000')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await closed()
    expect(posted).toHaveLength(0)
  })
})
