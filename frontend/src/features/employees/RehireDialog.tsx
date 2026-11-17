import { useState } from 'react'
import { Form, InputGroup } from 'react-bootstrap'
import { useRehireEmployee } from '../../api/employees'
import { useCurrencies } from '../../api/reference'
import type { Employee } from '../../api/types'
import { describeError } from '../../lib/errors'
import { todayIso } from '../../lib/format'
import { parseAmount } from '../../lib/money'
import ActionDialog from './ActionDialog'

interface Props {
  employee: Employee
  onClose: () => void
  onDone: (notice: string) => void
}

export default function RehireDialog({ employee, onClose, onDone }: Props) {
  const rehire = useRehireEmployee()
  const currencies = useCurrencies()
  const [salary, setSalary] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso())
  const [problems, setProblems] = useState<{ salary?: string; date?: string }>({})

  const currencyCode = employee.salary.currency
  const exponent = currencies.data?.find((c) => c.code === currencyCode)?.minor_unit_exponent ?? 2
  const newSalary = salary.trim() !== ''

  const submit = () => {
    const parsed = parseAmount(salary, exponent)
    const found: typeof problems = {}
    if (newSalary && (!parsed.ok || !parsed.cents))
      found.salary = 'Enter an amount above zero, like 50000 or 50000.50.'
    if (newSalary && !effectiveFrom) found.date = 'Enter the date the new salary starts.'
    else if (newSalary && effectiveFrom > todayIso())
      found.date = 'The date cannot be in the future.'
    setProblems(found)
    if (Object.keys(found).length > 0) return

    const options =
      newSalary && parsed.ok ? { salary_cents: parsed.cents, effective_from: effectiveFrom } : {}
    rehire.mutate(
      { id: employee.id, ...options },
      { onSuccess: () => onDone(`${employee.full_name} was rehired.`) },
    )
  }

  return (
    <ActionDialog
      title={`Rehire ${employee.full_name}`}
      submitLabel="Rehire"
      submitting={rehire.isPending}
      errors={rehire.error ? describeError(rehire.error) : []}
      onSubmit={submit}
      onClose={onClose}
    >
      <p>
        They become an active employee again. Their salary stays {employee.salary.formatted} unless
        you enter a new one.
      </p>
      <Form.Group controlId="rehire-salary" className="mb-3">
        <Form.Label>New salary (optional)</Form.Label>
        <InputGroup hasValidation>
          <Form.Control
            inputMode="decimal"
            value={salary}
            isInvalid={!!problems.salary}
            onChange={(event) => setSalary(event.target.value)}
          />
          <InputGroup.Text>{currencyCode}</InputGroup.Text>
          <Form.Control.Feedback type="invalid">{problems.salary}</Form.Control.Feedback>
        </InputGroup>
      </Form.Group>
      {newSalary && (
        <Form.Group controlId="rehire-effective-from">
          <Form.Label>New salary starts</Form.Label>
          <Form.Control
            type="date"
            value={effectiveFrom}
            max={todayIso()}
            isInvalid={!!problems.date}
            onChange={(event) => setEffectiveFrom(event.target.value)}
          />
          <Form.Control.Feedback type="invalid">{problems.date}</Form.Control.Feedback>
        </Form.Group>
      )}
    </ActionDialog>
  )
}
