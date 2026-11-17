import { Alert, Button, Spinner } from 'react-bootstrap'
import { useEmployees } from '../api/employees'
import CursorPagination from '../features/employees/CursorPagination'
import EmployeeTable from '../features/employees/EmployeeTable'
import { useCursorPager } from '../features/employees/useCursorPager'
import { useListParams } from '../features/employees/useListParams'

export default function EmployeesPage() {
  const { sort, perPage, setSort, setPerPage } = useListParams()
  const pager = useCursorPager(`${sort}|${perPage}`)
  const { data, error, isPending, isPlaceholderData, refetch, isFetching } = useEmployees({
    sort,
    per_page: perPage,
    cursor: pager.cursor,
  })

  return (
    <>
      <h1 className="h3 mb-3">Employees</h1>

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
