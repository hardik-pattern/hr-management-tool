import { Col, Row } from 'react-bootstrap'
import { useGenderPayGap, useOutOfBand, useStaleSalaries, useSummary } from '../api/analytics'
import { OutOfBandTable, StaleSalariesTable } from '../features/analytics/EmployeeFindings'
import GenderGapView from '../features/analytics/GenderGapView'
import LevelDistribution from '../features/analytics/LevelDistribution'
import QueryBoundary from '../features/analytics/QueryBoundary'
import Section from '../features/analytics/Section'
import StatCard from '../features/analytics/StatCard'
import SummaryTable from '../features/analytics/SummaryTable'
import { formatUsdHeadline } from '../lib/money'
import { formatPercentChange } from '../lib/salary'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const QUESTION = (id: string) => `/questions?question=${id}`

/** How the organisation pays people, at a glance, with a way into the detail. */
export default function InsightsPage() {
  useDocumentTitle('Insights')

  const payroll = useSummary({ metric: 'sum' })
  const median = useSummary({ metric: 'median' })
  const gap = useGenderPayGap()

  return (
    <>
      <h1 className="h3 mb-1">Insights</h1>
      <p className="text-body-secondary">
        How the organisation pays its active employees. Amounts are in US dollars.
      </p>

      <Row className="g-3 mb-4">
        <Col sm={6} lg={3}>
          <StatCard
            label="Active employees"
            value={payroll.data ? payroll.data.total.headcount.toLocaleString('en-US') : '…'}
          />
        </Col>
        <Col sm={6} lg={3}>
          <StatCard
            label="Total payroll"
            value={
              payroll.data?.total.value != null ? formatUsdHeadline(payroll.data.total.value) : '…'
            }
            hint={
              payroll.data?.total.formatted
                ? `${payroll.data.total.formatted}, sum of current salaries`
                : undefined
            }
          />
        </Col>
        <Col sm={6} lg={3}>
          <StatCard
            label="Median salary"
            value={
              median.data?.total.value != null ? formatUsdHeadline(median.data.total.value) : '…'
            }
            hint={
              median.data?.total.formatted
                ? `${median.data.total.formatted}, all countries and roles`
                : undefined
            }
          />
        </Col>
        <Col sm={6} lg={3}>
          <StatCard
            label="Gender pay gap, like for like"
            value={gap.data ? formatPercentChange(gap.data.adjusted_gap_percent) : '…'}
            hint="Women compared with men in the same job title and country"
          />
        </Col>
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <Section
            title="Payroll by department"
            more={{ to: QUESTION('payroll-by-department'), label: 'See the full answer' }}
          >
            <PayrollByDepartment />
          </Section>
        </Col>
        <Col lg={6}>
          <Section title="People by country">
            <PeopleByCountry />
          </Section>
        </Col>
        <Col xs={12}>
          <Section title="Pay by level">
            <LevelDistribution />
          </Section>
        </Col>
        <Col xs={12}>
          <Section
            title="Gender pay gap"
            more={{ to: QUESTION('gender-pay-gap'), label: 'See every job title' }}
          >
            <QueryBoundary query={gap} label="the gender pay gap">
              {(data) => <GenderGapView data={data} limit={5} />}
            </QueryBoundary>
          </Section>
        </Col>
        <Col xs={12}>
          <Section
            title="Paid outside their band"
            more={{ to: QUESTION('paid-below-band'), label: 'See who is paid below band' }}
          >
            <OutsideBand />
          </Section>
        </Col>
        <Col xs={12}>
          <Section
            title="No salary change in 24 months"
            more={{ to: QUESTION('no-raise-24-months'), label: 'See the full list' }}
          >
            <NoChange />
          </Section>
        </Col>
      </Row>
    </>
  )
}

function PayrollByDepartment() {
  const query = useSummary({ metric: 'sum', group_by: ['department'] })
  return (
    <QueryBoundary query={query} label="payroll by department">
      {(summary) => <SummaryTable summary={summary} order="value" />}
    </QueryBoundary>
  )
}

function PeopleByCountry() {
  const query = useSummary({ metric: 'headcount', group_by: ['country'] })
  return (
    <QueryBoundary query={query} label="people by country">
      {(summary) => <SummaryTable summary={summary} order="value" />}
    </QueryBoundary>
  )
}

function OutsideBand() {
  const query = useOutOfBand('any', 5)
  return (
    <QueryBoundary query={query} label="employees outside their band">
      {(data) => (
        <>
          <p className="small text-body-secondary">
            {data.below} paid below and {data.above} paid above their band.
          </p>
          <OutOfBandTable data={data} limit={5} />
        </>
      )}
    </QueryBoundary>
  )
}

function NoChange() {
  const query = useStaleSalaries(24, 5)
  return (
    <QueryBoundary query={query} label="employees without a salary change">
      {(data) => (
        <>
          <p className="small text-body-secondary">
            {data.total.toLocaleString('en-US')} employees.
          </p>
          <StaleSalariesTable data={data} limit={5} />
        </>
      )}
    </QueryBoundary>
  )
}
