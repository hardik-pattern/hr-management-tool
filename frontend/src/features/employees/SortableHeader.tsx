import type { EmployeeSort } from '../../api/types'
import { nextSort, type SortableColumn } from './useListParams'

interface Props {
  column: SortableColumn
  label: string
  sort: EmployeeSort
  onSort: (sort: EmployeeSort) => void
}

/** A column header that sorts the list when clicked and announces its state. */
export default function SortableHeader({ column, label, sort, onSort }: Props) {
  const ariaSort = sort === column ? 'ascending' : sort === `-${column}` ? 'descending' : 'none'
  const indicator = ariaSort === 'ascending' ? '▲' : ariaSort === 'descending' ? '▼' : ''

  return (
    <th scope="col" aria-sort={ariaSort}>
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
