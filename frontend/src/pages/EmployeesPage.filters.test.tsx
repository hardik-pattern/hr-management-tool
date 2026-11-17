import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { buildEmployee, employeeList } from '../test/fixtures'
import { renderWithProviders } from '../test/renderWithProviders'
import { serveEmployees } from '../test/serveEmployees'
import { server } from '../test/server'
import EmployeesPage from './EmployeesPage'

const asha = buildEmployee({ id: 1, full_name: 'Asha Rao' })

/** Renders the page and waits until the first list and the dropdown options are in. */
async function renderPage(route = '/employees') {
  const searches = serveEmployees(() => employeeList([asha]))
  const view = renderWithProviders(<EmployeesPage />, { route })
  await screen.findByText('Asha Rao')
  await screen.findByRole('option', { name: 'Japan' })
  await screen.findByRole('option', { name: 'Sales' })
  return { searches, ...view }
}

const lastSearch = (searches: URLSearchParams[]) => searches[searches.length - 1]

describe('search', () => {
  it('waits for a pause in typing, so a word is one request, not one per letter', async () => {
    const { searches } = await renderPage()
    const before = searches.length

    await userEvent.type(screen.getByLabelText('Search'), 'asha')

    await waitFor(() => expect(lastSearch(searches).get('q')).toBe('asha'))
    expect(searches.length).toBe(before + 1)
  })

  it('ignores surrounding spaces and clears the filter when emptied', async () => {
    const { searches } = await renderPage('/employees?q=asha')
    expect(screen.getByLabelText('Search')).toHaveValue('asha')

    await userEvent.clear(screen.getByLabelText('Search'))

    await waitFor(() => expect(lastSearch(searches).has('q')).toBe(false))
  })
})

describe('country, department and job title', () => {
  it('filters by country', async () => {
    const { searches } = await renderPage()

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'Japan')

    await waitFor(() => expect(lastSearch(searches).get('country_id')).toBe('2'))
  })

  it('only offers job titles from the chosen department', async () => {
    await renderPage()
    const titles = () =>
      within(screen.getByLabelText('Job title'))
        .getAllByRole('option')
        .map((option) => option.textContent)

    expect(titles()).toEqual([
      'All job titles',
      'Software Engineer',
      'Staff Engineer',
      'Account Executive',
    ])

    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Sales')

    expect(titles()).toEqual(['All job titles', 'Account Executive'])
  })

  it('drops a chosen job title that does not belong to the new department', async () => {
    const { searches } = await renderPage('/employees?department_id=1&job_title_id=2')
    expect(screen.getByLabelText('Job title')).toHaveDisplayValue('Staff Engineer')

    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Sales')

    await waitFor(() => expect(lastSearch(searches).get('department_id')).toBe('2'))
    expect(lastSearch(searches).has('job_title_id')).toBe(false)
    expect(screen.getByLabelText('Job title')).toHaveDisplayValue('All job titles')
  })

  it('keeps a job title that belongs to the department it is moved into', async () => {
    const { searches } = await renderPage('/employees?job_title_id=2')

    await userEvent.selectOptions(screen.getByLabelText('Department'), 'Engineering')

    await waitFor(() => expect(lastSearch(searches).get('department_id')).toBe('1'))
    expect(lastSearch(searches).get('job_title_id')).toBe('2')
  })

  it('starts from the values in the URL', async () => {
    const { searches } = await renderPage('/employees?department_id=1&job_title_id=2&country_id=2')

    expect(screen.getByLabelText('Department')).toHaveDisplayValue('Engineering')
    expect(screen.getByLabelText('Job title')).toHaveDisplayValue('Staff Engineer')
    expect(screen.getByLabelText('Country')).toHaveDisplayValue('Japan')
    expect(searches[0].get('job_title_id')).toBe('2')
  })
})

describe('status and deleted', () => {
  it('lists active employees by default and can switch to terminated or all', async () => {
    const { searches } = await renderPage()
    expect(screen.getByLabelText('Status')).toHaveDisplayValue('Active')
    expect(searches[0].has('status')).toBe(false)

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Terminated')
    await waitFor(() => expect(lastSearch(searches).get('status')).toBe('terminated'))

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'All')
    await waitFor(() => expect(lastSearch(searches).get('status')).toBe('all'))

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Active')
    await waitFor(() => expect(lastSearch(searches).has('status')).toBe(false))
  })

  it('shows deleted employees, defaulting the status to All as the API does', async () => {
    const { searches } = await renderPage()

    await userEvent.click(screen.getByLabelText('Show deleted'))

    await waitFor(() => expect(lastSearch(searches).get('deleted')).toBe('only'))
    expect(lastSearch(searches).has('status')).toBe(false)
    expect(screen.getByLabelText('Status')).toHaveDisplayValue('All')

    await userEvent.click(screen.getByLabelText('Show deleted'))
    await waitFor(() => expect(lastSearch(searches).has('deleted')).toBe(false))
    expect(screen.getByLabelText('Status')).toHaveDisplayValue('Active')
  })
})

describe('salary range', () => {
  it('is only offered once a country is chosen', async () => {
    await renderPage()
    expect(screen.queryByLabelText('Minimum salary')).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'United States')

    expect(await screen.findByLabelText('Minimum salary')).toBeInTheDocument()
    expect(screen.getByText('Salary (USD)')).toBeInTheDocument()
  })

  it('converts typed amounts to minor units using the currency’s decimals', async () => {
    const { searches } = await renderPage('/employees?country_id=1')

    await userEvent.type(await screen.findByLabelText('Minimum salary'), '50000.5')
    await userEvent.type(screen.getByLabelText('Maximum salary'), '90000')

    await waitFor(() => {
      expect(lastSearch(searches).get('salary_min')).toBe('5000050')
      expect(lastSearch(searches).get('salary_max')).toBe('9000000')
    })
  })

  it('uses whole units for a currency without decimals', async () => {
    const { searches } = await renderPage('/employees?country_id=2')

    await userEvent.type(await screen.findByLabelText('Minimum salary'), '5000000')

    await waitFor(() => expect(lastSearch(searches).get('salary_min')).toBe('5000000'))
    expect(screen.getByText('Salary (JPY)')).toBeInTheDocument()
  })

  it('shows an applied range in whole units', async () => {
    await renderPage('/employees?country_id=1&salary_min=5000050&salary_max=9000000')

    expect(await screen.findByLabelText('Minimum salary')).toHaveValue('50000.5')
    expect(screen.getByLabelText('Maximum salary')).toHaveValue('90000')
  })

  it('explains and does not apply a minimum above the maximum', async () => {
    const { searches } = await renderPage('/employees?country_id=1')

    await userEvent.type(await screen.findByLabelText('Minimum salary'), '500')
    await userEvent.type(screen.getByLabelText('Maximum salary'), '100')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'minimum cannot be more than the maximum',
    )
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(
      searches.some((params) => params.has('salary_min') && params.get('salary_min') === '50000'),
    ).toBe(false)
    expect(searches.some((params) => params.get('salary_max') === '10000')).toBe(false)
  })

  it('explains an amount that is not a number', async () => {
    await renderPage('/employees?country_id=1')

    await userEvent.type(await screen.findByLabelText('Minimum salary'), 'abc')

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter amounts like 50000')
  })

  it('is reset when the country changes, since the currency changes with it', async () => {
    const { searches } = await renderPage('/employees?country_id=1&salary_min=5000000')
    expect(await screen.findByLabelText('Minimum salary')).toHaveValue('50000')

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'Japan')

    await waitFor(() => expect(lastSearch(searches).get('country_id')).toBe('2'))
    expect(lastSearch(searches).has('salary_min')).toBe(false)
    expect(screen.getByLabelText('Minimum salary')).toHaveValue('')
  })

  it('goes away, with salary sorting, when the country is cleared', async () => {
    const { searches } = await renderPage('/employees?country_id=1&sort=-current_salary_cents')
    expect(searches[0].get('sort')).toBe('-current_salary_cents')
    expect(screen.getByRole('button', { name: /Salary/ })).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'All countries')

    await waitFor(() => expect(lastSearch(searches).get('sort')).toBe('full_name'))
    expect(screen.queryByLabelText('Minimum salary')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Salary/ })).not.toBeInTheDocument()
  })

  it('makes the salary column sortable once a country is chosen', async () => {
    const { searches } = await renderPage('/employees?country_id=1')

    await userEvent.click(screen.getByRole('button', { name: /Salary/ }))

    await waitFor(() => expect(lastSearch(searches).get('sort')).toBe('current_salary_cents'))
  })
})

describe('clearing and URL handling', () => {
  it('offers Clear filters only when a filter is set', async () => {
    await renderPage()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'Japan')

    expect(await screen.findByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
  })

  it('resets every field, including what was typed, and the list', async () => {
    const { searches } = await renderPage(
      '/employees?q=asha&country_id=1&salary_min=5000000&status=all',
    )
    expect(screen.getByLabelText('Search')).toHaveValue('asha')

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => {
      const last = lastSearch(searches)
      expect(['q', 'country_id', 'salary_min', 'status'].some((key) => last.has(key))).toBe(false)
    })
    expect(screen.getByLabelText('Search')).toHaveValue('')
    expect(screen.getByLabelText('Country')).toHaveDisplayValue('All countries')
    expect(screen.getByLabelText('Status')).toHaveDisplayValue('Active')
    expect(screen.queryByLabelText('Minimum salary')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('keeps the sort when filters are cleared', async () => {
    const { searches } = await renderPage('/employees?sort=-hire_date&q=asha')

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    await waitFor(() => expect(lastSearch(searches).has('q')).toBe(false))
    expect(lastSearch(searches).get('sort')).toBe('-hire_date')
  })

  it('ignores values in the URL that are not valid', async () => {
    const { searches } = await renderPage(
      '/employees?country_id=abc&status=bogus&salary_min=5&deleted=yes&department_id=-3',
    )

    for (const key of ['country_id', 'status', 'salary_min', 'deleted', 'department_id']) {
      expect(searches[0].has(key)).toBe(false)
    }
  })

  it('returns to the first page when a filter changes', async () => {
    const searches = serveEmployees((params) =>
      params.get('cursor')
        ? employeeList([buildEmployee({ id: 2, full_name: 'Second Page' })], {
            total: 2,
            next_cursor: null,
          })
        : employeeList([asha], { total: 2, per_page: 1, next_cursor: 'c1' }),
    )
    renderWithProviders(<EmployeesPage />)
    await screen.findByText('Asha Rao')
    await screen.findByRole('option', { name: 'Japan' })
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Second Page')

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'Japan')

    await waitFor(() => {
      expect(lastSearch(searches).get('country_id')).toBe('2')
      expect(lastSearch(searches).has('cursor')).toBe(false)
    })
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled()
  })

  it('warns when the dropdown options cannot be loaded, but the list still works', async () => {
    server.use(http.get('/api/v1/reference/countries', () => HttpResponse.error()))
    serveEmployees(() => employeeList([asha]))

    renderWithProviders(<EmployeesPage />)

    expect(await screen.findByText('Asha Rao')).toBeInTheDocument()
    expect(await screen.findByText(/Some filter options could not be loaded/)).toBeInTheDocument()
  })
})
