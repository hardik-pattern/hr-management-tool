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
