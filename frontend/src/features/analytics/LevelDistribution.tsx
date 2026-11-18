import { Table } from 'react-bootstrap'
import { useSummary } from '../../api/analytics'
import QueryBoundary from './QueryBoundary'

/**
 * How pay is spread across job levels: the lower quartile, median and upper
 * quartile for each, in USD. Three questions, answered together, so the spread
 * within a level is visible and not only its middle.
 */
export default function LevelDistribution() {
  const lower = useSummary({ metric: 'p25', group_by: ['level'] })
  const middle = useSummary({ metric: 'median', group_by: ['level'] })
  const upper = useSummary({ metric: 'p75', group_by: ['level'] })

  // The three answers are one table, so it waits for all three, and shows the first failure.
  const queries = [lower, middle, upper]
  const query = queries.find((q) => q.isError) ?? queries.find((q) => q.isPending) ?? middle

  return (
    <QueryBoundary query={query} label="pay by level">
      {() => {
        const by = (summary: typeof lower.data, id: number | string) =>
          summary?.rows.find((row) => row.group.level?.id === id)
        const largest = Math.max(0, ...(upper.data?.rows.map((row) => row.value ?? 0) ?? []))

        return (
          <div className="table-responsive">
            <Table size="sm" hover>
              <caption className="visually-hidden">
                Pay by level: lower quartile, median and upper quartile
              </caption>
              <thead>
                <tr>
                  <th scope="col">Level</th>
                  <th scope="col" className="text-end">
                    People
                  </th>
                  <th scope="col" className="text-end">
                    25th percentile
                  </th>
                  <th scope="col" className="text-end">
                    Median
                  </th>
                  <th scope="col" className="text-end">
                    75th percentile
                  </th>
                </tr>
              </thead>
              <tbody>
                {middle.data?.rows.map((row) => {
                  // Rows without a level cannot be placed in this table, so they are skipped.
                  const level = row.group.level
                  if (!level) return null
                  return (
                    <tr key={level.id}>
                      <th scope="row" className="fw-normal">
                        {level.label}
                      </th>
                      <td className="text-end">{row.headcount.toLocaleString('en-US')}</td>
                      <td className="text-end text-nowrap">
                        {by(lower.data, level.id)?.formatted ?? '—'}
                      </td>
                      <td className="text-end text-nowrap">
                        {row.formatted ?? '—'}
                        {row.value !== null && largest > 0 && (
                          <div className="progress mt-1" style={{ height: 4 }} aria-hidden="true">
                            <div
                              className="progress-bar"
                              style={{ width: `${(row.value / largest) * 100}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="text-end text-nowrap">
                        {by(upper.data, level.id)?.formatted ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <p className="small text-body-secondary mb-0">
              Active employees. Amounts are in US dollars (USD).
            </p>
          </div>
        )
      }}
    </QueryBoundary>
  )
}
