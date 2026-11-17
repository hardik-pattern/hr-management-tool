import type { SalaryRecord } from '../api/types'

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
    return previous
      ? ((record.amount_cents - previous.amount_cents) / previous.amount_cents) * 100
      : null
  })
}

/** 10 -> "+10.0%", -2.5 -> "-2.5%", 0 -> "0.0%", null -> "—". */
export function formatPercentChange(change: number | null): string {
  if (change === null) return '—'
  const rounded = Math.abs(change).toFixed(1)
  if (Number(rounded) === 0) return '0.0%'
  return `${change > 0 ? '+' : '-'}${rounded}%`
}
