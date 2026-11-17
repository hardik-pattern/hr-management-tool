import { Alert, Button, Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { useEmployees } from '../api/employees'
import CursorPagination from '../features/employees/CursorPagination'
import EmployeeFilters from '../features/employees/EmployeeFilters'
import EmployeeTable from '../features/employees/EmployeeTable'
import { useCursorPager } from '../features/employees/useCursorPager'
import { useListParams } from '../features/employees/useListParams'

export default function EmployeesPage() {
  const list = useListParams()
  const { sort, perPage, filters, setSort, setPerPage } = list
  // Any change to the view starts again from the first page.
  const pager = useCursorPager(JSON.stringify({ sort, perPage, filters }))
  const { data, error, isPending, isPlaceholderData, refetch, isFetching } = useEmployees({
    ...filters,
    sort,
    per_page: perPage,
    cursor: pager.cursor,
  })

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h1 className="h3 mb-0">Employees</h1>
        <Link to="/employees/new" className="btn btn-primary">
          New employee
        </Link>
      </div>

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
