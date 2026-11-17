import { useState } from 'react'
import { Alert, Button, Col, Form, InputGroup, Row, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import type { ApiError } from '../../api/ApiError'
import { useCountries, useCurrencies, useDepartments, useJobTitles } from '../../api/reference'
import type { Employee } from '../../api/types'
import { formatDate, todayIso } from '../../lib/format'
import { GENDER_LABELS } from '../../lib/labels'
import {
  type FormErrors,
  type FormField,
  type FormMode,
  type FormValues,
  splitServerErrors,
  validate,
} from './employeeFormValues'

interface Props {
  mode: FormMode
  initialValues: FormValues
  /** Edit mode: the employee being edited, for the fields that cannot change. */
  employee?: Employee
  submitting: boolean
  serverError: ApiError | null
  onSubmit: (values: FormValues, exponent: number) => void
  cancelTo: string
}

export default function EmployeeForm(props: Props) {
  const { mode, initialValues, employee, submitting, serverError, onSubmit, cancelTo } = props
  const [values, setValues] = useState(initialValues)
  const [submitted, setSubmitted] = useState(false)

  const countries = useCountries()
  const currencies = useCurrencies()
  const departments = useDepartments()
  const jobTitles = useJobTitles()

  const country = countries.data?.find((c) => String(c.id) === values.country_id)
  const currency = currencies.data?.find((c) => c.code === country?.currency_code)
  const exponent = currency?.minor_unit_exponent ?? 2
  const titleChoices = (jobTitles.data ?? []).filter(
    (t) => String(t.department_id) === values.department_id,
  )

  // Mistakes are shown once a save has been attempted, then follow the edits.
  const checked = submitted ? validate(values, mode, exponent) : {}
  const server = serverError ? splitServerErrors(serverError) : { fields: {}, general: [] }
  const errorFor = (field: FormField): string | undefined =>
    checked[field] ?? (server.fields as FormErrors)[field]

  const set = (field: FormField, value: string) =>
    setValues((current) => ({ ...current, [field]: value }))

  const control = (field: FormField) => ({
    value: values[field],
    isInvalid: !!errorFor(field),
    onChange: (event: { target: { value: string } }) => set(field, event.target.value),
  })
  const feedback = (field: FormField) => (
    <Form.Control.Feedback type="invalid">{errorFor(field)}</Form.Control.Feedback>
  )

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (Object.keys(validate(values, mode, exponent)).length === 0) onSubmit(values, exponent)
  }

  const futureHire = mode === 'create' && values.hire_date > todayIso()

  return (
    <Form
      onSubmit={handleSubmit}
      noValidate
      aria-label={mode === 'create' ? 'New employee' : 'Edit employee'}
    >
      {server.general.length > 0 && (
        <Alert variant="danger" role="alert">
          {server.general.map((message) => (
            <div key={message}>{message}</div>
          ))}
        </Alert>
      )}

      <Row className="g-3">
        <Col md={6}>
          <Form.Group controlId="employee-name">
            <Form.Label>Name</Form.Label>
            <Form.Control {...control('full_name')} autoComplete="off" />
            {feedback('full_name')}
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="employee-email">
            <Form.Label>Email</Form.Label>
            <Form.Control {...control('email')} type="email" autoComplete="off" />
            {feedback('email')}
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="employee-gender">
            <Form.Label>Gender</Form.Label>
            <Form.Select {...control('gender')}>
              <option value="">Choose…</option>
              {Object.entries(GENDER_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Form.Select>
            {feedback('gender')}
          </Form.Group>
        </Col>

        {mode === 'create' ? (
          <>
            <Col md={6}>
              <Form.Group controlId="employee-hire-date">
                <Form.Label>Hire date</Form.Label>
                <Form.Control {...control('hire_date')} type="date" />
                {feedback('hire_date')}
                {futureHire && !errorFor('hire_date') && (
                  <Form.Text muted>Starts on a future date.</Form.Text>
                )}
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="employee-country">
                <Form.Label>Country</Form.Label>
                <Form.Select {...control('country_id')}>
                  <option value="">Choose…</option>
                  {countries.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Form.Select>
                {feedback('country_id')}
                <Form.Text muted>Cannot be changed after the employee is created.</Form.Text>
              </Form.Group>
            </Col>
          </>
        ) : (
          employee && (
            <Col md={6}>
              <dl className="mb-0">
                <dt className="small text-body-secondary fw-normal">Country</dt>
                <dd>{employee.country.name}</dd>
                <dt className="small text-body-secondary fw-normal">Hired</dt>
                <dd className="mb-0">{formatDate(employee.hire_date)}</dd>
              </dl>
            </Col>
          )
        )}

        <Col md={6}>
          <Form.Group controlId="employee-department">
            <Form.Label>Department</Form.Label>
            <Form.Select
              {...control('department_id')}
              onChange={(event) => {
                // A job title belongs to one department, so a new department means choosing again.
                setValues((current) => ({
                  ...current,
                  department_id: event.target.value,
                  job_title_id: '',
                }))
              }}
            >
              <option value="">Choose…</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Form.Select>
            {feedback('department_id')}
          </Form.Group>
        </Col>
        <Col md={6}>
          <Form.Group controlId="employee-job-title">
            <Form.Label>Job title</Form.Label>
            <Form.Select {...control('job_title_id')} disabled={!values.department_id}>
              <option value="">
                {values.department_id ? 'Choose…' : 'Choose a department first'}
              </option>
              {titleChoices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Form.Select>
            {feedback('job_title_id')}
          </Form.Group>
        </Col>

        {mode === 'create' && (
          <Col md={6}>
            <Form.Group controlId="employee-salary">
              <Form.Label>Starting salary</Form.Label>
              <InputGroup hasValidation>
                <Form.Control {...control('salary')} inputMode="decimal" disabled={!currency} />
                {currency && <InputGroup.Text>{currency.code}</InputGroup.Text>}
                {feedback('salary')}
              </InputGroup>
              <Form.Text muted>
                {currency ? 'In whole units, for example 50000.' : 'Choose a country first.'}
              </Form.Text>
            </Form.Group>
          </Col>
        )}
      </Row>

      <div className="d-flex gap-2 mt-4">
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
              Saving…
            </>
          ) : mode === 'create' ? (
            'Create employee'
          ) : (
            'Save changes'
          )}
        </Button>
        <Link to={cancelTo} className="btn btn-outline-secondary">
          Cancel
        </Link>
      </div>
    </Form>
  )
}
