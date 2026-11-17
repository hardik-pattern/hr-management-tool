import { Alert, Button, Card, Spinner, Table } from 'react-bootstrap'
import type { UseQueryResult } from '@tanstack/react-query'
import type { SalaryRecord } from '../../api/types'
import { formatDate } from '../../lib/format'
import { REASON_LABELS } from '../../lib/labels'
import { formatPercentChange, salaryChanges } from '../../lib/salary'

/** The salary timeline, newest first, with each change as a percentage. */
export default function SalaryHistory({ history }: { history: UseQueryResult<SalaryRecord[]> }) {
  const { data, error, isPending, refetch, isFetching } = history
  const changes = data ? salaryChanges(data) : []

  return (
    <Card className="mt-4">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3">
          Salary history
        </Card.Title>

        {isPending && (
          <Spinner animation="border" size="sm" role="status">
            <span className="visually-hidden">Loading salary history</span>
          </Spinner>
        )}

        {error && (
          <Alert variant="danger" role="alert" className="mb-0">
            <p className="mb-2">Could not load the salary history. {error.message}</p>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              Try again
            </Button>
          </Alert>
        )}

        {data && data.length === 0 && (
          <p className="text-body-secondary mb-0">No salary records.</p>
        )}

        {data && data.length > 0 && (
          <div className="table-responsive">
            <Table size="sm" className="mb-0">
              <caption className="visually-hidden">Salary history, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Effective</th>
                  <th scope="col">Reason</th>
                  <th scope="col" className="text-end">
                    Salary
                  </th>
                  <th scope="col" className="text-end">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((record, index) => (
                  <tr key={record.id}>
                    <td className="text-nowrap">{formatDate(record.effective_from)}</td>
                    <td>{REASON_LABELS[record.reason]}</td>
                    <td className="text-end text-nowrap">{record.formatted}</td>
                    <td className="text-end text-nowrap">{formatPercentChange(changes[index])}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
