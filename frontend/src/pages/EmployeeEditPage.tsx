import { Alert, Button, Spinner } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useEmployee, useUpdateEmployee } from '../api/employees'
import EmployeeForm from '../features/employees/EmployeeForm'
import { toChanges, valuesFromEmployee } from '../features/employees/employeeFormValues'

export default function EmployeeEditPage() {
  const params = useParams()
  const id = /^[1-9]\d*$/.test(params.id ?? '') ? Number(params.id) : undefined
  const navigate = useNavigate()
  const employee = useEmployee(id)
  const update = useUpdateEmployee()
  const detailPath = `/employees/${id}`

  if (id === undefined || employee.error?.isNotFound) {
    return (
      <>
        <h1 className="h3">Employee not found</h1>
        <p>
          There is no employee at this address. <Link to="/employees">Back to employees</Link>
        </p>
      </>
    )
  }

  if (employee.error) {
    return (
      <Alert variant="danger" role="alert">
        <p className="mb-2">Could not load this employee. {employee.error.message}</p>
        <Button variant="outline-danger" size="sm" onClick={() => employee.refetch()}>
          Try again
        </Button>
      </Alert>
    )
  }

  if (!employee.data) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading employee</span>
        </Spinner>
      </div>
    )
  }

  const original = employee.data
  return (
    <>
      <h1 className="h3 mb-4">Edit {original.full_name}</h1>
      <EmployeeForm
        // Remount if a refetch brings different data, so the form never shows stale values.
        key={`${original.id}-${original.full_name}-${original.email}-${original.job_title.id}`}
        mode="edit"
        initialValues={valuesFromEmployee(original)}
        employee={original}
        submitting={update.isPending}
        serverError={update.error}
        cancelTo={detailPath}
        onSubmit={(values) => {
          const changes = toChanges(values, original)
          // Nothing to save: go back without a request.
          if (Object.keys(changes).length === 0) return navigate(detailPath)
          update.mutate(
            { id: original.id, changes },
            {
              onSuccess: () => navigate(detailPath, { state: { notice: 'Changes saved.' } }),
            },
          )
        }}
      />
    </>
  )
}
