import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useExplorerParams } from './useExplorerParams'

function renderParams(route: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
  )
  return renderHook(() => ({ explorer: useExplorerParams(), location: useLocation() }), { wrapper })
}

describe('useExplorerParams', () => {
  it('starts with a useful question: median pay by department, active employees', () => {
    const { result } = renderParams('/explorer')

    expect(result.current.explorer.params).toEqual({
      metric: 'median',
      group_by: ['department'],
      status: 'active',
    })
    expect(result.current.explorer.isDefault).toBe(true)
  })

  it('reads the whole question from the address', () => {
    const { result } = renderParams(
      '/explorer?metric=iqr&group_by=country,gender&status=all&country_id=3&department_id=2&job_title_id=9&gender=female&level=4',
    )

    expect(result.current.explorer.params).toEqual({
      metric: 'iqr',
      group_by: ['country', 'gender'],
      status: 'all',
      country_id: 3,
      department_id: 2,
      job_title_id: 9,
      gender: 'female',
      level: 4,
    })
    expect(result.current.explorer.isDefault).toBe(false)
  })

  it('ignores values that are not valid, so a hand-edited address cannot break the page', () => {
    const { result } = renderParams(
      '/explorer?metric=mode&status=retired&country_id=abc&department_id=-2&gender=x&level=9&group_by=salary,country',
    )

    expect(result.current.explorer.params).toEqual({
      metric: 'median',
      group_by: ['country'],
      status: 'active',
    })
  })

  it('takes at most two groupings, without repeats', () => {
    const { result } = renderParams('/explorer?group_by=country,country,department,gender')

    expect(result.current.explorer.params.group_by).toEqual(['country', 'department'])
  })

  it('treats an explicitly empty grouping as "no grouping", not the default', () => {
    const { result } = renderParams('/explorer?group_by=')

    expect(result.current.explorer.params.group_by).toEqual([])
  })

  it('writes changes to the address, leaving defaults out of it', () => {
    const { result } = renderParams('/explorer')

    act(() => result.current.explorer.set({ metric: 'p75', status: 'terminated', country_id: 4 }))
    expect(new URLSearchParams(result.current.location.search).toString()).toBe(
      'metric=p75&status=terminated&country_id=4',
    )

    act(() =>
      result.current.explorer.set({ metric: 'median', status: 'active', country_id: undefined }),
    )
    expect(result.current.location.search).toBe('')
  })

  it('remembers that no grouping was chosen, rather than falling back to the default', () => {
    const { result } = renderParams('/explorer')

    act(() => result.current.explorer.set({ group_by: [] }))

    expect(result.current.location.search).toBe('?group_by=')
    expect(result.current.explorer.params.group_by).toEqual([])
  })

  it('writes two groupings as one value, and drops the address entry for the default grouping', () => {
    const { result } = renderParams('/explorer')

    act(() => result.current.explorer.set({ group_by: ['country', 'level'] }))
    expect(result.current.location.search).toBe('?group_by=country%2Clevel')

    act(() => result.current.explorer.set({ group_by: ['department'] }))
    expect(result.current.location.search).toBe('')
  })

  it('goes back to the starting question on reset', () => {
    const { result } = renderParams('/explorer?metric=max&country_id=2')

    act(() => result.current.explorer.reset())

    expect(result.current.location.search).toBe('')
    expect(result.current.explorer.isDefault).toBe(true)
  })
})
