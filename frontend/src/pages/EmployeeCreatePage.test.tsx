import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { buildEmployee, buildSalaryRecord, errorBody } from '../test/fixtures'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/server'
import EmployeeCreatePage from './EmployeeCreatePage'
import EmployeeDetailPage from './EmployeeDetailPage'

/** Serves POST /employees, recording the bodies received. */
function serveCreate(
  respond = () => HttpResponse.json({ data: buildEmployee({ id: 9 }) }, { status: 201 }),
) {
  const bodies: unknown[] = []
  server.use(
    http.post('/api/v1/employees', async ({ request }) => {
      bodies.push(await request.json())
      return respond()
    }),
    http.get('/api/v1/employees/9', () => HttpResponse.json({ data: buildEmployee({ id: 9 }) })),
    http.get('/api/v1/employees/9/salary_records', () =>
      HttpResponse.json({ data: [buildSalaryRecord()] }),
    ),
  )
  return bodies
}

async function renderCreate() {
  renderWithProviders(
    <Routes>
      <Route path="/employees/new" element={<EmployeeCreatePage />} />
      <Route path="/employees/:id" element={<EmployeeDetailPage />} />
      <Route path="/employees" element={<h1>List page</h1>} />
    </Routes>,
    { route: '/employees/new' },
  )
  await screen.findByRole('option', { name: 'Japan' }) // reference lists are in
}

const field = (name: string) => screen.getByLabelText(name)

async function fillValidForm(overrides: { country?: string; salary?: string } = {}) {
  await userEvent.type(field('Name'), 'Asha Rao')
  await userEvent.type(field('Email'), 'asha.rao@acme.test')
  await userEvent.selectOptions(field('Gender'), 'Female')
  fireEvent.change(field('Hire date'), { target: { value: '2024-03-01' } })
  await userEvent.selectOptions(field('Country'), overrides.country ?? 'United States')
  await userEvent.selectOptions(field('Department'), 'Engineering')
  await userEvent.selectOptions(field('Job title'), 'Staff Engineer')
  await userEvent.type(field('Starting salary'), overrides.salary ?? '80000')
}

const submit = () => userEvent.click(screen.getByRole('button', { name: 'Create employee' }))

describe('EmployeeCreatePage fields', () => {
  it('shows the form, with job title and salary waiting for their prerequisites', async () => {
    await renderCreate()

    for (const label of [
      'Name',
      'Email',
      'Gender',
      'Hire date',
      'Country',
      'Department',
      'Job title',
      'Starting salary',
    ]) {
      expect(field(label)).toBeInTheDocument()
    }
    expect(field('Job title')).toBeDisabled()
    expect(field('Starting salary')).toBeDisabled()
    expect(screen.getByText('Choose a country first.')).toBeInTheDocument()
  })

  it('offers only the job titles of the chosen department', async () => {
    await renderCreate()

    await userEvent.selectOptions(field('Department'), 'Sales')

    expect(field('Job title')).toBeEnabled()
    const titles = within(field('Job title'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(titles).toEqual(['Choose…', 'Account Executive'])
  })

  it('makes the job title be chosen again when the department changes', async () => {
    await renderCreate()
    await userEvent.selectOptions(field('Department'), 'Engineering')
    await userEvent.selectOptions(field('Job title'), 'Staff Engineer')

    await userEvent.selectOptions(field('Department'), 'Sales')

    expect(field('Job title')).toHaveDisplayValue('Choose…')
  })

  it('does not let a job title from the old department be saved after the department changes', async () => {
    const bodies = serveCreate()
    await renderCreate()
    await fillValidForm()

    // The select would only look reset: the real test is that saving asks for a title again.
    await userEvent.selectOptions(field('Department'), 'Sales')
    await submit()

    expect(await screen.findByText('Choose a job title.')).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
  })

  it('unlocks the salary once a country is chosen and names its currency', async () => {
    await renderCreate()

    await userEvent.selectOptions(field('Country'), 'Japan')

    expect(field('Starting salary')).toBeEnabled()
    expect(screen.getByText('JPY')).toBeInTheDocument()
  })

  it('says the country cannot be changed later', async () => {
    await renderCreate()

    expect(screen.getByText('Cannot be changed after the employee is created.')).toBeInTheDocument()
  })

  it('hints when the hire date is in the future, and only then', async () => {
    await renderCreate()
    expect(screen.queryByText('Starts on a future date.')).not.toBeInTheDocument()

    fireEvent.change(field('Hire date'), { target: { value: '2999-01-01' } })
    expect(screen.getByText('Starts on a future date.')).toBeInTheDocument()

    fireEvent.change(field('Hire date'), { target: { value: '2020-01-01' } })
    expect(screen.queryByText('Starts on a future date.')).not.toBeInTheDocument()
  })

  it('goes back to the list on Cancel', async () => {
    await renderCreate()

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/employees')
  })
})

describe('EmployeeCreatePage validation', () => {
  it('asks for every missing field and sends nothing', async () => {
    const bodies = serveCreate()
    await renderCreate()

    await submit()

    for (const message of [
      'Enter a name.',
      'Enter an email address.',
      'Choose a gender.',
      'Enter the hire date.',
      'Choose a country.',
      'Choose a department.',
      'Choose a job title.',
      'Enter the starting salary.',
    ]) {
      expect(await screen.findByText(message)).toBeInTheDocument()
    }
    expect(bodies).toHaveLength(0)
  })

  it('does not show errors before a save is attempted', async () => {
    await renderCreate()

    await userEvent.type(field('Email'), 'nope')

    expect(screen.queryByText('Enter a valid email address.')).not.toBeInTheDocument()
  })

  it('explains an invalid email and a bad salary', async () => {
    const bodies = serveCreate()
    await renderCreate()
    await fillValidForm({ salary: 'abc' })
    await userEvent.clear(field('Email'))
    await userEvent.type(field('Email'), 'not-an-email')

    await submit()

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText(/Enter an amount like 50000/)).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
  })

  it('clears a message as soon as the field is fixed', async () => {
    serveCreate()
    await renderCreate()
    await submit()
    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()

    await userEvent.type(field('Name'), 'A')

    expect(screen.queryByText('Enter a name.')).not.toBeInTheDocument()
  })
})

describe('EmployeeCreatePage saving', () => {
  it('creates the employee, converting the salary to minor units, and opens their page with a notice', async () => {
    const bodies = serveCreate()
    await renderCreate()
    await fillValidForm({ salary: '80000.5' })

    await submit()

    expect(await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })).toBeInTheDocument()
    expect(bodies).toEqual([
      {
        employee: {
          full_name: 'Asha Rao',
          email: 'asha.rao@acme.test',
          gender: 'female',
          hire_date: '2024-03-01',
          country_id: 1,
          department_id: 1,
          job_title_id: 2,
          salary_cents: 8_000_050,
        },
      },
    ])
    expect(await screen.findByText('Employee created.')).toBeInTheDocument()
  })

  it('sends whole units for a currency without decimals', async () => {
    const bodies = serveCreate()
    await renderCreate()
    await fillValidForm({ country: 'Japan', salary: '8000000' })

    await submit()

    await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })
    expect(bodies[0]).toMatchObject({ employee: { country_id: 2, salary_cents: 8_000_000 } })
  })

  it('shows a server field error under that field and keeps what was typed', async () => {
    serveCreate(() =>
      HttpResponse.json(
        errorBody('validation_failed', 'Validation failed', { email: ['has already been taken'] }),
        { status: 422 },
      ),
    )
    await renderCreate()
    await fillValidForm()

    await submit()

    expect(await screen.findByText('Email has already been taken.')).toBeInTheDocument()
    expect(field('Email')).toHaveValue('asha.rao@acme.test')
    expect(field('Name')).toHaveValue('Asha Rao')
    expect(screen.getByRole('button', { name: 'Create employee' })).toBeEnabled()
  })

  it('shows an error that belongs to no field at the top', async () => {
    serveCreate(() =>
      HttpResponse.json(
        errorBody('validation_failed', 'Validation failed', { base: ['is not allowed right now'] }),
        { status: 422 },
      ),
    )
    await renderCreate()
    await fillValidForm()

    await submit()

    expect(await screen.findByRole('alert')).toHaveTextContent('This is not allowed right now.')
  })

  it('tells the user when the server cannot be reached, and lets them try again', async () => {
    let calls = 0
    serveCreate(() => {
      calls += 1
      return calls === 1
        ? HttpResponse.error()
        : HttpResponse.json({ data: buildEmployee({ id: 9 }) }, { status: 201 })
    })
    await renderCreate()
    await fillValidForm()

    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')

    await submit()
    expect(await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })).toBeInTheDocument()
  })

  it('disables the button while saving, so a double click cannot create two employees', async () => {
    const bodies = serveCreate(() =>
      HttpResponse.json({ data: buildEmployee({ id: 9 }) }, { status: 201 }),
    )
    server.use(
      http.post('/api/v1/employees', async ({ request }) => {
        bodies.push(await request.json())
        await delay(150)
        return HttpResponse.json({ data: buildEmployee({ id: 9 }) }, { status: 201 })
      }),
    )
    await renderCreate()
    await fillValidForm()

    await userEvent.dblClick(screen.getByRole('button', { name: 'Create employee' }))

    expect(await screen.findByRole('button', { name: /Saving/ })).toBeDisabled()
    await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })
    await waitFor(() => expect(bodies).toHaveLength(1))
  })
})
