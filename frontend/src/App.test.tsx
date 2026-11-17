import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App shell', () => {
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
