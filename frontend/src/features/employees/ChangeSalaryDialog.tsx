import { useState } from 'react'
import { Form, InputGroup } from 'react-bootstrap'
import { useCurrencies } from '../../api/reference'
import { useChangeSalary } from '../../api/salary'
import type { Employee, SalaryChange, SalaryRecord } from '../../api/types'
import { describeError } from '../../lib/errors'
import { feedbackId, invalidProps } from '../../lib/fieldError'
import { formatDate, todayIso } from '../../lib/format'
import { REASON_LABELS } from '../../lib/labels'
import { parseAmount } from '../../lib/money'
import { formatPercentChange, percentChange } from '../../lib/salary'
import ActionDialog from './ActionDialog'

// "hire" belongs to creating the employee, which the API enforces. "rehire" is accepted by the
// API, but the Rehire action records it, so a plain salary change does not offer it.
const REASONS: SalaryChange['reason'][] = ['merit', 'promotion', 'adjustment', 'correction']

interface Props {
  employee: Employee
  /** The most recent salary record, if loaded: a change cannot be dated before it. */
  latestRecord?: SalaryRecord
  onClose: () => void
  onDone: (notice: string) => void
}

export default function ChangeSalaryDialog({ employee, latestRecord, onClose, onDone }: Props) {
  const changeSalary = useChangeSalary()
  const currencies = useCurrencies()
  const [amount, setAmount] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayIso())
  const [reason, setReason] = useState<SalaryChange['reason']>('merit')
  const [problems, setProblems] = useState<{ amount?: string; date?: string }>({})

  const currencyCode = employee.salary.currency
  const exponent = currencies.data?.find((c) => c.code === currencyCode)?.minor_unit_exponent ?? 2
  const earliest = latestRecord?.effective_from
  const parsed = parseAmount(amount, exponent)
  const newCents = parsed.ok ? parsed.cents : undefined

  const check = () => {
    const found: typeof problems = {}
    if (!amount.trim()) found.amount = 'Enter the new salary.'
    else if (!parsed.ok) found.amount = 'Enter an amount like 50000 or 50000.50.'
    else if (!parsed.cents) found.amount = 'The salary must be more than zero.'

    if (!effectiveFrom) found.date = 'Enter the date the new salary starts.'
    else if (effectiveFrom > todayIso()) found.date = 'The date cannot be in the future.'
    else if (earliest && effectiveFrom < earliest) {
      found.date = `The date cannot be before the latest salary record (${formatDate(earliest)}).`
    }
    return found
  }

  const submit = () => {
    const found = check()
    setProblems(found)
    if (Object.keys(found).length > 0 || !newCents) return

    changeSalary.mutate(
      {
        employeeId: employee.id,
        change: { amount_cents: newCents, effective_from: effectiveFrom, reason },
      },
      { onSuccess: (result) => onDone(`Salary changed to ${result.employee.salary.formatted}.`) },
    )
  }

  const change = newCents ? percentChange(employee.salary.amount_cents, newCents) : undefined

  return (
    <ActionDialog
      title={`Change salary for ${employee.full_name}`}
      submitLabel="Change salary"
      submitting={changeSalary.isPending}
      errors={changeSalary.error ? describeError(changeSalary.error) : []}
      onSubmit={submit}
      onClose={onClose}
    >
      <p>
        Current salary: <strong>{employee.salary.formatted}</strong>. The change is added to their
        history; nothing is overwritten.
      </p>

      <Form.Group controlId="salary-amount" className="mb-1">
        <Form.Label>New salary</Form.Label>
        <InputGroup hasValidation>
          <Form.Control
            inputMode="decimal"
            value={amount}
            autoFocus
            {...invalidProps('salary-amount', problems.amount)}
            onChange={(event) => setAmount(event.target.value)}
          />
          <InputGroup.Text>{currencyCode}</InputGroup.Text>
          <Form.Control.Feedback type="invalid" id={feedbackId('salary-amount')}>
            {problems.amount}
          </Form.Control.Feedback>
        </InputGroup>
      </Form.Group>
      <p className="small text-body-secondary mb-3" aria-live="polite">
        {change === undefined
          ? ' '
          : Math.abs(change) < 0.05
            ? `No change from ${employee.salary.formatted}`
            : `${formatPercentChange(change)} from ${employee.salary.formatted}`}
      </p>

      <Form.Group controlId="salary-effective-from" className="mb-3">
        <Form.Label>Starts</Form.Label>
        <Form.Control
          type="date"
          value={effectiveFrom}
          min={earliest}
          max={todayIso()}
          {...invalidProps('salary-effective-from', problems.date)}
          onChange={(event) => setEffectiveFrom(event.target.value)}
        />
        <Form.Control.Feedback type="invalid" id={feedbackId('salary-effective-from')}>
          {problems.date}
        </Form.Control.Feedback>
      </Form.Group>

      <Form.Group controlId="salary-reason">
        <Form.Label>Reason</Form.Label>
        <Form.Select
          value={reason}
          onChange={(event) => setReason(event.target.value as SalaryChange['reason'])}
        >
          {REASONS.map((value) => (
            <option key={value} value={value}>
              {REASON_LABELS[value]}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </ActionDialog>
  )
}
