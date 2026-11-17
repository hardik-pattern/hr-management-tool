import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { buildEmployee, buildSalaryRecord, errorBody } from '../test/fixtures'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/server'
import EmployeeDetailPage from './EmployeeDetailPage'
import EmployeeEditPage from './EmployeeEditPage'

// Employee 7 is an Engineering "Software Engineer" (job title 1), in the United States.
const employee = buildEmployee({ id: 7, full_name: 'Asha Rao', email: 'asha.rao@acme.test' })

/** Serves the employee, and PATCH /employees/7, recording the bodies received. */
function serveEdit(
  respond: () => Response = () =>
    HttpResponse.json({ data: { ...employee, full_name: 'Changed' } }),
) {
  const bodies: unknown[] = []
  server.use(
    http.get('/api/v1/employees/7', () => HttpResponse.json({ data: employee })),
    http.get('/api/v1/employees/7/salary_records', () =>
      HttpResponse.json({ data: [buildSalaryRecord()] }),
    ),
    http.patch('/api/v1/employees/7', async ({ request }) => {
      bodies.push(await request.json())
      return respond()
    }),
  )
  return bodies
}

function renderEdit(route = '/employees/7/edit') {
  return renderWithProviders(
    <Routes>
      <Route path="/employees/:id/edit" element={<EmployeeEditPage />} />
      <Route path="/employees/:id" element={<EmployeeDetailPage />} />
      <Route path="/employees" element={<h1>List page</h1>} />
    </Routes>,
    { route },
  )
}

const field = (name: string) => screen.getByLabelText(name)
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

async function renderLoaded() {
  renderEdit()
  await screen.findByDisplayValue('Asha Rao')
  await screen.findByRole('option', { name: 'Sales' })
}

describe('EmployeeEditPage', () => {
  it('shows a loading indicator, then the employee’s current values', async () => {
    serveEdit()
    renderEdit()
    expect(screen.getByRole('status')).toHaveTextContent('Loading employee')

    expect(await screen.findByRole('heading', { name: 'Edit Asha Rao' })).toBeInTheDocument()
    expect(field('Name')).toHaveValue('Asha Rao')
    expect(field('Email')).toHaveValue('asha.rao@acme.test')
    expect(field('Gender')).toHaveDisplayValue('Female')
    await waitFor(() => expect(field('Department')).toHaveDisplayValue('Engineering'))
    await waitFor(() => expect(field('Job title')).toHaveDisplayValue('Software Engineer'))
  })

  it('shows the country and hire date as plain text, since they cannot be changed', async () => {
    serveEdit()
    await renderLoaded()

    expect(screen.getByText('United States')).toBeInTheDocument()
    expect(screen.getByText('1 Mar 2024')).toBeInTheDocument()
    expect(screen.queryByLabelText('Country')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Hire date')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Starting salary')).not.toBeInTheDocument()
  })

  it('sends only what changed, then opens the employee with a notice', async () => {
    const bodies = serveEdit()
    await renderLoaded()

    await userEvent.clear(field('Name'))
    await userEvent.type(field('Name'), 'Asha R. Rao')
    await save()

    expect(await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })).toBeInTheDocument()
    expect(bodies).toEqual([{ employee: { full_name: 'Asha R. Rao' } }])
    expect(await screen.findByText('Changes saved.')).toBeInTheDocument()
  })

  it('does not call the API when nothing changed', async () => {
    const bodies = serveEdit()
    await renderLoaded()

    await save()

    expect(await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
  })

  it('makes the job title be chosen again after a department change, and sends both together', async () => {
    const bodies = serveEdit()
    await renderLoaded()
    await waitFor(() => expect(field('Job title')).toHaveDisplayValue('Software Engineer'))

    await userEvent.selectOptions(field('Department'), 'Sales')
    expect(field('Job title')).toHaveDisplayValue('Choose…')

    await save()
    expect(await screen.findByText('Choose a job title.')).toBeInTheDocument()
    expect(bodies).toHaveLength(0)

    await userEvent.selectOptions(field('Job title'), 'Account Executive')
    await save()

    await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })
    expect(bodies).toEqual([{ employee: { department_id: 2, job_title_id: 3 } }])
  })

  it('requires the fields to stay filled in', async () => {
    const bodies = serveEdit()
    await renderLoaded()

    await userEvent.clear(field('Name'))
    await userEvent.clear(field('Email'))
    await save()

    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
    expect(screen.getByText('Enter an email address.')).toBeInTheDocument()
    expect(bodies).toHaveLength(0)
  })

  it('shows a server error under its field and stays on the form', async () => {
    serveEdit(() =>
      HttpResponse.json(
        errorBody('validation_failed', 'Validation failed', { email: ['has already been taken'] }),
        { status: 422 },
      ),
    )
    await renderLoaded()
    await userEvent.clear(field('Email'))
    await userEvent.type(field('Email'), 'taken@acme.test')

    await save()

    expect(await screen.findByText('Email has already been taken.')).toBeInTheDocument()
    expect(field('Email')).toHaveValue('taken@acme.test')
  })

  it('returns to the employee on Cancel', async () => {
    serveEdit()
    await renderLoaded()

    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/employees/7')
  })
})

describe('EmployeeEditPage problems', () => {
  it('says the employee was not found for an unknown or deleted id', async () => {
    server.use(
      http.get('/api/v1/employees/7', () =>
        HttpResponse.json(errorBody('not_found', 'Employee not found'), { status: 404 }),
      ),
    )
    renderEdit()

    expect(await screen.findByRole('heading', { name: 'Employee not found' })).toBeInTheDocument()
  })

  it('treats an address that is not an id as not found', async () => {
    renderEdit('/employees/abc/edit')

    expect(await screen.findByRole('heading', { name: 'Employee not found' })).toBeInTheDocument()
  })

  it('shows a retryable error when the employee cannot be loaded', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/employees/7', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(errorBody('bad_request', 'Something broke'), { status: 400 })
          : HttpResponse.json({ data: employee })
      }),
    )
    renderEdit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load this employee. Something broke',
    )

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByDisplayValue('Asha Rao')).toBeInTheDocument()
  })
})
