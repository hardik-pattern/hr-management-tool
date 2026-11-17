import { QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import { buildEmployee, buildSalaryRecord, employeeList, errorBody } from './test/fixtures'
import { createWrapper } from './test/queryWrapper'
import { serveEmployees } from './test/serveEmployees'
import { server } from './test/server'

const asha = buildEmployee({ id: 7, full_name: 'Asha Rao' })
const gone = buildEmployee({ id: 8, full_name: 'Gone Person', deleted_at: '2025-06-01T00:00:00Z' })

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

/** Records restore calls for employee +id+ and answers with +respond+. */
function serveRestore(
  id: number,
  respond: () => Response = () => HttpResponse.json({ data: asha }),
) {
  const calls: number[] = []
  server.use(
    http.post(`/api/v1/employees/${id}/restore`, () => {
      calls.push(id)
      return respond()
    }),
  )
  return calls
}

const emailTaken = () =>
  HttpResponse.json(
    errorBody('validation_failed', 'Validation failed', { email: ['has already been taken'] }),
    { status: 422 },
  )

describe('deleting an employee, then undoing it', () => {
  function serveDelete() {
    const deletes: string[] = []
    server.use(
      http.get('/api/v1/employees/7', () => HttpResponse.json({ data: asha })),
      http.get('/api/v1/employees/7/salary_records', () =>
        HttpResponse.json({ data: [buildSalaryRecord()] }),
      ),
      http.delete('/api/v1/employees/7', () => {
        deletes.push('7')
        return HttpResponse.json({ data: { ...asha, deleted_at: '2025-06-01T00:00:00Z' } })
      }),
    )
    return deletes
  }

  async function deleteFromDetail(route = '/employees?q=asha&sort=-hire_date') {
    const searches = serveEmployees(() => employeeList([asha]))
    const deletes = serveDelete()
    renderApp(route)
    await userEvent.click(await screen.findByRole('link', { name: 'Asha Rao' }))
    await screen.findByRole('heading', { name: 'Asha Rao', level: 1 })
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
    )
    return { searches, deletes }
  }

  it('returns to the same filtered list and offers Undo', async () => {
    const { searches, deletes } = await deleteFromDetail()

    expect(await screen.findByText(/Deleted Asha Rao\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(deletes).toEqual(['7'])
    expect(screen.getByLabelText('Search')).toHaveValue('asha')
    await waitFor(() => expect(searches.at(-1)?.get('sort')).toBe('-hire_date'))
  })

  it('restores the employee in one click', async () => {
    await deleteFromDetail()
    const restores = serveRestore(7)

    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    expect(await screen.findByText('Restored Asha Rao.')).toBeInTheDocument()
    expect(restores).toEqual([7])
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument()
  })

  it('explains why Undo failed, such as the email being taken since', async () => {
    await deleteFromDetail()
    serveRestore(7, emailTaken)

    await userEvent.click(await screen.findByRole('button', { name: 'Undo' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not restore Asha Rao.')
    expect(alert).toHaveTextContent('Email has already been taken.')
  })

  it('lets the message be dismissed', async () => {
    await deleteFromDetail()
    await screen.findByText(/Deleted Asha Rao\./)

    await userEvent.click(screen.getByRole('button', { name: /close/i }))

    await waitFor(() => expect(screen.queryByText(/Deleted Asha Rao\./)).not.toBeInTheDocument())
  })
})

describe('restoring from the deleted view', () => {
  it('offers Restore on each deleted row, and only in that view', async () => {
    serveEmployees((params) => employeeList(params.get('deleted') === 'only' ? [gone] : [asha]))
    renderApp('/employees')
    await screen.findByText('Asha Rao')
    expect(screen.queryByRole('button', { name: /Restore/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByLabelText('Show deleted'))

    expect(await screen.findByRole('button', { name: 'Restore Gone Person' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument()
  })

  it('restores an employee and says so', async () => {
    const searches = serveEmployees(() => employeeList([gone]))
    const restores = serveRestore(8)
    renderApp('/employees?deleted=only')

    await userEvent.click(await screen.findByRole('button', { name: 'Restore Gone Person' }))

    expect(await screen.findByText('Restored Gone Person.')).toBeInTheDocument()
    expect(restores).toEqual([8])
    // The list is refreshed, so the restored employee leaves the deleted view.
    await waitFor(() => expect(searches.length).toBeGreaterThan(1))
  })

  it('explains a refused restore and keeps the row', async () => {
    serveEmployees(() => employeeList([gone]))
    serveRestore(8, emailTaken)
    renderApp('/employees?deleted=only')

    await userEvent.click(await screen.findByRole('button', { name: 'Restore Gone Person' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Could not restore Gone Person.')
    expect(alert).toHaveTextContent('Email has already been taken.')
    expect(screen.getByRole('button', { name: 'Restore Gone Person' })).toBeEnabled()
  })

  it('disables Restore while one is in progress, so it cannot be sent twice', async () => {
    serveEmployees(() => employeeList([gone]))
    const calls: number[] = []
    server.use(
      http.post('/api/v1/employees/8/restore', async () => {
        calls.push(8)
        await new Promise((resolve) => setTimeout(resolve, 150))
        return HttpResponse.json({ data: asha })
      }),
    )
    renderApp('/employees?deleted=only')
    const button = await screen.findByRole('button', { name: 'Restore Gone Person' })

    await userEvent.dblClick(button)

    await screen.findByText('Restored Gone Person.')
    expect(calls).toEqual([8])
  })
})
