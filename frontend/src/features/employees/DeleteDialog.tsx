import { useDeleteEmployee } from '../../api/employees'
import type { Employee } from '../../api/types'
import { describeError } from '../../lib/errors'
import ActionDialog from './ActionDialog'

interface Props {
  employee: Employee
  onClose: () => void
  onDone: () => void
}

export default function DeleteDialog({ employee, onClose, onDone }: Props) {
  const remove = useDeleteEmployee()

  return (
    <ActionDialog
      title={`Delete ${employee.full_name}?`}
      submitLabel="Delete"
      variant="danger"
      submitting={remove.isPending}
      errors={remove.error ? describeError(remove.error) : []}
      onSubmit={() => remove.mutate(employee.id, { onSuccess: onDone })}
      onClose={onClose}
    >
      <p>
        Use this for a record that should not exist, such as a duplicate. It is hidden from the list
        and from pay reports, but nothing is lost and you can restore it later.
      </p>
      <p className="mb-0">
        If {employee.full_name} left the company, terminate them instead so their history stays in
        the reports.
      </p>
    </ActionDialog>
  )
}
