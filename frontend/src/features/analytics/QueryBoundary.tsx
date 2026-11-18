import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Alert, Button, Spinner } from 'react-bootstrap'
import type { ApiError } from '../../api/ApiError'

interface Props<T> {
  query: UseQueryResult<T, ApiError>
  /** What is being loaded, for the messages: "payroll by department". */
  label: string
  children: (data: T) => ReactNode
}

/**
 * Shows the right thing for a query: a spinner while loading, an error with
 * Try again if it failed, and otherwise the data. Each section of a screen
 * wraps its own query, so one failing never blanks the rest.
 */
export default function QueryBoundary<T>({ query, label, children }: Props<T>) {
  if (query.isPending) {
    return (
      <div className="text-center py-4">
        <Spinner animation="border" role="status" size="sm">
          <span className="visually-hidden">Loading {label}</span>
        </Spinner>
      </div>
    )
  }

  if (query.error) {
    return (
      <Alert variant="danger" role="alert" className="mb-0">
        <p className="mb-2">
          Could not load {label}. {query.error.message}
        </p>
        <Button
          variant="outline-danger"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          Try again
        </Button>
      </Alert>
    )
  }

  return (
    <div aria-busy={query.isFetching} className={query.isFetching ? 'opacity-75' : undefined}>
      {children(query.data)}
    </div>
  )
}
