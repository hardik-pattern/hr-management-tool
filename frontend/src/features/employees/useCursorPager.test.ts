import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCursorPager } from './useCursorPager'

describe('useCursorPager', () => {
  it('starts on the first page with no cursor', () => {
    const { result } = renderHook(() => useCursorPager('a'))

    expect(result.current.cursor).toBeUndefined()
    expect(result.current.pageIndex).toBe(0)
  })

  it('moves forward through cursors and back again', () => {
    const { result } = renderHook(() => useCursorPager('a'))

    act(() => result.current.goNext('c1'))
    act(() => result.current.goNext('c2'))
    expect(result.current).toMatchObject({ cursor: 'c2', pageIndex: 2 })

    act(() => result.current.goPrevious())
    expect(result.current).toMatchObject({ cursor: 'c1', pageIndex: 1 })

    act(() => result.current.goPrevious())
    expect(result.current).toMatchObject({ cursor: undefined, pageIndex: 0 })
  })

  it('stays on the first page when asked to go back from it', () => {
    const { result } = renderHook(() => useCursorPager('a'))

    act(() => result.current.goPrevious())

    expect(result.current.pageIndex).toBe(0)
  })

  it('returns to the first page when the view changes', () => {
    const { result, rerender } = renderHook(({ key }) => useCursorPager(key), {
      initialProps: { key: 'sort-a' },
    })
    act(() => result.current.goNext('c1'))
    expect(result.current.pageIndex).toBe(1)

    rerender({ key: 'sort-b' })

    expect(result.current).toMatchObject({ cursor: undefined, pageIndex: 0 })
  })

  it('pages again from the new view after a reset', () => {
    const { result, rerender } = renderHook(({ key }) => useCursorPager(key), {
      initialProps: { key: 'sort-a' },
    })
    act(() => result.current.goNext('old'))
    rerender({ key: 'sort-b' })

    act(() => result.current.goNext('new'))

    expect(result.current).toMatchObject({ cursor: 'new', pageIndex: 1 })
  })
})
