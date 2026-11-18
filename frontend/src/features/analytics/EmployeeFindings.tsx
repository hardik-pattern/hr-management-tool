import { Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import type { EmployeeBrief, OutOfBand, StaleSalaries } from '../../api/types'
import { formatDate, formatDuration } from '../../lib/format'

function EmployeeCell({ employee }: { employee: EmployeeBrief }) {
  return (
    <th scope="row" className="fw-normal">
      <Link to={`/employees/${employee.id}`}>{employee.full_name}</Link>
      <div className="small text-body-secondary">{employee.employee_number}</div>
    </th>
  )
}

function Footer({ shown, total }: { shown: number; total: number }) {
  return total > shown ? (
    <p className="small text-body-secondary mb-0">
      Showing {shown} of {total}.
    </p>
  ) : null
}

/** Employees paid outside the pay band for their job title and country. */
export function OutOfBandTable({ data, limit }: { data: OutOfBand; limit?: number }) {
  const rows = limit ? data.rows.slice(0, limit) : data.rows
  if (rows.length === 0)
    return <p className="text-body-secondary mb-0">Nobody is paid outside their band.</p>

  return (
    <>
      <div className="table-responsive">
        <Table size="sm" hover>
          <caption className="visually-hidden">Employees paid outside their pay band</caption>
          <thead>
            <tr>
              <th scope="col">Employee</th>
              <th scope="col">Job title</th>
              <th scope="col">Country</th>
              <th scope="col" className="text-end">
                Salary
              </th>
              <th scope="col">Band</th>
              <th scope="col" className="text-end">
                Outside by
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <EmployeeCell employee={row} />
                <td>{row.job_title.name}</td>
                <td>{row.country.name}</td>
                <td className="text-end text-nowrap">{row.salary.formatted}</td>
                <td className="text-nowrap small">{row.band.formatted}</td>
                <td className="text-end text-nowrap">
                  {row.distance_percent.toFixed(1)}% {row.direction}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Footer shown={rows.length} total={data.total} />
    </>
  )
}

/** Employees whose salary has not changed for a long time. */
export function StaleSalariesTable({ data, limit }: { data: StaleSalaries; limit?: number }) {
  const rows = limit ? data.rows.slice(0, limit) : data.rows
  if (rows.length === 0)
    return (
      <p className="text-body-secondary mb-0">
        Everyone has had a change in the last {data.months} months.
      </p>
    )

  return (
    <>
      <div className="table-responsive">
        <Table size="sm" hover>
          <caption className="visually-hidden">
            Employees with no salary change in {data.months} months
          </caption>
          <thead>
            <tr>
              <th scope="col">Employee</th>
              <th scope="col">Job title</th>
              <th scope="col">Country</th>
              <th scope="col" className="text-end">
                Salary
              </th>
              <th scope="col">Last change</th>
              <th scope="col" className="text-end">
                Ago
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <EmployeeCell employee={row} />
                <td>{row.job_title.name}</td>
                <td>{row.country.name}</td>
                <td className="text-end text-nowrap">{row.salary.formatted}</td>
                <td className="text-nowrap">{formatDate(row.last_change_on)}</td>
                <td className="text-end text-nowrap">{formatDuration(row.months_since)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <Footer shown={rows.length} total={data.total} />
    </>
  )
}
