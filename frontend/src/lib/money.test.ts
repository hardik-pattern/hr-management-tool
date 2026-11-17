import { describe, expect, it } from 'vitest'
import { formatAmount, parseAmount } from './money'

describe('parseAmount', () => {
  it.each([
    ['50000', 2, 5_000_000],
    ['50000.5', 2, 5_000_050],
    ['50000.55', 2, 5_000_055],
    ['0.99', 2, 99],
    ['7', 0, 7],
    ['8000000', 0, 8_000_000],
  ])('reads %s with %i decimals', (text, exponent, expected) => {
    expect(parseAmount(text, exponent)).toEqual({ ok: true, cents: expected })
  })

  it('rounds half up to the currency precision', () => {
    expect(parseAmount('1.005', 2)).toEqual({ ok: true, cents: 101 })
    expect(parseAmount('1.004', 2)).toEqual({ ok: true, cents: 100 })
    expect(parseAmount('2.5', 0)).toEqual({ ok: true, cents: 3 })
    expect(parseAmount('2.4', 0)).toEqual({ ok: true, cents: 2 })
  })

  it('is exact where floating point is not', () => {
    // 1.005 * 100 is 100.49999999999999 in floating point.
    expect(parseAmount('1.005', 2)).toEqual({ ok: true, cents: 101 })
    expect(parseAmount('0.29', 2)).toEqual({ ok: true, cents: 29 })
  })

  it('accepts a trailing point and surrounding spaces', () => {
    expect(parseAmount('  12. ', 2)).toEqual({ ok: true, cents: 1200 })
  })

  it('treats an empty field as no value', () => {
    expect(parseAmount('', 2)).toEqual({ ok: true, cents: undefined })
    expect(parseAmount('   ', 2)).toEqual({ ok: true, cents: undefined })
  })

  it.each(['abc', '-5', '1,000', '1e5', '1.2.3', '$5', '.5'])('rejects %s', (text) => {
    expect(parseAmount(text, 2)).toEqual({ ok: false })
  })

  it('rejects numbers too large to represent exactly', () => {
    expect(parseAmount('99999999999999999999', 2)).toEqual({ ok: false })
  })
})

describe('formatAmount', () => {
  it('shows whole units, dropping unneeded decimals', () => {
    expect(formatAmount(5_000_000, 2)).toBe('50000')
    expect(formatAmount(5_000_050, 2)).toBe('50000.5')
    expect(formatAmount(5_000_055, 2)).toBe('50000.55')
  })

  it('pads amounts below one unit', () => {
    expect(formatAmount(5, 2)).toBe('0.05')
    expect(formatAmount(0, 2)).toBe('0')
  })

  it('has no decimals for a zero-exponent currency', () => {
    expect(formatAmount(8_000_000, 0)).toBe('8000000')
  })

  it('round-trips with parseAmount', () => {
    for (const cents of [0, 1, 99, 100, 5_000_050, 123_456_789]) {
      expect(parseAmount(formatAmount(cents, 2), 2)).toEqual({ ok: true, cents })
    }
  })
})
