import { Table } from 'react-bootstrap'
import type { Summary } from '../../api/types'
import { GROUP_LABELS, METRIC_LABELS, STATUS_TEXT } from './labels'

interface Props {
  summary: Summary
  /** Keep the server's order (by group name), or put the largest value first. */
  order?: 'group' | 'value'
  /** Draw a bar beside each value, scaled to the largest. */
  bars?: boolean
}

/**
 * The answer to an analytics question as a table: one row per group, the
 * number of people, the measure (with a bar), and the overall figure at the
 * foot. Amounts are in USD, as the API converts them.
 */
export default function SummaryTable({ summary, order = 'group', bars = true }: Props) {
  const { metric, group_by: groups, unit } = summary
  const isCount = metric === 'headcount'
  const rows =
    order === 'value'
      ? [...summary.rows].sort((a, b) => (b.value ?? -1) - (a.value ?? -1))
      : summary.rows
  const largest = Math.max(0, ...rows.map((row) => row.value ?? 0))
  const title =
    groups.length > 0
      ? `${METRIC_LABELS[metric]} by ${groups.map((g) => GROUP_LABELS[g].toLowerCase()).join(' and ')}`
      : METRIC_LABELS[metric]

  if (groups.length > 0 && rows.length === 0) {
    return <p className="text-body-secondary">No employees match.</p>
  }

  return (
    <>
      <div className="table-responsive">
        <Table size="sm" hover>
          <caption className="visually-hidden">{title}</caption>
          <thead>
            <tr>
              {groups.map((group) => (
                <th key={group} scope="col">
                  {GROUP_LABELS[group]}
                </th>
              ))}
              {!isCount && (
                <th scope="col" className="text-end">
                  People
                </th>
              )}
              <th scope="col" className="text-end">
                {isCount ? 'People' : METRIC_LABELS[metric]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={groups.map((g) => row.group[g]?.id).join('|')}>
                {groups.map((group) => (
                  <th key={group} scope="row" className="fw-normal">
                    {row.group[group]?.label}
                  </th>
                ))}
                {!isCount && <td className="text-end">{row.headcount.toLocaleString('en-US')}</td>}
                <td className="text-end">
                  <span className="text-nowrap">{row.formatted ?? '—'}</span>
                  {bars && row.value !== null && largest > 0 && (
                    <div className="progress mt-1" style={{ height: 4 }} aria-hidden="true">
                      <div
                        className="progress-bar"
                        style={{ width: `${(row.value / largest) * 100}%` }}
                      />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="fw-semibold">
              <th scope="row" colSpan={Math.max(groups.length, 1)}>
                {groups.length > 0 ? 'All' : 'Everyone'}
              </th>
              {!isCount && (
                <td className="text-end">{summary.total.headcount.toLocaleString('en-US')}</td>
              )}
              <td className="text-end text-nowrap">{summary.total.formatted ?? '—'}</td>
            </tr>
          </tfoot>
        </Table>
      </div>
      <p className="small text-body-secondary mb-0">
        {STATUS_TEXT[summary.status]}.
        {unit === 'usd_cents' ? ' Amounts are in US dollars (USD).' : ''}
      </p>
    </>
  )
}
