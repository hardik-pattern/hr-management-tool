import { Button, Table } from 'react-bootstrap'
import { Link, useLocation } from 'react-router-dom'
import type { Employee, EmployeeSort } from '../../api/types'
import { formatDate } from '../../lib/format'
import SortableHeader from './SortableHeader'
import StatusBadge from './StatusBadge'

interface Props {
  employees: Employee[]
  sort: EmployeeSort
  onSort: (sort: EmployeeSort) => void
  /** True while showing the previous page's rows during a fetch. */
  stale?: boolean
  /** Salary can be sorted once a country is chosen, because then it is one currency. */
  salarySortable?: boolean
  /** When given (in the deleted view), each row gets a Restore button. */
  onRestore?: (employee: Employee) => void
  /** The employee being restored right now, if any. */
  restoringId?: number
}

export default function EmployeeTable({
  employees,
  sort,
  onSort,
  stale = false,
  salarySortable = false,
  onRestore,
  restoringId,
}: Props) {
  // Handed to the detail page so its Back link returns to this filtered, sorted view.
  const listSearch = useLocation().search

  return (
    <div className="table-responsive">
      <Table hover aria-busy={stale} className={stale ? 'opacity-50' : undefined}>
        <caption className="visually-hidden">Employees</caption>
        <thead>
          <tr>
            <SortableHeader column="employee_number" label="Number" sort={sort} onSort={onSort} />
            <SortableHeader column="full_name" label="Name" sort={sort} onSort={onSort} />
            <th scope="col">Department</th>
            <th scope="col">Job title</th>
            <th scope="col">Country</th>
            <SortableHeader column="hire_date" label="Hired" sort={sort} onSort={onSort} />
            <th scope="col">Status</th>
            {salarySortable ? (
              <SortableHeader
                column="current_salary_cents"
                label="Salary"
                sort={sort}
                onSort={onSort}
                alignEnd
              />
            ) : (
              <th scope="col" className="text-end">
                Salary
              </th>
            )}
            {onRestore && (
              <th scope="col" className="sticky-end">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td className="text-nowrap">{employee.employee_number}</td>
              <td>
                {employee.deleted_at ? (
                  // A deleted employee cannot be opened; the API answers 404 for them.
                  <span className="text-body-secondary">{employee.full_name} (deleted)</span>
                ) : (
                  <Link to={`/employees/${employee.id}`} state={{ listSearch }}>
                    {employee.full_name}
                  </Link>
                )}
                <div className="small text-body-secondary">{employee.email}</div>
              </td>
              <td>{employee.department.name}</td>
              <td>{employee.job_title.name}</td>
              <td>{employee.country.name}</td>
              <td className="text-nowrap">{formatDate(employee.hire_date)}</td>
              <td>
                <StatusBadge status={employee.status} />
              </td>
              <td className="text-end text-nowrap">{employee.salary.formatted}</td>
              {onRestore && (
                <td className="sticky-end">
                  <Button
                    size="sm"
                    variant="outline-primary"
                    aria-label={`Restore ${employee.full_name}`}
                    disabled={restoringId !== undefined}
                    onClick={() => onRestore(employee)}
                  >
                    {restoringId === employee.id ? 'Restoring…' : 'Restore'}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
