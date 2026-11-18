import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, it } from 'vitest'
import App from './App'
import { expectAccessible } from './test/a11y'
import {
  buildAnswer,
  buildEmployee,
  buildGenderGap,
  buildOutOfBand,
  buildSalaryRecord,
  buildStale,
  buildSummary,
  employeeList,
  questionList,
} from './test/fixtures'
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

  it.each(['payroll-by-department', 'gender-pay-gap', 'paid-below-band', 'no-raise-24-months'])(
    'the %s answer',
    async (id) => {
      server.use(
        http.get('/api/v1/questions', () => HttpResponse.json({ data: questionList })),
        http.get('/api/v1/questions/:id/answer', ({ params }) =>
          HttpResponse.json({ data: buildAnswer(params.id as string) }),
        ),
      )
      renderApp(`/questions?question=${id}`)
      await screen.findByRole('heading', {
        level: 2,
        name: questionList.find((q) => q.id === id)!.title,
      })
      await expectAccessible()
    },
  )

  it('the insights dashboard', async () => {
    server.use(
      http.get('/api/v1/analytics/summary', ({ request }) => {
        const params = new URL(request.url).searchParams
        const metric = (params.get('metric') ?? 'sum') as 'sum'
        const summary = buildSummary({ metric })
        if (params.get('group_by') === 'level') {
          summary.group_by = ['level']
          summary.rows = [
            {
              group: { level: { id: 1, label: 'Level 1' } },
              headcount: 5,
              value: 100,
              formatted: '1.00 USD',
            },
          ]
        }
        return HttpResponse.json({ data: summary })
      }),
      http.get('/api/v1/insights/gender_pay_gap', () =>
        HttpResponse.json({ data: buildGenderGap() }),
      ),
      http.get('/api/v1/insights/out_of_band', () => HttpResponse.json({ data: buildOutOfBand() })),
      http.get('/api/v1/insights/stale_salaries', () => HttpResponse.json({ data: buildStale() })),
    )
    renderApp('/insights')
    await screen.findByText('Staff Engineer')
    await screen.findAllByRole('link', { name: 'Asha Rao' })
    await screen.findByText('Level 1')
    await expectAccessible()
  })

  it('the explorer', async () => {
    server.use(
      http.get('/api/v1/analytics/summary', () =>
        HttpResponse.json({ data: buildSummary({ metric: 'median' }) }),
      ),
    )
    renderApp('/explorer?group_by=department,country&country_id=1')
    await screen.findByRole('table', { name: /Median pay/ })
    await screen.findByRole('option', { name: 'Japan' })
    await expectAccessible()
  })

  it('page not found', async () => {
    renderApp('/nowhere')
    await screen.findByRole('heading', { name: 'Page not found' })
    await expectAccessible()
  })
})
