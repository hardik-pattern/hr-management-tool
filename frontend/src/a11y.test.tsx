import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, it } from 'vitest'
import App from './App'
import { expectAccessible } from './test/a11y'
import { buildEmployee, buildSalaryRecord, employeeList } from './test/fixtures'
import { createWrapper } from './test/queryWrapper'
import { serveEmployees } from './test/serveEmployees'
import { server } from './test/server'

function renderApp(path: string) {
  const { queryClient } = createWrapper()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const asha = buildEmployee({ id: 7, full_name: 'Asha Rao' })
const gone = buildEmployee({ id: 8, full_name: 'Gone Person', deleted_at: '2025-06-01T00:00:00Z' })

function serveDetail(employee = asha) {
  server.use(
    http.get('/api/v1/employees/7', () => HttpResponse.json({ data: employee })),
    http.get('/api/v1/employees/7/salary_records', () =>
      HttpResponse.json({
        data: [buildSalaryRecord({ id: 2 }), buildSalaryRecord({ id: 1, reason: 'merit' })],
      }),
    ),
  )
}

describe('accessibility (axe)', () => {
  it('employee list', async () => {
    serveEmployees(() => employeeList([asha], { total: 60, next_cursor: 'c1' }))
    renderApp('/employees')
    await screen.findByText('Asha Rao')
    await screen.findByRole('option', { name: 'Japan' })
    await expectAccessible()
  })

  it('employee list with salary filter', async () => {
    serveEmployees(() => employeeList([asha]))
    renderApp('/employees?country_id=1&salary_min=100')
    await screen.findByText('Asha Rao')
    await screen.findByLabelText('Minimum salary')
    await expectAccessible()
  })

  it('deleted view with restore buttons', async () => {
    serveEmployees(() => employeeList([gone]))
    renderApp('/employees?deleted=only')
    await screen.findByText(/Gone Person/)
    await expectAccessible()
  })

  it('employee list, empty and failing', async () => {
    serveEmployees(() => employeeList([]))
    renderApp('/employees')
    await screen.findByText('No employees match.')
    await expectAccessible()
  })

  it('employee detail', async () => {
    serveDetail()
    renderApp('/employees/7')
    await screen.findByRole('table', { name: 'Salary history, newest first' })
    await expectAccessible()
  })

  it('new employee form, with errors showing', async () => {
    renderApp('/employees/new')
    await screen.findByRole('option', { name: 'Japan' })
    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    await screen.findByText('Enter a name.')
    await expectAccessible()
  })

  it('edit employee form', async () => {
    serveDetail()
    renderApp('/employees/7/edit')
    await screen.findByDisplayValue('Asha Rao')
    await expectAccessible()
  })

  it.each(['Terminate', 'Change salary', 'Delete'])('the %s dialog', async (button) => {
    serveDetail()
    renderApp('/employees/7')
    await screen.findByRole('table', { name: 'Salary history, newest first' })
    await userEvent.click(screen.getByRole('button', { name: button }))
    await screen.findByRole('dialog')
    await expectAccessible()
  })

  it('the Rehire dialog', async () => {
    serveDetail(buildEmployee({ id: 7, status: 'terminated', termination_date: '2025-02-01' }))
    renderApp('/employees/7')
    await screen.findByRole('table', { name: 'Salary history, newest first' })
    await userEvent.click(screen.getByRole('button', { name: 'Rehire' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('New salary (optional)'), '50000')
    fireEvent.change(within(dialog).getByLabelText('New salary starts'), {
      target: { value: '2025-03-01' },
    })
    await expectAccessible()
  })

  it('page not found', async () => {
    renderApp('/nowhere')
    await screen.findByRole('heading', { name: 'Page not found' })
    await expectAccessible()
  })
})
