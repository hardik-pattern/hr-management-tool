const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/**
 * "2024-03-01" -> "1 Mar 2024". Dates from the API have no time zone, so
 * they are read as UTC and shown as UTC; parsing them in the browser's zone
 * could show the previous day.
 */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const date = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date)
}

/**
 * Today's date as "YYYY-MM-DD" in UTC. The API decides whether a date is in
 * the future using its own (UTC) clock, so the form must agree with it:
 * using the browser's local date could offer a day the server then refuses.
 */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/** 112 -> "9 years 4 months", 7 -> "7 months", 12 -> "1 year". */
export function formatDuration(months: number): string {
  const years = Math.floor(months / 12)
  const rest = months % 12
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (years === 0) return plural(rest, 'month')
  return rest === 0 ? plural(years, 'year') : `${plural(years, 'year')} ${plural(rest, 'month')}`
}
