import { useNavigate } from 'react-router-dom'
import { useCreateEmployee } from '../api/employees'
import EmployeeForm from '../features/employees/EmployeeForm'
import { EMPTY_VALUES, toNewEmployee } from '../features/employees/employeeFormValues'

export default function EmployeeCreatePage() {
  const navigate = useNavigate()
  const create = useCreateEmployee()

  return (
    <>
      <h1 className="h3 mb-4">New employee</h1>
      <EmployeeForm
        mode="create"
        initialValues={EMPTY_VALUES}
        submitting={create.isPending}
        serverError={create.error}
        cancelTo="/employees"
        onSubmit={(values, exponent) =>
          create.mutate(toNewEmployee(values, exponent), {
            onSuccess: (employee) =>
              navigate(`/employees/${employee.id}`, { state: { notice: 'Employee created.' } }),
          })
        }
      />
    </>
  )
}
