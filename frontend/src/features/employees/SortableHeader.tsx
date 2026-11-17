import type { EmployeeSort } from '../../api/types'
import { nextSort, type SortableColumn } from './useListParams'

interface Props {
  column: SortableColumn
  label: string
  sort: EmployeeSort
  onSort: (sort: EmployeeSort) => void
  /** Right-align, for numeric columns. */
  alignEnd?: boolean
}

/** A column header that sorts the list when clicked and announces its state. */
export default function SortableHeader({ column, label, sort, onSort, alignEnd }: Props) {
  const ariaSort = sort === column ? 'ascending' : sort === `-${column}` ? 'descending' : 'none'
  const indicator = ariaSort === 'ascending' ? '▲' : ariaSort === 'descending' ? '▼' : ''

  return (
    <th scope="col" aria-sort={ariaSort} className={alignEnd ? 'text-end' : undefined}>
      <button
        type="button"
        className="btn btn-link p-0 fw-semibold text-decoration-none text-reset"
        onClick={() => onSort(nextSort(sort, column))}
      >
        {label}
        <span aria-hidden="true" className="ms-1">
          {indicator}
        </span>
      </button>
    </th>
  )
}
