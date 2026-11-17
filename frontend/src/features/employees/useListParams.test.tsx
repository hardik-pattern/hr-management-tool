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

  it('does not accept salary as a sort without a country, since amounts are in different currencies', () => {
    const { result } = renderParams('/employees?sort=current_salary_cents')

    expect(result.current.params.sort).toBe('full_name')
    expect(result.current.params.salarySortable).toBe(false)
  })

  it('accepts salary as a sort once a country is chosen', () => {
    const { result } = renderParams('/employees?country_id=1&sort=-current_salary_cents')

    expect(result.current.params.sort).toBe('-current_salary_cents')
    expect(result.current.params.salarySortable).toBe(true)
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

  describe('filters', () => {
    it('are empty for a bare URL', () => {
      const { result } = renderParams('/employees')

      expect(result.current.params.filters).toEqual({})
      expect(result.current.params.hasFilters).toBe(false)
    })

    it('are read from the URL', () => {
      const { result } = renderParams(
        '/employees?q=%20asha%20&country_id=1&department_id=2&job_title_id=3&status=all&deleted=only&salary_min=100&salary_max=900',
      )

      expect(result.current.params.filters).toEqual({
        q: 'asha',
        country_id: 1,
        department_id: 2,
        job_title_id: 3,
        status: 'all',
        deleted: 'only',
        salary_min: 100,
        salary_max: 900,
      })
      expect(result.current.params.hasFilters).toBe(true)
    })

    it('ignore values that are not valid', () => {
      const { result } = renderParams(
        '/employees?country_id=abc&department_id=-1&job_title_id=1.5&status=bogus&deleted=yes&q=%20%20',
      )

      expect(result.current.params.filters).toEqual({})
    })

    it('drop a salary range that has no country, since the API would refuse it', () => {
      const { result } = renderParams('/employees?salary_min=100&salary_max=900')

      expect(result.current.params.filters).toEqual({})
    })

    it('accept a salary of zero', () => {
      const { result } = renderParams('/employees?country_id=1&salary_min=0')

      expect(result.current.params.filters.salary_min).toBe(0)
    })

    it('are written together in one URL update, and undefined removes a filter', () => {
      const { result } = renderParams('/employees?country_id=1&salary_min=500')

      act(() => result.current.params.setFilters({ country_id: 2, salary_min: undefined, q: 'x' }))

      expect(new URLSearchParams(result.current.location.search).toString()).toBe(
        'country_id=2&q=x',
      )
    })

    it('take a salary sort out of the URL when the country is cleared', () => {
      const { result } = renderParams('/employees?country_id=1&sort=-current_salary_cents&q=a')

      act(() => result.current.params.setFilters({ country_id: undefined }))

      expect(result.current.location.search).toBe('?q=a')
    })

    it('keep a salary sort when the country is only changed', () => {
      const { result } = renderParams('/employees?country_id=1&sort=-current_salary_cents')

      act(() => result.current.params.setFilters({ country_id: 2 }))

      expect(result.current.location.search).toBe('?country_id=2&sort=-current_salary_cents')
    })

    it('are all removed by clearFilters, leaving sort and page size alone', () => {
      const { result } = renderParams(
        '/employees?q=a&country_id=1&status=all&sort=-hire_date&per_page=50',
      )

      act(() => result.current.params.clearFilters())

      expect(result.current.location.search).toBe('?sort=-hire_date&per_page=50')
      expect(result.current.params.hasFilters).toBe(false)
    })
  })
})
