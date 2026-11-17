import type { SalaryRecord } from '../api/types'

/** How much +to+ differs from +from+, as a percentage of +from+. */
export function percentChange(from: number, to: number): number {
  return ((to - from) / from) * 100
}

/**
 * Percentage change of each record against the one before it, for a history
 * as the API returns it (newest first). The oldest record has nothing to
 * compare with, so its change is null.
 *
 * A person's history is always in one currency, so the percentages are
 * meaningful; this must not be used across different employees.
 */
export function salaryChanges(newestFirst: SalaryRecord[]): (number | null)[] {
  return newestFirst.map((record, index) => {
    const previous = newestFirst[index + 1]
    return previous ? percentChange(previous.amount_cents, record.amount_cents) : null
  })
}

/** 10 -> "+10.0%", -2.5 -> "-2.5%", 0 -> "0.0%", null -> "—". */
export function formatPercentChange(change: number | null): string {
  if (change === null) return '—'
  const rounded = Math.abs(change).toFixed(1)
  if (Number(rounded) === 0) return '0.0%'
  return `${change > 0 ? '+' : '-'}${rounded}%`
}
