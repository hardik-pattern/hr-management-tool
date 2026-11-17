import { useSearchParams } from 'react-router-dom'
import type { EmployeeFilters, EmployeeSort, StatusFilter } from '../../api/types'

export type SortableColumn = 'full_name' | 'hire_date' | 'employee_number' | 'current_salary_cents'

/** Sortable whatever the filters. */
const ALWAYS_SORTABLE: readonly SortableColumn[] = ['full_name', 'hire_date', 'employee_number']

export const PAGE_SIZES = [25, 50, 100] as const
export const DEFAULT_SORT: EmployeeSort = 'full_name'
export const DEFAULT_PAGE_SIZE = 25

export type ListFilters = Pick<
  EmployeeFilters,
  | 'q'
  | 'country_id'
  | 'department_id'
  | 'job_title_id'
  | 'status'
  | 'deleted'
  | 'salary_min'
  | 'salary_max'
>

const STATUSES: readonly StatusFilter[] = ['active', 'terminated', 'all']

/** Sort order for a click on a column header: ascending first, then flip. */
export function nextSort(current: EmployeeSort, column: SortableColumn): EmployeeSort {
  return current === column ? `-${column}` : column
}

function positiveInteger(raw: string | null): number | undefined {
  const value = Number(raw)
  return raw && Number.isInteger(value) && value > 0 ? value : undefined
}

function nonNegativeInteger(raw: string | null): number | undefined {
  const value = Number(raw)
  return raw && Number.isInteger(value) && value >= 0 ? value : undefined
}

function parseFilters(params: URLSearchParams): ListFilters {
  const country_id = positiveInteger(params.get('country_id'))
  const status = params.get('status') as StatusFilter | null
  const q = params.get('q')?.trim()

  const filters: ListFilters = {
    q: q || undefined,
    country_id,
    department_id: positiveInteger(params.get('department_id')),
    job_title_id: positiveInteger(params.get('job_title_id')),
    status: status && STATUSES.includes(status) ? status : undefined,
    deleted: params.get('deleted') === 'only' ? 'only' : undefined,
    // Salaries are in each country's currency, so a range means nothing without one.
    salary_min: country_id ? nonNegativeInteger(params.get('salary_min')) : undefined,
    salary_max: country_id ? nonNegativeInteger(params.get('salary_max')) : undefined,
  }
  // Drop absent keys so "any filter set?" is just a key count.
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined))
}

/**
 * The list's sort order, page size and filters, kept in the URL so a reload
 * or a shared link shows the same view. Anything that is not valid is
 * ignored, so a hand-edited URL cannot break the page. Defaults are left out
 * of the URL to keep it short.
 */
export function useListParams() {
  const [params, setParams] = useSearchParams()
  const filters = parseFilters(params)

  // Amounts in different currencies do not compare, so salary sorting needs a country.
  const salarySortable = filters.country_id !== undefined
  const validSorts = new Set<string>(
    [...ALWAYS_SORTABLE, ...(salarySortable ? (['current_salary_cents'] as const) : [])].flatMap(
      (column) => [column, `-${column}`],
    ),
  )
  const rawSort = params.get('sort')
  const sort = (rawSort && validSorts.has(rawSort) ? rawSort : DEFAULT_SORT) as EmployeeSort

  const rawPerPage = Number(params.get('per_page'))
  const perPage = (PAGE_SIZES as readonly number[]).includes(rawPerPage)
    ? rawPerPage
    : DEFAULT_PAGE_SIZE

  /** Applies several changes in one navigation; undefined or '' removes a key. */
  const update = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      const isDefault =
        (key === 'sort' && value === DEFAULT_SORT) ||
        (key === 'per_page' && value === DEFAULT_PAGE_SIZE)
      if (value === undefined || value === '' || isDefault) next.delete(key)
      else next.set(key, String(value))
    }
    // A salary sort only makes sense within one country; do not leave it
    // lying in the URL to come back by surprise when a country is chosen again.
    if (!next.get('country_id') && next.get('sort')?.endsWith('current_salary_cents')) {
      next.delete('sort')
    }
    setParams(next, { replace: true })
  }

  return {
    sort,
    perPage,
    filters,
    salarySortable,
    hasFilters: Object.keys(filters).length > 0,
    setSort: (value: EmployeeSort) => update({ sort: value }),
    setPerPage: (value: number) => update({ per_page: value }),
    setFilters: (changes: { [K in keyof ListFilters]?: ListFilters[K] | undefined }) =>
      update(changes),
    clearFilters: () =>
      update({
        q: undefined,
        country_id: undefined,
        department_id: undefined,
        job_title_id: undefined,
        status: undefined,
        deleted: undefined,
        salary_min: undefined,
        salary_max: undefined,
      }),
  }
}
