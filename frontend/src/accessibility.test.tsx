import { QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import { buildEmployee, buildSalaryRecord, employeeList, errorBody } from './test/fixtures'
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

function serveDetail(employee = asha) {
  server.use(
    http.get('/api/v1/employees/7', () => HttpResponse.json({ data: employee })),
    http.get('/api/v1/employees/7/salary_records', () =>
      HttpResponse.json({ data: [buildSalaryRecord()] }),
    ),
  )
}

const main = () => screen.getByRole('main')
const describedBy = (control: HTMLElement) =>
  document.getElementById(control.getAttribute('aria-describedby') ?? '')

describe('page titles', () => {
  it.each([
    ['/employees', 'Employees · ACME Salary Manager'],
    ['/employees/new', 'New employee · ACME Salary Manager'],
    ['/nowhere', 'Page not found · ACME Salary Manager'],
  ])('%s is titled "%s"', async (path, title) => {
    serveEmployees(() => employeeList([]))
    renderApp(path)

    await waitFor(() => expect(document.title).toBe(title))
  })

  it('names the employee on their page and on the edit page', async () => {
    serveDetail()
    const view = renderApp('/employees/7')
    await waitFor(() => expect(document.title).toBe('Asha Rao · ACME Salary Manager'))
    view.unmount()

    renderApp('/employees/7/edit')
    await waitFor(() => expect(document.title).toBe('Edit Asha Rao · ACME Salary Manager'))
  })

  it('says when an employee was not found', async () => {
    server.use(
      http.get('/api/v1/employees/7', () =>
        HttpResponse.json(errorBody('not_found', 'Employee not found'), { status: 404 }),
      ),
      http.get('/api/v1/employees/7/salary_records', () =>
        HttpResponse.json(errorBody('not_found', 'Employee not found'), { status: 404 }),
      ),
    )
    renderApp('/employees/7')

    await waitFor(() => expect(document.title).toBe('Employee not found · ACME Salary Manager'))
  })
})

describe('navigation and focus', () => {
  it('offers a way to skip the navigation, first on the page', async () => {
    serveEmployees(() => employeeList([asha]))
    renderApp('/employees')
    await screen.findByText('Asha Rao')

    const skip = screen.getByRole('link', { name: 'Skip to main content' })
    await userEvent.tab()

    expect(skip).toHaveFocus()
  })

  it('moves focus to the content when the skip link is used', async () => {
    serveEmployees(() => employeeList([asha]))
    renderApp('/employees')
    await screen.findByText('Asha Rao')

    await userEvent.click(screen.getByRole('link', { name: 'Skip to main content' }))

    expect(main()).toHaveFocus()
  })

  it('does not grab focus when the app first loads', async () => {
    serveEmployees(() => employeeList([asha]))
    renderApp('/employees')
    await screen.findByText('Asha Rao')

    expect(main()).not.toHaveFocus()
  })

  it('moves focus to the new page when navigating to another page', async () => {
    serveEmployees(() => employeeList([asha]))
    serveDetail()
    renderApp('/employees')

    await userEvent.click(await screen.findByRole('link', { name: 'Asha Rao' }))
    await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })

    expect(main()).toHaveFocus()
  })

  it('leaves focus alone when only filters or sorting change', async () => {
    serveEmployees(() => employeeList([asha]))
    renderApp('/employees')
    await screen.findByText('Asha Rao')
    await screen.findByRole('option', { name: 'Japan' })

    await userEvent.selectOptions(screen.getByLabelText('Country'), 'Japan')

    expect(screen.getByLabelText('Country')).toHaveFocus()
  })
})

describe('the employee form', () => {
  async function renderCreate() {
    renderApp('/employees/new')
    await screen.findByRole('option', { name: 'Japan' })
  }

  it('ties each problem to its field and announces the field as invalid', async () => {
    await renderCreate()

    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }))

    const name = screen.getByLabelText('Name')
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(describedBy(name)).toHaveTextContent('Enter a name.')
    const email = screen.getByLabelText('Email')
    expect(describedBy(email)).toHaveTextContent('Enter an email address.')
  })

  it('does not mark fields that are fine', async () => {
    await renderCreate()
    await userEvent.type(screen.getByLabelText('Name'), 'Asha Rao')

    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-describedby')
  })

  it('puts focus on the first field with a problem after a failed save', async () => {
    await renderCreate()
    await userEvent.type(screen.getByLabelText('Name'), 'Asha Rao')

    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('moves focus again on each failed attempt', async () => {
    await renderCreate()
    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }))
    expect(screen.getByLabelText('Name')).toHaveFocus()

    await userEvent.type(screen.getByLabelText('Name'), 'Asha Rao')
    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }))

    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('does not steal focus while the user is typing and fixing things', async () => {
    await renderCreate()
    await userEvent.click(screen.getByRole('button', { name: 'Create employee' }))

    await userEvent.type(screen.getByLabelText('Email'), 'a')

    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('points the field at the server’s message and focuses it when the API refuses', async () => {
    server.use(
      http.get('/api/v1/employees/7', () => HttpResponse.json({ data: asha })),
      http.get('/api/v1/employees/7/salary_records', () => HttpResponse.json({ data: [] })),
      http.patch('/api/v1/employees/7', () =>
        HttpResponse.json(
          errorBody('validation_failed', 'Validation failed', {
            email: ['has already been taken'],
          }),
          { status: 422 },
        ),
      ),
    )
    renderApp('/employees/7/edit')
    await screen.findByDisplayValue('Asha Rao')
    await screen.findByRole('option', { name: 'Sales' })
    await userEvent.clear(screen.getByLabelText('Email'))
    await userEvent.type(screen.getByLabelText('Email'), 'taken@acme.test')

    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    const email = screen.getByLabelText('Email')
    await waitFor(() => expect(email).toHaveFocus())
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(describedBy(email)).toHaveTextContent('Email has already been taken.')
  })
})

describe('dialogs', () => {
  async function openDialog(button: string, employee = asha) {
    serveDetail(employee)
    renderApp('/employees/7')
    await screen.findByRole('table', { name: 'Salary history, newest first' })
    await userEvent.click(screen.getByRole('button', { name: button }))
    return screen.findByRole('dialog')
  }

  it.each([
    ['Terminate', 'Terminate Asha Rao'],
    ['Change salary', 'Change salary for Asha Rao'],
    ['Delete', 'Delete Asha Rao?'],
  ])('the %s dialog is announced by its title', async (button, title) => {
    await openDialog(button)

    expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
  })

  it('puts focus in the first field when a dialog opens', async () => {
    const terminate = await openDialog('Terminate')
    await waitFor(() => expect(within(terminate).getByLabelText('Last day')).toHaveFocus())
  })

  it('puts focus in the amount when the salary dialog opens', async () => {
    const dialog = await openDialog('Change salary')
    await waitFor(() => expect(within(dialog).getByLabelText('New salary')).toHaveFocus())
  })

  it('ties a dialog field to its message and focuses it after a failed attempt', async () => {
    const dialog = await openDialog('Change salary')
    within(dialog).getByLabelText('Starts').focus()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Change salary' }))

    const amount = within(dialog).getByLabelText('New salary')
    await waitFor(() => expect(amount).toHaveFocus())
    expect(amount).toHaveAttribute('aria-invalid', 'true')
    expect(describedBy(amount)).toHaveTextContent('Enter the new salary.')
  })

  it('focuses the date when that is what is wrong', async () => {
    const dialog = await openDialog('Terminate')

    fireEvent.change(within(dialog).getByLabelText('Last day'), { target: { value: '2999-01-01' } })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terminate' }))

    const date = within(dialog).getByLabelText('Last day')
    expect(date).toHaveAttribute('aria-invalid', 'true')
    expect(describedBy(date)).toHaveTextContent('The date cannot be in the future.')
    await waitFor(() => expect(date).toHaveFocus())
  })
})

describe('the salary range filter', () => {
  it('ties both fields to the message when the range is wrong', async () => {
    serveEmployees(() => employeeList([asha]))
    renderApp('/employees?country_id=1')
    await userEvent.type(await screen.findByLabelText('Minimum salary'), '500')
    await userEvent.type(screen.getByLabelText('Maximum salary'), '100')

    const message = await screen.findByRole('alert')

    for (const field of [
      screen.getByLabelText('Minimum salary'),
      screen.getByLabelText('Maximum salary'),
    ]) {
      expect(field).toHaveAttribute('aria-invalid', 'true')
      expect(describedBy(field)).toBe(message)
    }
  })
})

describe('the deleted view', () => {
  it('keeps the Restore column reachable when the table scrolls sideways', async () => {
    serveEmployees(() =>
      employeeList([
        buildEmployee({ id: 8, full_name: 'Gone', deleted_at: '2025-06-01T00:00:00Z' }),
      ]),
    )
    renderApp('/employees?deleted=only')

    const restore = await screen.findByRole('button', { name: 'Restore Gone' })

    expect(restore.closest('td')).toHaveClass('sticky-end')
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toHaveClass('sticky-end')
  })
})
