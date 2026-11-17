import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { nextSort, useListParams } from './useListParams'

function renderParams(route: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ params: useListParams(), location: useLocation() }), { wrapper })
}

describe('nextSort', () => {
  it('sorts ascending first, then flips to descending, then back', () => {
    expect(nextSort('full_name', 'hire_date')).toBe('hire_date')
    expect(nextSort('hire_date', 'hire_date')).toBe('-hire_date')
    expect(nextSort('-hire_date', 'hire_date')).toBe('hire_date')
  })
})

describe('useListParams', () => {
  it('uses the defaults for a bare URL', () => {
    const { result } = renderParams('/employees')

    expect(result.current.params).toMatchObject({ sort: 'full_name', perPage: 25 })
  })

  it('reads sort and page size from the URL', () => {
    const { result } = renderParams('/employees?sort=-hire_date&per_page=50')

    expect(result.current.params).toMatchObject({ sort: '-hire_date', perPage: 50 })
  })

  it('falls back to defaults for values that are not allowed', () => {
    const { result } = renderParams('/employees?sort=email&per_page=7')

    expect(result.current.params).toMatchObject({ sort: 'full_name', perPage: 25 })
  })

  it('does not accept salary as a sort, since amounts are in different currencies', () => {
    const { result } = renderParams('/employees?sort=current_salary_cents')

    expect(result.current.params.sort).toBe('full_name')
  })

  it('writes changes to the URL and leaves defaults out of it', () => {
    const { result } = renderParams('/employees')

    act(() => result.current.params.setSort('-hire_date'))
    expect(result.current.location.search).toBe('?sort=-hire_date')

    act(() => result.current.params.setPerPage(100))
    expect(result.current.location.search).toBe('?sort=-hire_date&per_page=100')

    act(() => result.current.params.setSort('full_name'))
    act(() => result.current.params.setPerPage(25))
    expect(result.current.location.search).toBe('')
  })
})
