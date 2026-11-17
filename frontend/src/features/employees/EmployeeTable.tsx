import { Table } from 'react-bootstrap'
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
}

// Salary is not sortable yet: amounts are in each employee's own currency, so
// ordering across countries would be misleading.
export default function EmployeeTable({ employees, sort, onSort, stale = false }: Props) {
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
            <th scope="col" className="text-end">
              Salary
            </th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id}>
              <td className="text-nowrap">{employee.employee_number}</td>
              <td>
                {employee.full_name}
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
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  )
}
