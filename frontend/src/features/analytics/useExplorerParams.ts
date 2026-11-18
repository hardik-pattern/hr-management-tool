import { useSearchParams } from 'react-router-dom'
import type {
  AnalyticsGroup,
  AnalyticsMetric,
  Gender,
  StatusFilter,
  SummaryParams,
} from '../../api/types'

export const METRICS: AnalyticsMetric[] = [
  'headcount',
  'sum',
  'avg',
  'median',
  'p25',
  'p75',
  'min',
  'max',
  'iqr',
]
export const GROUPS: AnalyticsGroup[] = ['country', 'department', 'job_title', 'gender', 'level']
export const STATUSES: StatusFilter[] = ['active', 'terminated', 'all']
export const GENDERS: Gender[] = ['female', 'male', 'non_binary', 'undisclosed']
export const MAX_GROUPS = 2

// What the explorer starts with, so the first visit already shows something useful.
export const DEFAULT_METRIC: AnalyticsMetric = 'median'
export const DEFAULT_GROUPS: AnalyticsGroup[] = ['department']
export const DEFAULT_STATUS: StatusFilter = 'active'

type FilterKey = 'country_id' | 'department_id' | 'job_title_id' | 'gender' | 'level'

/** What can be changed in one go; undefined removes a filter. */
export type ExplorerChanges = {
  metric?: AnalyticsMetric
  group_by?: AnalyticsGroup[]
  status?: StatusFilter
} & Partial<Record<FilterKey, string | number | undefined>>

function positive(raw: string | null, max?: number): number | undefined {
  const value = Number(raw)
  return raw && Number.isInteger(value) && value > 0 && (max === undefined || value <= max)
    ? value
    : undefined
}

/**
 * The explorer's question, kept in the URL so a view can be bookmarked or
 * shared. Anything that is not valid is ignored, so a hand-edited address
 * cannot break the page; defaults are left out of the address to keep it short.
 */
export function useExplorerParams() {
  const [search, setSearch] = useSearchParams()

  const rawMetric = search.get('metric') as AnalyticsMetric | null
  const rawGroups = search.has('group_by') ? (search.get('group_by') ?? '').split(',') : null
  const rawStatus = search.get('status') as StatusFilter | null
  const rawGender = search.get('gender') as Gender | null

  const groups = rawGroups
    ? [
        ...new Set(
          rawGroups.filter((g): g is AnalyticsGroup => GROUPS.includes(g as AnalyticsGroup)),
        ),
      ].slice(0, MAX_GROUPS)
    : DEFAULT_GROUPS

  const params: SummaryParams = {
    metric: rawMetric && METRICS.includes(rawMetric) ? rawMetric : DEFAULT_METRIC,
    group_by: groups,
    status: rawStatus && STATUSES.includes(rawStatus) ? rawStatus : DEFAULT_STATUS,
  }
  const country_id = positive(search.get('country_id'))
  const department_id = positive(search.get('department_id'))
  const job_title_id = positive(search.get('job_title_id'))
  const level = positive(search.get('level'), 7)
  if (country_id) params.country_id = country_id
  if (department_id) params.department_id = department_id
  if (job_title_id) params.job_title_id = job_title_id
  if (level) params.level = level
  if (rawGender && GENDERS.includes(rawGender)) params.gender = rawGender

  const update = (changes: ExplorerChanges) => {
    const next = new URLSearchParams(search)
    for (const [key, value] of Object.entries(changes)) {
      const isDefault =
        (key === 'metric' && value === DEFAULT_METRIC) ||
        (key === 'status' && value === DEFAULT_STATUS) ||
        (key === 'group_by' && Array.isArray(value) && value.join(',') === DEFAULT_GROUPS.join(','))
      if (key === 'group_by' && Array.isArray(value)) {
        // An explicitly empty grouping must survive in the address: it means "no grouping", not "the default".
        if (isDefault) next.delete(key)
        else next.set(key, value.join(','))
      } else if (value === undefined || value === '' || isDefault) next.delete(key)
      else next.set(key, String(value))
    }
    setSearch(next, { replace: true })
  }

  return {
    params,
    set: update,
    /** Back to the starting question. */
    reset: () => setSearch(new URLSearchParams(), { replace: true }),
    isDefault: [...search.keys()].length === 0,
  }
}
