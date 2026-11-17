import { Alert, Button, Spinner } from 'react-bootstrap'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useEmployee } from '../api/employees'
import { useSalaryRecords } from '../api/salary'
import EmployeeProfile from '../features/employees/EmployeeProfile'
import SalaryHistory from '../features/employees/SalaryHistory'

/** What the list passes along so Back returns to the same filtered, sorted view. */
export interface ListLocationState {
  listSearch?: string
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const state = useLocation().state as ListLocationState | null
  const id = /^[1-9]\d*$/.test(params.id ?? '') ? Number(params.id) : undefined

  const employee = useEmployee(id)
  const history = useSalaryRecords(id)
  const backTo = `/employees${state?.listSearch ?? ''}`
  const notFound = id === undefined || employee.error?.isNotFound === true
  const failed = id !== undefined && employee.error && !notFound

  return (
    <>
      <p className="mb-3">
        <Link to={backTo}>← Back to employees</Link>
      </p>

      {employee.isPending && id !== undefined && (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading employee</span>
          </Spinner>
        </div>
      )}

      {notFound && (
        <>
          <h1 className="h3">Employee not found</h1>
          <p className="text-body-secondary">
            There is no employee at this address. They may have been deleted.
          </p>
        </>
      )}

      {failed && (
        <Alert variant="danger" role="alert">
          <p className="mb-2">Could not load this employee. {employee.error?.message}</p>
          <Button
            variant="outline-danger"
            size="sm"
            onClick={() => employee.refetch()}
            disabled={employee.isFetching}
          >
            Try again
          </Button>
        </Alert>
      )}

      {employee.data && (
        <>
          <h1 className="h3 mb-4">{employee.data.full_name}</h1>
          <EmployeeProfile employee={employee.data} latestRecord={history.data?.[0]} />
          <SalaryHistory history={history} />
        </>
      )}
    </>
  )
}
