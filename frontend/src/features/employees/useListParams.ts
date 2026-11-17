import { useSearchParams } from 'react-router-dom'
import type { EmployeeSort } from '../../api/types'

export const SORTABLE_COLUMNS = ['full_name', 'hire_date', 'employee_number'] as const
export type SortableColumn = (typeof SORTABLE_COLUMNS)[number]

export const PAGE_SIZES = [25, 50, 100] as const
export const DEFAULT_SORT: EmployeeSort = 'full_name'
export const DEFAULT_PAGE_SIZE = 25

const VALID_SORTS = new Set<string>(SORTABLE_COLUMNS.flatMap((column) => [column, `-${column}`]))

/** Sort order for a click on a column header: ascending first, then flip. */
export function nextSort(current: EmployeeSort, column: SortableColumn): EmployeeSort {
  return current === column ? `-${column}` : column
}

/**
 * The list's sort order and page size, kept in the URL so a reload or a
 * shared link shows the same view. Values that are not valid fall back to the
 * defaults, so a hand-edited URL cannot break the page.
 */
export function useListParams() {
  const [params, setParams] = useSearchParams()

  const rawSort = params.get('sort')
  const sort = (rawSort && VALID_SORTS.has(rawSort) ? rawSort : DEFAULT_SORT) as EmployeeSort

  const rawPerPage = Number(params.get('per_page'))
  const perPage = (PAGE_SIZES as readonly number[]).includes(rawPerPage)
    ? rawPerPage
    : DEFAULT_PAGE_SIZE

  // Defaults are left out of the URL to keep it short.
  const update = (changes: { sort?: EmployeeSort; perPage?: number }) => {
    const next = new URLSearchParams(params)
    if (changes.sort !== undefined) {
      if (changes.sort === DEFAULT_SORT) next.delete('sort')
      else next.set('sort', changes.sort)
    }
    if (changes.perPage !== undefined) {
      if (changes.perPage === DEFAULT_PAGE_SIZE) next.delete('per_page')
      else next.set('per_page', String(changes.perPage))
    }
    setParams(next, { replace: true })
  }

  return {
    sort,
    perPage,
    setSort: (value: EmployeeSort) => update({ sort: value }),
    setPerPage: (value: number) => update({ perPage: value }),
  }
}
