import { describe, expect, it } from 'vitest'
import { buildSalaryRecord } from '../test/fixtures'
import { formatPercentChange, percentChange, salaryChanges } from './salary'

const record = (id: number, amount_cents: number) => buildSalaryRecord({ id, amount_cents })

describe('percentChange', () => {
  it('is how much the new amount differs from the old, as a percentage of the old', () => {
    expect(percentChange(5_000_000, 5_500_000)).toBeCloseTo(10, 10)
    expect(percentChange(5_000_000, 4_750_000)).toBeCloseTo(-5, 10)
    expect(percentChange(5_000_000, 5_000_000)).toBe(0)
  })
})

describe('salaryChanges', () => {
  it('compares each record with the one before it; the oldest has nothing to compare with', () => {
    const history = [record(3, 6_600_000), record(2, 6_000_000), record(1, 5_000_000)]

    expect(salaryChanges(history)).toEqual([expect.closeTo(10, 10), expect.closeTo(20, 10), null])
  })

  it('reports a decrease as negative', () => {
    expect(salaryChanges([record(2, 4_750_000), record(1, 5_000_000)])[0]).toBeCloseTo(-5, 10)
  })

  it('reports no change as zero', () => {
    expect(salaryChanges([record(2, 5_000_000), record(1, 5_000_000)])[0]).toBe(0)
  })

  it('returns a single null for one record, and nothing for none', () => {
    expect(salaryChanges([record(1, 5_000_000)])).toEqual([null])
    expect(salaryChanges([])).toEqual([])
  })
})

describe('formatPercentChange', () => {
  it.each([
    [10, '+10.0%'],
    [3.456, '+3.5%'],
    [-2.5, '-2.5%'],
    [0, '0.0%'],
    [null, '—'],
  ])('shows %s as %s', (change, expected) => {
    expect(formatPercentChange(change)).toBe(expected)
  })

  it('does not show a sign for a change that rounds to zero', () => {
    expect(formatPercentChange(0.04)).toBe('0.0%')
    expect(formatPercentChange(-0.04)).toBe('0.0%')
  })
})
