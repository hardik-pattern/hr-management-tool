import { render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useFlash } from './useFlash'

function Probe() {
  const [flash] = useFlash()
  const location = useLocation()
  return (
    <>
      <p data-testid="flash">{JSON.stringify(flash)}</p>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
      <p data-testid="where">{location.pathname + location.search}</p>
    </>
  )
}

const renderAt = (entry: Parameters<typeof MemoryRouter>[0]['initialEntries']) =>
  render(
    <MemoryRouter initialEntries={entry}>
      <Probe />
    </MemoryRouter>,
  )

describe('useFlash', () => {
  it('is empty when the page was opened without a message', () => {
    renderAt(['/employees'])

    expect(JSON.parse(screen.getByTestId('flash').textContent!)).toEqual({})
  })

  it('hands the page the message it was sent with', () => {
    renderAt([{ pathname: '/employees/7', state: { notice: 'Employee created.' } }])

    expect(JSON.parse(screen.getByTestId('flash').textContent!)).toEqual({
      notice: 'Employee created.',
    })
  })

  it('also carries a delete that can be undone', () => {
    renderAt([{ pathname: '/employees', state: { undo: { id: 3, name: 'Asha Rao' } } }])

    expect(JSON.parse(screen.getByTestId('flash').textContent!)).toEqual({
      undo: { id: 3, name: 'Asha Rao' },
    })
  })

  it('removes the message from the history entry so a reload does not repeat it', () => {
    renderAt([{ pathname: '/employees/7', state: { notice: 'Employee created.' } }])

    expect(screen.getByTestId('state')).toHaveTextContent('null')
    // ...but the page keeps showing it.
    expect(screen.getByTestId('flash')).toHaveTextContent('Employee created.')
  })

  it('keeps other navigation state, such as where Back should go', () => {
    renderAt([{ pathname: '/employees/7', state: { notice: 'Saved.', listSearch: '?q=asha' } }])

    expect(JSON.parse(screen.getByTestId('state').textContent!)).toEqual({ listSearch: '?q=asha' })
  })

  it('keeps the address, including its query string', () => {
    renderAt([
      { pathname: '/employees', search: '?q=asha&sort=-hire_date', state: { notice: 'x' } },
    ])

    expect(screen.getByTestId('where')).toHaveTextContent('/employees?q=asha&sort=-hire_date')
  })
})
