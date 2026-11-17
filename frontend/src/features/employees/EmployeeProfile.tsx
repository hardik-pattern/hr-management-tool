import { Alert, Card, Col, Row } from 'react-bootstrap'
import type { Employee, SalaryRecord } from '../../api/types'
import { formatDate } from '../../lib/format'
import { GENDER_LABELS } from '../../lib/labels'
import StatusBadge from './StatusBadge'

interface Props {
  employee: Employee
  /** The latest salary record, when loaded, to say since when the salary applies. */
  latestRecord?: SalaryRecord
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="col-sm-4 text-body-secondary fw-normal">{label}</dt>
      <dd className="col-sm-8">{children}</dd>
    </>
  )
}

export default function EmployeeProfile({ employee, latestRecord }: Props) {
  return (
    <>
      {employee.deleted_at && (
        <Alert variant="warning">
          This record was deleted on {formatDate(employee.deleted_at)} and is hidden from the list.
        </Alert>
      )}
      <Row className="g-4">
        <Col md={7}>
          <Card>
            <Card.Body>
              <Card.Title as="h2" className="h5 mb-3">
                Profile
              </Card.Title>
              <dl className="row mb-0">
                <Field label="Employee number">{employee.employee_number}</Field>
                <Field label="Email">{employee.email}</Field>
                <Field label="Gender">{GENDER_LABELS[employee.gender]}</Field>
                <Field label="Department">{employee.department.name}</Field>
                <Field label="Job title">{employee.job_title.name}</Field>
                <Field label="Country">{employee.country.name}</Field>
                <Field label="Hired">{formatDate(employee.hire_date)}</Field>
                <Field label="Status">
                  <StatusBadge status={employee.status} />
                  {employee.termination_date && (
                    <span className="ms-2">Left on {formatDate(employee.termination_date)}</span>
                  )}
                </Field>
              </dl>
            </Card.Body>
          </Card>
        </Col>
        <Col md={5}>
          <Card>
            <Card.Body>
              <Card.Title as="h2" className="h5 mb-3">
                Current salary
              </Card.Title>
              <p className="display-6 mb-1" aria-label="Current salary">
                {employee.salary.formatted}
              </p>
              {latestRecord && (
                <p className="text-body-secondary mb-0">
                  Since {formatDate(latestRecord.effective_from)}
                </p>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  )
}
