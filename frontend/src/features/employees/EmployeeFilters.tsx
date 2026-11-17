import { Alert, Button, Col, Form, Row } from 'react-bootstrap'
import { useCountries, useCurrencies, useDepartments, useJobTitles } from '../../api/reference'
import type { StatusFilter } from '../../api/types'
import SalaryRange from './SalaryRange'
import SearchBox from './SearchBox'
import type { ListFilters } from './useListParams'

interface Props {
  filters: ListFilters
  hasFilters: boolean
  onChange: (changes: { [K in keyof ListFilters]?: ListFilters[K] | undefined }) => void
  onClear: () => void
}

const STATUS_LABELS: Record<StatusFilter, string> = {
  active: 'Active',
  terminated: 'Terminated',
  all: 'All',
}

const toId = (value: string) => (value === '' ? undefined : Number(value))

export default function EmployeeFilters({ filters, hasFilters, onChange, onClear }: Props) {
  const countries = useCountries()
  const currencies = useCurrencies()
  const departments = useDepartments()
  const jobTitles = useJobTitles()

  const country = countries.data?.find((c) => c.id === filters.country_id)
  const currency = currencies.data?.find((c) => c.code === country?.currency_code)
  const titleChoices = (jobTitles.data ?? []).filter(
    (title) => filters.department_id === undefined || title.department_id === filters.department_id,
  )
  // A deleted employee may be in any employment status, so "All" is the sensible default there.
  const status = filters.status ?? (filters.deleted ? 'all' : 'active')
  const optionsFailed = [countries, currencies, departments, jobTitles].some((q) => q.isError)

  return (
    <section aria-label="Filters" className="mb-4">
      {optionsFailed && (
        <Alert variant="warning" className="py-2">
          Some filter options could not be loaded. Reload the page to try again.
        </Alert>
      )}
      <Row className="g-3 align-items-end">
        <Col md={6} lg={4}>
          <SearchBox value={filters.q ?? ''} onSearch={(q) => onChange({ q: q || undefined })} />
        </Col>
        <Col md={6} lg={2}>
          <Form.Group controlId="filter-country">
            <Form.Label>Country</Form.Label>
            <Form.Select
              value={filters.country_id ?? ''}
              onChange={(event) =>
                // Salary amounts mean nothing in another currency, so they go with the country.
                onChange({
                  country_id: toId(event.target.value),
                  salary_min: undefined,
                  salary_max: undefined,
                })
              }
            >
              <option value="">All countries</option>
              {countries.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6} lg={3}>
          <Form.Group controlId="filter-department">
            <Form.Label>Department</Form.Label>
            <Form.Select
              value={filters.department_id ?? ''}
              onChange={(event) => {
                const department_id = toId(event.target.value)
                const title = jobTitles.data?.find((t) => t.id === filters.job_title_id)
                // Keep the chosen job title only if it belongs to the new department.
                const keepTitle =
                  department_id === undefined || title?.department_id === department_id
                onChange({
                  department_id,
                  job_title_id: keepTitle ? filters.job_title_id : undefined,
                })
              }}
            >
              <option value="">All departments</option>
              {departments.data?.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6} lg={3}>
          <Form.Group controlId="filter-job-title">
            <Form.Label>Job title</Form.Label>
            <Form.Select
              value={filters.job_title_id ?? ''}
              onChange={(event) => onChange({ job_title_id: toId(event.target.value) })}
            >
              <option value="">All job titles</option>
              {titleChoices.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6} lg={3}>
          <Form.Group controlId="filter-status">
            <Form.Label>Status</Form.Label>
            <Form.Select
              value={status}
              onChange={(event) => {
                const next = event.target.value as StatusFilter
                // "active" is the default, so it is kept out of the URL.
                onChange({
                  status: next === (filters.deleted ? 'all' : 'active') ? undefined : next,
                })
              }}
            >
              {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={6} lg={3} className="d-flex align-items-center">
          <Form.Check
            id="filter-deleted"
            type="switch"
            label="Show deleted"
            checked={filters.deleted === 'only'}
            onChange={(event) =>
              onChange({ deleted: event.target.checked ? 'only' : undefined, status: undefined })
            }
          />
        </Col>
        {country && currency && (
          <Col md={6} lg={4}>
            <SalaryRange
              key={`salary-${country.id}`}
              currencyCode={currency.code}
              exponent={currency.minor_unit_exponent}
              min={filters.salary_min}
              max={filters.salary_max}
              onChange={onChange}
            />
          </Col>
        )}
        {hasFilters && (
          <Col xs="auto">
            <Button variant="outline-secondary" onClick={onClear}>
              Clear filters
            </Button>
          </Col>
        )}
      </Row>
    </section>
  )
}
