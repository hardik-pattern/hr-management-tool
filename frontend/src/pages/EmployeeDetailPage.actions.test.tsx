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

const active = buildEmployee({ id: 7, hire_date: '2024-03-01' })
const terminated = buildEmployee({
  id: 7,
  hire_date: '2024-03-01',
  status: 'terminated',
  termination_date: '2025-01-31',
})

interface Call {
  path: string
  body: unknown
}

/**
 * Serves employee 7 in +initial+ state. A successful action switches it to
 * +after+, as the real API would, and every action call is recorded.
 */
function serve(initial = active, after = terminated, failure?: Response) {
  let current = initial
  const calls: Call[] = []
  const act = (path: string) =>
    http.post(`/api/v1/employees/7/${path}`, async ({ request }) => {
      const text = await request.text()
      calls.push({ path, body: text ? JSON.parse(text) : undefined })
      if (failure) return failure.clone()
      current = after
      return HttpResponse.json({ data: current })
    })
  server.use(
    http.get('/api/v1/employees/7', () => HttpResponse.json({ data: current })),
    http.get('/api/v1/employees/7/salary_records', () =>
      HttpResponse.json({ data: [buildSalaryRecord()] }),
    ),
    act('terminate'),
    act('rehire'),
    http.delete('/api/v1/employees/7', () => {
      calls.push({ path: 'delete', body: undefined })
      return failure
        ? failure.clone()
        : HttpResponse.json({ data: { ...current, deleted_at: '2025-06-01T00:00:00Z' } })
    }),
  )
  return calls
}

const refusal = (details: Record<string, string[]>) =>
  HttpResponse.json(errorBody('validation_failed', 'Validation failed', details), { status: 422 })

async function renderDetail() {
  renderWithProviders(
    <Routes>
      <Route path="/employees/:id" element={<EmployeeDetailPage />} />
      <Route path="/employees" element={<h1>List page</h1>} />
    </Routes>,
    { route: '/employees/7' },
  )
  await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })
}

const dialog = () => screen.getByRole('dialog')
const closed = () => waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

describe('which actions are offered', () => {
  it('lets an active employee be terminated or deleted, but not rehired', async () => {
    serve()
    await renderDetail()

    expect(screen.getByRole('button', { name: 'Terminate' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rehire' })).not.toBeInTheDocument()
  })

  it('lets a terminated employee be rehired or deleted, but not terminated', async () => {
    serve(terminated)
    await renderDetail()

    expect(screen.getByRole('button', { name: 'Rehire' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Terminate' })).not.toBeInTheDocument()
  })
})

describe('terminating', () => {
  it('asks for the last day, defaulting to today, and terminates', async () => {
    const calls = serve()
    await renderDetail()

    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }))
    expect(within(dialog()).getByText('Terminate Asha Rao')).toBeInTheDocument()
    expect(within(dialog()).getByLabelText('Last day')).toHaveValue(todayIso())

    fireEvent.change(within(dialog()).getByLabelText('Last day'), {
      target: { value: '2025-01-31' },
    })
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Terminate' }))

    await closed()
    expect(calls).toEqual([{ path: 'terminate', body: { termination_date: '2025-01-31' } }])
    expect(await screen.findByText('Asha Rao was terminated.')).toBeInTheDocument()
    expect(await screen.findByText('Left on 31 Jan 2025')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rehire' })).toBeInTheDocument()
  })

  it('does not accept a date in the future, and sends nothing', async () => {
    const calls = serve()
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }))

    fireEvent.change(within(dialog()).getByLabelText('Last day'), {
      target: { value: '2999-01-01' },
    })
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Terminate' }))

    expect(await screen.findByText('The date cannot be in the future.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('does not accept a date before the hire date', async () => {
    const calls = serve()
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }))

    fireEvent.change(within(dialog()).getByLabelText('Last day'), {
      target: { value: '2020-01-01' },
    })
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Terminate' }))

    expect(
      await screen.findByText('The date cannot be before the hire date (1 Mar 2024).'),
    ).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('needs a date', async () => {
    const calls = serve()
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }))

    fireEvent.change(within(dialog()).getByLabelText('Last day'), { target: { value: '' } })
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Terminate' }))

    expect(await screen.findByText('Enter the date they left.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('explains an API refusal inside the dialog, which stays open', async () => {
    serve(active, terminated, refusal({ base: ['is already terminated'] }))
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }))

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Terminate' }))

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      'This is already terminated.',
    )
    expect(dialog()).toBeInTheDocument()
    expect(screen.queryByText('Asha Rao was terminated.')).not.toBeInTheDocument()
  })

  it('closes on Cancel without calling the API', async () => {
    const calls = serve()
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Terminate' }))

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

    await closed()
    expect(calls).toHaveLength(0)
  })
})

describe('rehiring', () => {
  it('rehires with no new salary by default', async () => {
    const calls = serve(terminated, active)
    await renderDetail()

    await userEvent.click(screen.getByRole('button', { name: 'Rehire' }))
    expect(within(dialog()).getByText(/Their salary stays 80,000.00 USD/)).toBeInTheDocument()
    expect(within(dialog()).queryByLabelText('New salary starts')).not.toBeInTheDocument()
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Rehire' }))

    await closed()
    expect(calls).toEqual([{ path: 'rehire', body: {} }])
    expect(await screen.findByText('Asha Rao was rehired.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Terminate' })).toBeInTheDocument()
  })

  it('sends a new salary in minor units, with the date it starts', async () => {
    const calls = serve(terminated, active)
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Rehire' }))

    await userEvent.type(within(dialog()).getByLabelText('New salary (optional)'), '70000')
    expect(within(dialog()).getByLabelText('New salary starts')).toHaveValue(todayIso())
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Rehire' }))

    await closed()
    expect(calls).toEqual([
      { path: 'rehire', body: { salary_cents: 7_000_000, effective_from: todayIso() } },
    ])
  })

  it('does not accept an invalid or zero salary, or a future start date', async () => {
    const calls = serve(terminated, active)
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Rehire' }))
    const salary = within(dialog()).getByLabelText('New salary (optional)')

    await userEvent.type(salary, 'abc')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Rehire' }))
    expect(await screen.findByText(/Enter an amount above zero/)).toBeInTheDocument()

    await userEvent.clear(salary)
    await userEvent.type(salary, '0')
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Rehire' }))
    expect(screen.getByText(/Enter an amount above zero/)).toBeInTheDocument()

    await userEvent.clear(salary)
    await userEvent.type(salary, '70000')
    fireEvent.change(within(dialog()).getByLabelText('New salary starts'), {
      target: { value: '2999-01-01' },
    })
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Rehire' }))
    expect(await screen.findByText('The date cannot be in the future.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('explains an API refusal inside the dialog', async () => {
    serve(
      terminated,
      active,
      refusal({ effective_from: ['cannot be before the latest salary record (2025-01-01)'] }),
    )
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Rehire' }))
    await userEvent.type(within(dialog()).getByLabelText('New salary (optional)'), '70000')

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Rehire' }))

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
      'Effective from cannot be before the latest salary record (2025-01-01).',
    )
  })
})

describe('deleting', () => {
  it('explains what delete means, and that termination is for people who left', async () => {
    serve()
    await renderDetail()

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(within(dialog()).getByText('Delete Asha Rao?')).toBeInTheDocument()
    expect(within(dialog()).getByText(/you can restore it later/)).toBeInTheDocument()
    expect(within(dialog()).getByText(/terminate them instead/)).toBeInTheDocument()
  })

  it('does nothing on Cancel', async () => {
    const calls = serve()
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }))

    await closed()
    expect(calls).toHaveLength(0)
  })

  it('shows a failure inside the dialog and stays on the employee', async () => {
    serve(
      active,
      terminated,
      HttpResponse.json(errorBody('not_found', 'Employee not found'), { status: 404 }),
    )
    await renderDetail()
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Delete' }))

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Employee not found')
    expect(screen.queryByRole('heading', { name: 'List page' })).not.toBeInTheDocument()
  })
})
