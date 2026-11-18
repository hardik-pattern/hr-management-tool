import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { buildGenderGap } from '../../test/fixtures'
import { describeGap, headlineGap } from './describeGap'
import GenderGapView from './GenderGapView'

describe('describeGap', () => {
  it.each([
    [-4.1, '4.1% lower'],
    [2, '2.0% higher'],
    [0, 'no difference'],
    [0.04, 'no difference'],
    [-0.04, 'no difference'],
    [null, 'not enough data to compare'],
  ])('describes %s as "%s"', (percent, expected) => {
    expect(describeGap(percent)).toBe(expected)
  })
})

describe('headlineGap', () => {
  it.each([
    [-4.1, 'Women are paid 4.1% lower than men'],
    [2, 'Women are paid 2.0% higher than men'],
    [0, 'No pay difference between women and men'],
    [0.04, 'No pay difference between women and men'],
    [null, 'Not enough data to compare'],
  ])('reads %s as "%s"', (percent, expected) => {
    expect(headlineGap(percent)).toBe(expected)
  })
})

describe('GenderGapView', () => {
  it('leads with the like-for-like gap, and shows the raw one for context', () => {
    render(<GenderGapView data={buildGenderGap()} />)

    expect(screen.getByText('Women are paid 4.1% lower than men')).toBeInTheDocument()
    expect(screen.getByText('Women are paid 1.0% lower than men')).toBeInTheDocument()
    expect(
      screen.getByText(/Compares women with men in the same job title and country/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Ignores job title and country/)).toBeInTheDocument()
  })

  it('says how much of the data the comparison rests on, and that it does not explain why', () => {
    render(<GenderGapView data={buildGenderGap()} />)

    expect(
      screen.getByText(/Based on 100 of 120 women, in 12 of 20 job title and country groups/),
    ).toBeInTheDocument()
    expect(screen.getByText(/at least 3 women and 3 men/)).toBeInTheDocument()
    expect(screen.getByText(/a difference in pay, not its cause/)).toBeInTheDocument()
  })

  it('lists each job title with its gap as a signed percentage', () => {
    render(<GenderGapView data={buildGenderGap()} />)

    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[0]).getByRole('rowheader')).toHaveTextContent('Staff Engineer')
    expect(rows[0]).toHaveTextContent('Engineering')
    expect(rows[0]).toHaveTextContent('-6.2%')
  })

  it('flags a gap that rests on few women, instead of letting it look as solid as the rest', () => {
    render(<GenderGapView data={buildGenderGap()} />)

    const rows = screen.getAllByRole('row').slice(1)
    expect(within(rows[1]).getByText('Small sample')).toHaveAttribute(
      'title',
      'Fewer than 20 women compared',
    )
    expect(within(rows[0]).queryByText('Small sample')).not.toBeInTheDocument()
  })

  it('shows a dash for a job title that could not be compared', () => {
    render(<GenderGapView data={buildGenderGap()} />)

    expect(screen.getAllByRole('row')[3]).toHaveTextContent('—')
  })

  it('can show just the first few job titles, and says how many there are', () => {
    render(<GenderGapView data={buildGenderGap()} limit={2} />)

    expect(screen.getAllByRole('row')).toHaveLength(3)
    expect(screen.getByText('Showing 2 of 3 job titles.')).toBeInTheDocument()
  })

  it('does not claim a figure when there is nothing to compare', () => {
    render(
      <GenderGapView
        data={buildGenderGap({
          adjusted_gap_percent: null,
          unadjusted_gap_percent: null,
          rows: [],
          women: 0,
          men: 0,
          women_compared: 0,
        })}
      />,
    )

    expect(screen.getAllByText('Not enough data to compare')).toHaveLength(2)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})
