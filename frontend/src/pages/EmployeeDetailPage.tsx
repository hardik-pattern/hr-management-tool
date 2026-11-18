import { useState } from 'react'
import { Alert, Button, Spinner } from 'react-bootstrap'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useEmployee } from '../api/employees'
import { useSalaryRecords } from '../api/salary'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import ChangeSalaryDialog from '../features/employees/ChangeSalaryDialog'
import DeleteDialog from '../features/employees/DeleteDialog'
import EmployeeProfile from '../features/employees/EmployeeProfile'
import RehireDialog from '../features/employees/RehireDialog'
import TerminateDialog from '../features/employees/TerminateDialog'
import { useFlash } from '../features/employees/useFlash'
import SalaryHistory from '../features/employees/SalaryHistory'

/** What the list passes along so Back returns to the same filtered, sorted view. */
export interface ListLocationState {
  listSearch?: string
}

export default function EmployeeDetailPage() {
  const params = useParams()
  const state = useLocation().state as ListLocationState | null
  const navigate = useNavigate()
  const [flash, setFlash] = useFlash()
  const [dialog, setDialog] = useState<'salary' | 'terminate' | 'rehire' | 'delete' | null>(null)
  const id = /^[1-9]\d*$/.test(params.id ?? '') ? Number(params.id) : undefined

  const employee = useEmployee(id)
  const history = useSalaryRecords(id)
  const backTo = `/employees${state?.listSearch ?? ''}`
  const notFound = id === undefined || employee.error?.isNotFound === true
  useDocumentTitle(notFound ? 'Employee not found' : (employee.data?.full_name ?? 'Employee'))
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
          {flash.notice && (
            <Alert variant="success" dismissible role="status" onClose={() => setFlash({})}>
              {flash.notice}
            </Alert>
          )}
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
            <h1 className="h3 mb-0">{employee.data.full_name}</h1>
            <div className="d-flex gap-2">
              <Link to={`/employees/${employee.data.id}/edit`} className="btn btn-outline-primary">
                Edit
              </Link>
              {employee.data.status === 'active' ? (
                <>
                  <Button variant="primary" onClick={() => setDialog('salary')}>
                    Change salary
                  </Button>
                  <Button variant="outline-secondary" onClick={() => setDialog('terminate')}>
                    Terminate
                  </Button>
                </>
              ) : (
                <Button variant="outline-secondary" onClick={() => setDialog('rehire')}>
                  Rehire
                </Button>
              )}
              <Button variant="outline-danger" onClick={() => setDialog('delete')}>
                Delete
              </Button>
            </div>
          </div>
          <EmployeeProfile employee={employee.data} latestRecord={history.data?.[0]} />
          <SalaryHistory history={history} />

          {dialog === 'salary' && (
            <ChangeSalaryDialog
              employee={employee.data}
              latestRecord={history.data?.[0]}
              onClose={() => setDialog(null)}
              onDone={(notice) => {
                setDialog(null)
                setFlash({ notice })
              }}
            />
          )}
          {dialog === 'terminate' && (
            <TerminateDialog
              employee={employee.data}
              onClose={() => setDialog(null)}
              onDone={(notice) => {
                setDialog(null)
                setFlash({ notice })
              }}
            />
          )}
          {dialog === 'rehire' && (
            <RehireDialog
              employee={employee.data}
              onClose={() => setDialog(null)}
              onDone={(notice) => {
                setDialog(null)
                setFlash({ notice })
              }}
            />
          )}
          {dialog === 'delete' && (
            <DeleteDialog
              employee={employee.data}
              onClose={() => setDialog(null)}
              onDone={() =>
                // Back to the list the employee was opened from, with a one-click way to undo.
                navigate(`/employees${state?.listSearch ?? ''}`, {
                  state: { undo: { id: employee.data.id, name: employee.data.full_name } },
                })
              }
            />
          )}
        </>
      )}
    </>
  )
}
