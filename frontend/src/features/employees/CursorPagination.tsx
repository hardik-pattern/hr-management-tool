import { Button, Form } from 'react-bootstrap'
import { PAGE_SIZES } from './useListParams'

interface Props {
  total: number
  perPage: number
  pageIndex: number
  /** Rows on the current page. */
  shown: number
  hasNext: boolean
  onNext: () => void
  onPrevious: () => void
  onPerPageChange: (perPage: number) => void
}

export default function CursorPagination(props: Props) {
  const { total, perPage, pageIndex, shown, hasNext, onNext, onPrevious, onPerPageChange } = props
  const first = shown === 0 ? 0 : pageIndex * perPage + 1
  const last = pageIndex * perPage + shown

  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
      <span aria-live="polite">
        Showing {first}–{last} of {total}
      </span>
      <div className="d-flex align-items-center gap-3">
        <Form.Group className="d-flex align-items-center gap-2" controlId="per-page">
          <Form.Label className="mb-0 text-nowrap">Rows per page</Form.Label>
          <Form.Select
            size="sm"
            value={perPage}
            onChange={(event) => onPerPageChange(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <nav aria-label="Pagination" className="d-flex gap-2">
          <Button
            variant="outline-secondary"
            size="sm"
            disabled={pageIndex === 0}
            onClick={onPrevious}
          >
            Previous
          </Button>
          <Button variant="outline-secondary" size="sm" disabled={!hasNext} onClick={onNext}>
            Next
          </Button>
        </nav>
      </div>
    </div>
  )
}
