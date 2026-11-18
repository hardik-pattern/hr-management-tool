import { Badge, Table } from 'react-bootstrap'
import type { GenderPayGap } from '../../api/types'
import { formatPercentChange } from '../../lib/salary'
import { headlineGap } from './describeGap'

interface Props {
  data: GenderPayGap
  /** Show only the first rows, for a summary. */
  limit?: number
}

export default function GenderGapView({ data, limit }: Props) {
  const rows = limit ? data.rows.slice(0, limit) : data.rows

  return (
    <>
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <p className="text-body-secondary mb-1">Like for like</p>
          <p className="h4 mb-1">{headlineGap(data.adjusted_gap_percent)}</p>
          <p className="small text-body-secondary mb-0">
            Compares women with men in the same job title and country, then combines those
            comparisons.
          </p>
        </div>
        <div className="col-md-6">
          <p className="text-body-secondary mb-1">Raw averages</p>
          <p className="h4 mb-1">{headlineGap(data.unadjusted_gap_percent)}</p>
          <p className="small text-body-secondary mb-0">
            Ignores job title and country, so it also reflects who works in which roles.
          </p>
        </div>
      </div>

      <p className="small text-body-secondary">
        Based on {data.women_compared.toLocaleString('en-US')} of{' '}
        {data.women.toLocaleString('en-US')} women, in {data.comparisons_made} of{' '}
        {data.comparisons_possible} job title and country groups. A group needs at least{' '}
        {data.min_group_size} women and {data.min_group_size} men to be compared. This shows a
        difference in pay, not its cause.
      </p>

      {rows.length > 0 && (
        <div className="table-responsive">
          <Table size="sm" hover>
            <caption className="visually-hidden">
              Pay gap by job title, women compared with men
            </caption>
            <thead>
              <tr>
                <th scope="col">Job title</th>
                <th scope="col">Department</th>
                <th scope="col" className="text-end">
                  Women
                </th>
                <th scope="col" className="text-end">
                  Men
                </th>
                <th scope="col" className="text-end">
                  Women vs men
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.job_title.id}>
                  <th scope="row" className="fw-normal">
                    {row.job_title.name}
                  </th>
                  <td>{row.job_title.department}</td>
                  <td className="text-end">{row.women}</td>
                  <td className="text-end">{row.men}</td>
                  <td className="text-end text-nowrap">
                    {formatPercentChange(row.gap_percent)}
                    {row.small_sample && (
                      <Badge
                        bg="warning"
                        text="dark"
                        className="ms-2"
                        title={`Fewer than ${data.small_sample_below} women compared`}
                      >
                        Small sample
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      {limit && data.rows.length > rows.length && (
        <p className="small text-body-secondary mb-0">
          Showing {rows.length} of {data.rows.length} job titles.
        </p>
      )}
    </>
  )
}
