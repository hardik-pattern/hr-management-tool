import type { Summary } from '../../api/types'
import { GROUP_LABELS, METRIC_LABELS, STATUS_TEXT } from './labels'

/** Names for the ids in a question's filters, from the reference lists. */
export interface Names {
  country?: Record<number, string>
  department?: Record<number, string>
  job_title?: Record<number, string>
}

const GENDER_TEXT: Record<string, string> = {
  female: 'Women',
  male: 'Men',
  non_binary: 'Non-binary employees',
  undisclosed: 'Employees who did not disclose',
}

/**
 * Says in plain words exactly what a summary measured, from the question the
 * API reports back, so what is on screen is never ambiguous.
 */
export function describeQuestion(
  summary: Summary,
  names: Names = {},
): { label: string; value: string }[] {
  const lines = [
    { label: 'Measure', value: METRIC_LABELS[summary.metric] },
    {
      label: 'Grouped by',
      value:
        summary.group_by.length > 0
          ? summary.group_by.map((g) => GROUP_LABELS[g]).join(' then ')
          : 'Nothing (one overall figure)',
    },
    { label: 'Employees', value: STATUS_TEXT[summary.status] },
  ]

  const named = (map: Record<number, string> | undefined, id: number | string) =>
    map?.[Number(id)] ?? `#${id}`
  for (const [key, value] of Object.entries(summary.filters)) {
    if (key === 'country_id')
      lines.push({ label: 'Only in country', value: named(names.country, value) })
    else if (key === 'department_id')
      lines.push({ label: 'Only in department', value: named(names.department, value) })
    else if (key === 'job_title_id')
      lines.push({ label: 'Only job title', value: named(names.job_title, value) })
    else if (key === 'gender')
      lines.push({ label: 'Only', value: GENDER_TEXT[String(value)] ?? String(value) })
    else if (key === 'level') lines.push({ label: 'Only level', value: String(value) })
  }

  if (summary.unit === 'usd_cents') lines.push({ label: 'Amounts', value: 'US dollars (USD)' })
  return lines
}
