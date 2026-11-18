import { Button, Col, Form, Row } from 'react-bootstrap'
import { useCountries, useDepartments, useJobTitles } from '../../api/reference'
import type {
  AnalyticsGroup,
  AnalyticsMetric,
  Gender,
  StatusFilter,
  SummaryParams,
} from '../../api/types'
import { GROUP_LABELS, METRIC_LABELS, STATUS_TEXT } from './labels'
import { type ExplorerChanges, GENDERS, GROUPS, METRICS, STATUSES } from './useExplorerParams'

interface Props {
  params: SummaryParams
  onChange: (changes: ExplorerChanges) => void
  onReset: () => void
  canReset: boolean
}

const GENDER_LABELS: Record<Gender, string> = {
  female: 'Women',
  male: 'Men',
  non_binary: 'Non-binary',
  undisclosed: 'Not disclosed',
}
const toId = (value: string) => (value === '' ? undefined : Number(value))

/** The controls for choosing what to measure, how to group it, and who to include. */
export default function ExplorerForm({ params, onChange, onReset, canReset }: Props) {
  const countries = useCountries()
  const departments = useDepartments()
  const jobTitles = useJobTitles()

  const groups = params.group_by ?? []
  const titleChoices = (jobTitles.data ?? []).filter(
    (t) => params.department_id === undefined || t.department_id === params.department_id,
  )

  const setGroup = (index: number, value: string) => {
    const next = [...groups]
    if (value === '')
      next.splice(index) // clearing the first grouping clears the second too
    else next[index] = value as AnalyticsGroup
    onChange({ group_by: next })
  }

  return (
    <Form aria-label="Question" onSubmit={(event) => event.preventDefault()}>
      <Row className="g-3 mb-3">
        <Col md={4}>
          <Form.Group controlId="explorer-metric">
            <Form.Label>Measure</Form.Label>
            <Form.Select
              value={params.metric}
              onChange={(event) => onChange({ metric: event.target.value as AnalyticsMetric })}
            >
              {METRICS.map((metric) => (
                <option key={metric} value={metric}>
                  {METRIC_LABELS[metric]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="explorer-group-1">
            <Form.Label>Group by</Form.Label>
            <Form.Select
              value={groups[0] ?? ''}
              onChange={(event) => setGroup(0, event.target.value)}
            >
              <option value="">Nothing (one overall figure)</option>
              {GROUPS.map((group) => (
                <option key={group} value={group}>
                  {GROUP_LABELS[group]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4}>
          <Form.Group controlId="explorer-group-2">
            <Form.Label>Then by</Form.Label>
            <Form.Select
              value={groups[1] ?? ''}
              disabled={groups.length === 0}
              onChange={(event) => setGroup(1, event.target.value)}
            >
              <option value="">Nothing</option>
              {GROUPS.filter((group) => group !== groups[0]).map((group) => (
                <option key={group} value={group}>
                  {GROUP_LABELS[group]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>

      <Row className="g-3 align-items-end">
        <Col md={4} lg={3}>
          <Form.Group controlId="explorer-status">
            <Form.Label>Employees</Form.Label>
            <Form.Select
              value={params.status}
              onChange={(event) => onChange({ status: event.target.value as StatusFilter })}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {STATUS_TEXT[status]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4} lg={3}>
          <Form.Group controlId="explorer-country">
            <Form.Label>Country</Form.Label>
            <Form.Select
              value={params.country_id ?? ''}
              onChange={(event) => onChange({ country_id: toId(event.target.value) })}
            >
              <option value="">All countries</option>
              {countries.data?.map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4} lg={3}>
          <Form.Group controlId="explorer-department">
            <Form.Label>Department</Form.Label>
            <Form.Select
              value={params.department_id ?? ''}
              onChange={(event) => {
                const department_id = toId(event.target.value)
                const title = jobTitles.data?.find((t) => t.id === params.job_title_id)
                // A job title belongs to one department, so keep it only if it still fits.
                const keep = department_id === undefined || title?.department_id === department_id
                onChange({ department_id, job_title_id: keep ? params.job_title_id : undefined })
              }}
            >
              <option value="">All departments</option>
              {departments.data?.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4} lg={3}>
          <Form.Group controlId="explorer-job-title">
            <Form.Label>Job title</Form.Label>
            <Form.Select
              value={params.job_title_id ?? ''}
              onChange={(event) => onChange({ job_title_id: toId(event.target.value) })}
            >
              <option value="">All job titles</option>
              {titleChoices.map((title) => (
                <option key={title.id} value={title.id}>
                  {title.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4} lg={3}>
          <Form.Group controlId="explorer-gender">
            <Form.Label>Gender</Form.Label>
            <Form.Select
              value={params.gender ?? ''}
              onChange={(event) => onChange({ gender: event.target.value || undefined })}
            >
              <option value="">Everyone</option>
              {GENDERS.map((gender) => (
                <option key={gender} value={gender}>
                  {GENDER_LABELS[gender]}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        <Col md={4} lg={3}>
          <Form.Group controlId="explorer-level">
            <Form.Label>Level</Form.Label>
            <Form.Select
              value={params.level ?? ''}
              onChange={(event) => onChange({ level: toId(event.target.value) })}
            >
              <option value="">All levels</option>
              {[1, 2, 3, 4, 5, 6, 7].map((level) => (
                <option key={level} value={level}>
                  Level {level}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        {canReset && (
          <Col xs="auto">
            <Button variant="outline-secondary" onClick={onReset}>
              Reset
            </Button>
          </Col>
        )}
      </Row>
    </Form>
  )
}
