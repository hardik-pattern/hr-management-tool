import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { buildEmployee, employeeList, errorBody } from '../test/fixtures'
import { renderWithProviders } from '../test/renderWithProviders'
import { server } from '../test/server'
import { serveEmployees } from '../test/serveEmployees'
import EmployeesPage from './EmployeesPage'

const asha = buildEmployee({ id: 1, full_name: 'Asha Rao', employee_number: 'E000001' })
const liam = buildEmployee({
  id: 2,
  full_name: 'Liam Smith',
  employee_number: 'E000002',
  status: 'terminated',
  country: { id: 2, code: 'JP', name: 'Japan' },
  salary: { amount_cents: 8_000_000, currency: 'JPY', formatted: '8,000,000 JPY' },
})

describe('EmployeesPage table', () => {
  it('shows a loading indicator, then the employees', async () => {
    serveEmployees(() => employeeList([asha]))
    renderWithProviders(<EmployeesPage />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading employees')

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows each employee’s details with salary in their own currency', async () => {
    serveEmployees(() => employeeList([asha, liam]))
    renderWithProviders(<EmployeesPage />)

    const rows = await screen.findAllByRole('row')
    const [, ashaRow, liamRow] = rows
    expect(within(ashaRow).getByText('E000001')).toBeInTheDocument()
    expect(within(ashaRow).getByText('asha.rao@acme.test')).toBeInTheDocument()
    expect(within(ashaRow).getByText('Engineering')).toBeInTheDocument()
    expect(within(ashaRow).getByText('Software Engineer')).toBeInTheDocument()
    expect(within(ashaRow).getByText('1 Mar 2024')).toBeInTheDocument()
    expect(within(ashaRow).getByText('Active')).toBeInTheDocument()
    expect(within(ashaRow).getByText('80,000.00 USD')).toBeInTheDocument()
    expect(within(liamRow).getByText('Terminated')).toBeInTheDocument()
    expect(within(liamRow).getByText('8,000,000 JPY')).toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    serveEmployees(() => employeeList([]))
    renderWithProviders(<EmployeesPage />)

    expect(await screen.findByText('No employees match.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 0–0 of 0')).toBeInTheDocument()
  })

  it('shows the error with a way to retry', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/employees', () => {
        calls += 1
        return calls === 1
          ? HttpResponse.json(errorBody('bad_request', 'Something is wrong'), { status: 400 })
          : HttpResponse.json(employeeList([asha]))
      }),
    )
    renderWithProviders(<EmployeesPage />)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not load employees. Something is wrong')

    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows a friendly message when the server cannot be reached', async () => {
    server.use(http.get('/api/v1/employees', () => HttpResponse.error()))
    renderWithProviders(<EmployeesPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reach the server')
  })
})

describe('EmployeesPage sorting', () => {
  it('requests name order by default and marks the sorted column', async () => {
    const searches = serveEmployees(() => employeeList([asha]))
    renderWithProviders(<EmployeesPage />)
    await screen.findByText('Asha Rao')

    expect(searches[0].get('sort')).toBe('full_name')
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    expect(screen.getByRole('columnheader', { name: /Hired/ })).toHaveAttribute('aria-sort', 'none')
  })

  it('sorts by a column on click and flips direction on a second click', async () => {
    const searches = serveEmployees(() => employeeList([asha]))
    renderWithProviders(<EmployeesPage />)
    await screen.findByText('Asha Rao')

    await userEvent.click(screen.getByRole('button', { name: /Hired/ }))
    await waitFor(() => expect(searches.at(-1)?.get('sort')).toBe('hire_date'))
    expect(screen.getByRole('columnheader', { name: /Hired/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )

    await userEvent.click(screen.getByRole('button', { name: /Hired/ }))
    await waitFor(() => expect(searches.at(-1)?.get('sort')).toBe('-hire_date'))
    expect(screen.getByRole('columnheader', { name: /Hired/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('starts from the sort in the URL', async () => {
    const searches = serveEmployees(() => employeeList([asha]))
    renderWithProviders(<EmployeesPage />, { route: '/employees?sort=-employee_number' })
    await screen.findByText('Asha Rao')

    expect(searches[0].get('sort')).toBe('-employee_number')
    expect(screen.getByRole('columnheader', { name: /Number/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    )
  })

  it('does not offer sorting by salary', async () => {
    serveEmployees(() => employeeList([asha]))
    renderWithProviders(<EmployeesPage />)
    await screen.findByText('Asha Rao')

    expect(screen.getByRole('columnheader', { name: 'Salary' })).not.toHaveAttribute('aria-sort')
    expect(screen.queryByRole('button', { name: /Salary/ })).not.toBeInTheDocument()
  })
})

describe('EmployeesPage pagination', () => {
  /** Three pages of one row each, linked by cursors "c1" and "c2". */
  function servePages() {
    return serveEmployees((params) => {
      const cursor = params.get('cursor')
      const pages = {
        none: { rows: [asha], next: 'c1' },
        c1: { rows: [liam], next: 'c2' },
        c2: { rows: [buildEmployee({ id: 3, full_name: 'Third Person' })], next: null },
      } as const
      const page = pages[(cursor ?? 'none') as keyof typeof pages]
      return employeeList([...page.rows], { total: 3, per_page: 1, next_cursor: page.next })
    })
  }

  it('starts on the first page with Previous disabled', async () => {
    servePages()
    renderWithProviders(<EmployeesPage />)
    await screen.findByText('Asha Rao')

    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })

  it('moves forward with the cursor and back to earlier pages', async () => {
    const searches = servePages()
    renderWithProviders(<EmployeesPage />, { route: '/employees' })
    await screen.findByText('Asha Rao')

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Liam Smith')).toBeInTheDocument()
    expect(searches.at(-1)?.get('cursor')).toBe('c1')

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Third Person')).toBeInTheDocument()
    expect(searches.at(-1)?.get('cursor')).toBe('c2')

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('Liam Smith')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }))
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  })

  it('disables Next on the last page', async () => {
    servePages()
    renderWithProviders(<EmployeesPage />)
    await screen.findByText('Asha Rao')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Liam Smith')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Third Person')

    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })

  it('shows which rows are on screen out of the total', async () => {
    serveEmployees((params) =>
      params.get('cursor')
        ? employeeList([liam], { total: 27, next_cursor: null })
        : employeeList([asha], { total: 27, next_cursor: 'c1' }),
    )
    renderWithProviders(<EmployeesPage />)

    expect(await screen.findByText('Showing 1–1 of 27')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(await screen.findByText('Showing 26–26 of 27')).toBeInTheDocument()
  })

  it('returns to the first page when the sort changes', async () => {
    const searches = servePages()
    renderWithProviders(<EmployeesPage />)
    await screen.findByText('Asha Rao')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Liam Smith')

    await userEvent.click(screen.getByRole('button', { name: /Hired/ }))

    await waitFor(() => {
      const last = searches.at(-1)
      expect(last?.get('sort')).toBe('hire_date')
      expect(last?.get('cursor')).toBeNull()
    })
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  })

  it('changes the page size and starts again from the first page', async () => {
    const searches = servePages()
    renderWithProviders(<EmployeesPage />)
    await screen.findByText('Asha Rao')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Liam Smith')

    await userEvent.selectOptions(screen.getByLabelText('Rows per page'), '50')

    await waitFor(() => {
      const last = searches.at(-1)
      expect(last?.get('per_page')).toBe('50')
      expect(last?.get('cursor')).toBeNull()
    })
  })
})
