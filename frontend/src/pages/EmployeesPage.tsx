import { useState } from 'react'
import { Alert, Button, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { useEmployees, useRestoreEmployee } from '../api/employees'
import CursorPagination from '../features/employees/CursorPagination'
import EmployeeFilters from '../features/employees/EmployeeFilters'
import EmployeeTable from '../features/employees/EmployeeTable'
import { useCursorPager } from '../features/employees/useCursorPager'
import { useFlash } from '../features/employees/useFlash'
import { useListParams } from '../features/employees/useListParams'
import { describeError } from '../lib/errors'
import { useDocumentTitle } from '../lib/useDocumentTitle'

export default function EmployeesPage() {
  useDocumentTitle('Employees')
  const list = useListParams()
  const [flash, setFlash] = useFlash()
  const [restoreProblem, setRestoreProblem] = useState<string[]>([])
  const restore = useRestoreEmployee()
  const { sort, perPage, filters, setSort, setPerPage } = list
  // Any change to the view starts again from the first page.
  const pager = useCursorPager(JSON.stringify({ sort, perPage, filters }))
  const { data, error, isPending, isPlaceholderData, refetch, isFetching } = useEmployees({
    ...filters,
    sort,
    per_page: perPage,
    cursor: pager.cursor,
  })

  const restoreEmployee = (target: { id: number; name: string }) => {
    setRestoreProblem([])
    restore.mutate(target.id, {
      onSuccess: () => setFlash({ notice: `Restored ${target.name}.` }),
      onError: (failure) =>
        setRestoreProblem([`Could not restore ${target.name}.`, ...describeError(failure)]),
    })
  }

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 mb-0">Employees</h1>
        <Link to="/employees/new" className="btn btn-primary">
          New employee
        </Link>
      </div>

      {(flash.notice || flash.undo) && (
        <Alert variant="success" dismissible role="status" onClose={() => setFlash({})}>
          {flash.undo ? `Deleted ${flash.undo.name}. ` : flash.notice}
          {flash.undo && (
            <Button
              variant="link"
              className="p-0 align-baseline"
              disabled={restore.isPending}
              onClick={() => flash.undo && restoreEmployee(flash.undo)}
            >
              Undo
            </Button>
          )}
        </Alert>
      )}
      {restoreProblem.length > 0 && (
        <Alert variant="danger" dismissible role="alert" onClose={() => setRestoreProblem([])}>
          {restoreProblem.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </Alert>
      )}

      <EmployeeFilters
        filters={filters}
        hasFilters={list.hasFilters}
        onChange={list.setFilters}
        onClear={list.clearFilters}
      />

      {isPending && (
        <div className="text-center py-5">
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading employees</span>
          </Spinner>
        </div>
      )}

      {error && !data && (
        <Alert variant="danger" role="alert">
          <p className="mb-2">Could not load employees. {error.message}</p>
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

      {data && data.data.length === 0 && (
        <p className="text-body-secondary py-4">No employees match.</p>
      )}

      {data && data.data.length > 0 && (
        <EmployeeTable
          employees={data.data}
          sort={sort}
          onSort={setSort}
          stale={isPlaceholderData}
          salarySortable={list.salarySortable}
          onRestore={
            filters.deleted === 'only'
              ? (employee) => restoreEmployee({ id: employee.id, name: employee.full_name })
              : undefined
          }
          restoringId={restore.isPending ? restore.variables : undefined}
        />
      )}

      {data && (
        <CursorPagination
          total={data.meta.total}
          perPage={perPage}
          pageIndex={pager.pageIndex}
          shown={data.data.length}
          hasNext={data.meta.next_cursor !== null && !isPlaceholderData}
          onNext={() => data.meta.next_cursor && pager.goNext(data.meta.next_cursor)}
          onPrevious={pager.goPrevious}
          onPerPageChange={setPerPage}
        />
      )}
    </>
  )
}
