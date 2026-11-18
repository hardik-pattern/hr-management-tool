import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { buildOutOfBand, buildStale, outOfBandRow, staleRow } from '../../test/fixtures'
import { OutOfBandTable, StaleSalariesTable } from './EmployeeFindings'

const renderInRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>)
const rows = () => screen.getAllByRole('row').slice(1)

describe('OutOfBandTable', () => {
  it('lists each employee with their salary, band, and how far outside it they are', () => {
    renderInRouter(<OutOfBandTable data={buildOutOfBand()} />)

    const row = rows()[0]
    expect(within(row).getByRole('link', { name: 'Asha Rao' })).toHaveAttribute(
      'href',
      '/employees/7',
    )
    expect(row).toHaveTextContent('E000007')
    expect(row).toHaveTextContent('Software Engineer')
    expect(row).toHaveTextContent('United States')
    expect(row).toHaveTextContent('40,000.00 USD')
    expect(row).toHaveTextContent('50,000.00 USD to 90,000.00 USD')
    expect(row).toHaveTextContent('20.0% below')
  })

  it('says which way for those above their band', () => {
    renderInRouter(
      <OutOfBandTable
        data={buildOutOfBand({
          rows: [outOfBandRow({ direction: 'above', distance_percent: 12.34 })],
        })}
      />,
    )

    expect(rows()[0]).toHaveTextContent('12.3% above')
  })

  it('says how many there are when only some are shown', () => {
    renderInRouter(
      <OutOfBandTable
        data={buildOutOfBand({
          total: 51,
          rows: [outOfBandRow({ id: 1 }), outOfBandRow({ id: 2 })],
        })}
      />,
    )

    expect(screen.getByText('Showing 2 of 51.')).toBeInTheDocument()
  })

  it('does not say "showing" when everything is shown', () => {
    renderInRouter(<OutOfBandTable data={buildOutOfBand()} />)

    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  })

  it('can show only the first few', () => {
    const data = buildOutOfBand({ total: 3, rows: [1, 2, 3].map((id) => outOfBandRow({ id })) })
    renderInRouter(<OutOfBandTable data={data} limit={2} />)

    expect(rows()).toHaveLength(2)
    expect(screen.getByText('Showing 2 of 3.')).toBeInTheDocument()
  })

  it('says so when nobody is outside their band', () => {
    renderInRouter(<OutOfBandTable data={buildOutOfBand({ total: 0, rows: [] })} />)

    expect(screen.getByText('Nobody is paid outside their band.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('StaleSalariesTable', () => {
  it('lists each employee with the date of their last change and how long ago it was', () => {
    renderInRouter(<StaleSalariesTable data={buildStale()} />)

    const row = rows()[0]
    expect(within(row).getByRole('link', { name: 'Asha Rao' })).toHaveAttribute(
      'href',
      '/employees/7',
    )
    expect(row).toHaveTextContent('11 Jul 2017')
    expect(row).toHaveTextContent('9 years 4 months')
  })

  it('says how many there are when only some are shown', () => {
    renderInRouter(
      <StaleSalariesTable
        data={buildStale({ total: 581, rows: [staleRow({ id: 1 }), staleRow({ id: 2 })] })}
      />,
    )

    expect(screen.getByText('Showing 2 of 581.')).toBeInTheDocument()
  })

  it('says so when everyone has had a recent change, naming the period', () => {
    renderInRouter(<StaleSalariesTable data={buildStale({ total: 0, months: 36, rows: [] })} />)

    expect(screen.getByText('Everyone has had a change in the last 36 months.')).toBeInTheDocument()
  })

  it('names the table for assistive technology, with the period', () => {
    renderInRouter(<StaleSalariesTable data={buildStale({ months: 12 })} />)

    expect(
      screen.getByRole('table', { name: 'Employees with no salary change in 12 months' }),
    ).toBeInTheDocument()
  })
})
