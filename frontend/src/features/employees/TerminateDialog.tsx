import { useState } from 'react'
import { Form } from 'react-bootstrap'
import { useTerminateEmployee } from '../../api/employees'
import type { Employee } from '../../api/types'
import { describeError } from '../../lib/errors'
import { invalidProps, feedbackId } from '../../lib/fieldError'
import { formatDate, todayIso } from '../../lib/format'
import ActionDialog from './ActionDialog'

interface Props {
  employee: Employee
  onClose: () => void
  onDone: (notice: string) => void
}

export default function TerminateDialog({ employee, onClose, onDone }: Props) {
  const terminate = useTerminateEmployee()
  const [date, setDate] = useState(todayIso())
  const [problem, setProblem] = useState<string>()

  const check = (): string | undefined => {
    if (!date) return 'Enter the date they left.'
    if (date > todayIso()) return 'The date cannot be in the future.'
    if (date < employee.hire_date)
      return `The date cannot be before the hire date (${formatDate(employee.hire_date)}).`
  }

  const submit = () => {
    const found = check()
    setProblem(found)
    if (found) return
    terminate.mutate(
      { id: employee.id, termination_date: date },
      { onSuccess: () => onDone(`${employee.full_name} was terminated.`) },
    )
  }

  return (
    <ActionDialog
      title={`Terminate ${employee.full_name}`}
      submitLabel="Terminate"
      variant="danger"
      submitting={terminate.isPending}
      errors={terminate.error ? describeError(terminate.error) : []}
      onSubmit={submit}
      onClose={onClose}
    >
      <p>
        They stay in the data with their salary history, and can be rehired later. Pay reports count
        active employees unless you choose otherwise.
      </p>
      <Form.Group controlId="termination-date">
        <Form.Label>Last day</Form.Label>
        <Form.Control
          type="date"
          value={date}
          min={employee.hire_date}
          max={todayIso()}
          autoFocus
          {...invalidProps('termination-date', problem)}
          onChange={(event) => setDate(event.target.value)}
        />
        <Form.Control.Feedback type="invalid" id={feedbackId('termination-date')}>
          {problem}
        </Form.Control.Feedback>
      </Form.Group>
    </ActionDialog>
  )
}
