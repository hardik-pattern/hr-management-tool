import { describe, expect, it } from 'vitest'
import { formatDate, formatDuration, todayIso } from './format'

describe('formatDate', () => {
  it('formats an ISO date', () => {
    expect(formatDate('2024-03-01')).toBe('1 Mar 2024')
  })

  it('does not shift the day for the viewer’s time zone', () => {
    expect(formatDate('2024-01-01')).toBe('1 Jan 2024')
    expect(formatDate('2024-12-31')).toBe('31 Dec 2024')
  })

  it('accepts a full timestamp by using its date part', () => {
    expect(formatDate('2024-03-01T23:30:00.000Z')).toBe('1 Mar 2024')
  })

  it('shows a dash for a missing or invalid date', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDate('not a date')).toBe('—')
  })
})

describe('todayIso', () => {
  it('is the UTC date', () => {
    expect(todayIso(new Date('2025-06-15T23:30:00Z'))).toBe('2025-06-15')
    expect(todayIso(new Date('2025-06-16T00:30:00Z'))).toBe('2025-06-16')
  })

  it('defaults to now', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0 months'],
    [1, '1 month'],
    [7, '7 months'],
    [12, '1 year'],
    [13, '1 year 1 month'],
    [24, '2 years'],
    [112, '9 years 4 months'],
  ])('%i months reads as "%s"', (months, expected) => {
    expect(formatDuration(months)).toBe(expected)
  })
})
