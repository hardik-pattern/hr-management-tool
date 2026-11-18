import { useState } from 'react'
import { Form } from 'react-bootstrap'
import { useSummary } from '../api/analytics'
import { useCountries, useDepartments, useJobTitles } from '../api/reference'
import ExplorerForm from '../features/analytics/ExplorerForm'
import QueryBoundary from '../features/analytics/QueryBoundary'
import SummaryTable from '../features/analytics/SummaryTable'
import { describeQuestion } from '../features/analytics/describeQuestion'
import { useExplorerParams } from '../features/analytics/useExplorerParams'
import { useDocumentTitle } from '../lib/useDocumentTitle'

const byId = (items: { id: number; name: string }[] | undefined) =>
  Object.fromEntries((items ?? []).map((item) => [item.id, item.name]))

/** Ask any pay question: choose a measure, group it up to two ways, and filter who is included. */
export default function ExplorerPage() {
  useDocumentTitle('Explorer')
  const { params, set, reset, isDefault } = useExplorerParams()
  const summary = useSummary(params)
  const [largestFirst, setLargestFirst] = useState(false)

  const countries = useCountries()
  const departments = useDepartments()
  const jobTitles = useJobTitles()
  const names = {
    country: byId(countries.data),
    department: byId(departments.data),
    job_title: byId(jobTitles.data),
  }

  return (
    <>
      <h1 className="h3 mb-1">Explorer</h1>
      <p className="text-body-secondary">
        Ask your own question about pay. Amounts are in US dollars, so countries can be compared.
      </p>

      <ExplorerForm params={params} onChange={set} onReset={reset} canReset={!isDefault} />

      <section aria-labelledby="explorer-answer" className="mt-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <h2 className="h5 mb-0" id="explorer-answer">
            Answer
          </h2>
          <Form.Check
            id="explorer-largest-first"
            type="switch"
            label="Largest first"
            checked={largestFirst}
            onChange={(event) => setLargestFirst(event.target.checked)}
          />
        </div>
        <QueryBoundary query={summary} label="the answer">
          {(data) => (
            <div className="row g-4">
              <div className="col-lg-8">
                <SummaryTable summary={data} order={largestFirst ? 'value' : 'group'} />
              </div>
              <div className="col-lg-4">
                <h3 className="h6">What was asked</h3>
                <dl className="small mb-0">
                  {describeQuestion(data, names).map((line) => (
                    <div key={line.label} className="mb-1">
                      <dt className="d-inline fw-normal text-body-secondary">{line.label}: </dt>
                      <dd className="d-inline">{line.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}
        </QueryBoundary>
      </section>
    </>
  )
}
