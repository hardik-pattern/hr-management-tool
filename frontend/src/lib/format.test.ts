import { describe, expect, it } from 'vitest'
import { formatDate } from './format'

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
