import { render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { createWrapper } from './test/queryWrapper'
import { employeeList } from './test/fixtures'
import { server } from './test/server'

function renderAt(path: string) {
  const { queryClient } = createWrapper()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App shell', () => {
  // The employees page loads its list on arrival.
  beforeEach(() => {
    server.use(http.get('/api/v1/employees', () => HttpResponse.json(employeeList([]))))
  })

  it('shows the brand and the main navigation', () => {
    renderAt('/employees')

    expect(screen.getByRole('link', { name: 'ACME Salary Manager' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav).toHaveTextContent('Employees')
  })

  it('redirects the root to the employees page', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { name: 'Employees' })).toBeInTheDocument()
  })

  it('marks the current section in the navigation', () => {
    renderAt('/employees')

    expect(screen.getByRole('link', { name: 'Employees' })).toHaveClass('active')
  })

  it('shows a not-found page with a way back for unknown addresses', () => {
    renderAt('/nope')

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to employees' })).toHaveAttribute(
      'href',
      '/employees',
    )
  })
})
