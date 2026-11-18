import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildSummary, summaryRow } from '../../test/fixtures'
import SummaryTable from './SummaryTable'

const bodyRows = () => screen.getAllByRole('row').slice(1, -1)
const cells = (row: HTMLElement) =>
  within(row)
    .getAllByRole('cell')
    .concat(within(row).queryAllByRole('rowheader'))
    .map((c) => c.textContent)

describe('SummaryTable', () => {
  it('shows a row per group with people and the measure, and the overall figure at the foot', () => {
    render(<SummaryTable summary={buildSummary()} />)

    expect(screen.getByRole('columnheader', { name: 'Department' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'People' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Total pay' })).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(2)
    expect(within(bodyRows()[0]).getByRole('rowheader')).toHaveTextContent('Engineering')
    expect(within(bodyRows()[0]).getByText('6,000.00 USD')).toBeInTheDocument()
    const footer = screen.getAllByRole('row').at(-1) as HTMLElement
    expect(footer).toHaveTextContent('All')
    expect(footer).toHaveTextContent('8,000.00 USD')
    expect(footer).toHaveTextContent('5')
  })

  it('says amounts are in US dollars, and who is counted', () => {
    render(<SummaryTable summary={buildSummary({ status: 'terminated' })} />)

    expect(
      screen.getByText(/Employees who have left\. Amounts are in US dollars \(USD\)\./),
    ).toBeInTheDocument()
  })

  it('does not mention dollars for a headcount, and shows people in a single column', () => {
    const summary = buildSummary({
      metric: 'headcount',
      unit: 'count',
      currency: null,
      rows: [summaryRow('Engineering', 3, 3, '3'), summaryRow('Sales', 2, 2, '2')],
      total: { group: {}, headcount: 5, value: 5, formatted: '5' },
    })
    render(<SummaryTable summary={summary} />)

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Department',
      'People',
    ])
    expect(screen.queryByText(/US dollars/)).not.toBeInTheDocument()
  })

  it('draws bars scaled to the largest value', () => {
    const { container } = render(<SummaryTable summary={buildSummary()} />)

    const widths = [...container.querySelectorAll<HTMLElement>('.progress-bar')].map((bar) =>
      parseFloat(bar.style.width),
    )
    expect(widths[0]).toBe(100)
    expect(widths[1]).toBeCloseTo(33.33, 1)
  })

  it('hides the bars from assistive technology, since the numbers carry the meaning', () => {
    const { container } = render(<SummaryTable summary={buildSummary()} />)

    container
      .querySelectorAll('.progress')
      .forEach((bar) => expect(bar).toHaveAttribute('aria-hidden', 'true'))
  })

  it('can leave the bars out', () => {
    const { container } = render(<SummaryTable summary={buildSummary()} bars={false} />)

    expect(container.querySelector('.progress')).toBeNull()
  })

  it('keeps the order it was given, or puts the largest first', () => {
    const summary = buildSummary({
      rows: [
        summaryRow('Alpha', 1, 100, '1.00 USD'),
        summaryRow('Beta', 1, 300, '3.00 USD'),
        summaryRow('Gamma', 1, 200, '2.00 USD'),
      ],
    })

    const { rerender } = render(<SummaryTable summary={summary} />)
    expect(bodyRows().map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ])

    rerender(<SummaryTable summary={summary} order="value" />)
    expect(bodyRows().map((r) => within(r).getByRole('rowheader').textContent)).toEqual([
      'Beta',
      'Gamma',
      'Alpha',
    ])
  })

  it('shows a dash where there is no value, with no bar', () => {
    const summary = buildSummary({
      rows: [summaryRow('Empty', 0, null, null)],
      total: { group: {}, headcount: 0, value: null, formatted: null },
    })
    const { container } = render(<SummaryTable summary={summary} />)

    expect(within(bodyRows()[0]).getByText('—')).toBeInTheDocument()
    expect(container.querySelector('.progress')).toBeNull()
  })

  it('handles two groupings, one column each', () => {
    const summary = buildSummary({
      group_by: ['department', 'country'],
      rows: [
        {
          group: {
            department: { id: 1, label: 'Engineering' },
            country: { id: 2, label: 'Japan' },
          },
          headcount: 1,
          value: 100,
          formatted: '1.00 USD',
        },
      ],
    })
    render(<SummaryTable summary={summary} />)

    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Department',
      'Country',
      'People',
      'Total pay',
    ])
    expect(
      within(bodyRows()[0])
        .getAllByRole('rowheader')
        .map((h) => h.textContent),
    ).toEqual(['Engineering', 'Japan'])
  })

  it('shows only the overall figure when nothing is grouped', () => {
    const summary = buildSummary({ group_by: [], rows: [] })
    render(<SummaryTable summary={summary} />)

    expect(bodyRows()).toHaveLength(0)
    expect(screen.getAllByRole('row').at(-1)).toHaveTextContent('Everyone')
  })

  it('says so when a grouped question matches nobody', () => {
    render(<SummaryTable summary={buildSummary({ rows: [] })} />)

    expect(screen.getByText('No employees match.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('names the table for assistive technology', () => {
    render(<SummaryTable summary={buildSummary({ metric: 'median' })} />)

    expect(screen.getByRole('table', { name: 'Median pay by department' })).toBeInTheDocument()
  })

  it('labels each kind of measure plainly', () => {
    render(<SummaryTable summary={buildSummary({ metric: 'iqr' })} />)

    expect(
      screen.getByRole('columnheader', { name: 'Pay spread (75th minus 25th percentile)' }),
    ).toBeInTheDocument()
  })

  it('exposes row values as cells for keyboard and screen readers', () => {
    render(<SummaryTable summary={buildSummary()} />)

    expect(cells(bodyRows()[1])).toEqual(expect.arrayContaining(['2', '2,000.00 USD', 'Sales']))
  })
})
