import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
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

describe('opening an employee from the list', () => {
  const asha = buildEmployee({ id: 7, full_name: 'Asha Rao' })
  const deleted = buildEmployee({
    id: 8,
    full_name: 'Gone Person',
    deleted_at: '2025-06-01T00:00:00Z',
  })

  function serveDetail() {
    server.use(
      http.get('/api/v1/employees/7', () => HttpResponse.json({ data: asha })),
      http.get('/api/v1/employees/7/salary_records', () =>
        HttpResponse.json({ data: [buildSalaryRecord()] }),
      ),
    )
  }

  it('opens the detail page from a name and comes back to the same filtered view', async () => {
    const searches = serveEmployees(() => employeeList([asha]))
    serveDetail()
    renderApp('/employees?q=asha&sort=-hire_date')

    await userEvent.click(await screen.findByRole('link', { name: 'Asha Rao' }))

    expect(await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Employees' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: /Back to employees/ }))

    expect(await screen.findByRole('heading', { name: 'Employees' })).toBeInTheDocument()
    expect(screen.getByLabelText('Search')).toHaveValue('asha')
    await waitFor(() => expect(searches.at(-1)?.get('sort')).toBe('-hire_date'))
  })

  it('does not link deleted employees, which the API cannot open', async () => {
    serveEmployees(() => employeeList([deleted]))
    renderApp('/employees?deleted=only')

    expect(await screen.findByText('Gone Person (deleted)')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Gone Person/ })).not.toBeInTheDocument()
  })

  it('keeps Employees highlighted in the navigation on the detail page', async () => {
    serveDetail()
    renderApp('/employees/7')

    await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })

    expect(screen.getByRole('link', { name: 'Employees' })).toHaveClass('active')
  })
})
