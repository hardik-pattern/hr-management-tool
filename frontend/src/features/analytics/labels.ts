import type { AnalyticsGroup, AnalyticsMetric, StatusFilter } from '../../api/types'

export const METRIC_LABELS: Record<AnalyticsMetric, string> = {
  headcount: 'Headcount',
  sum: 'Total pay',
  avg: 'Average pay',
  median: 'Median pay',
  p25: 'Lower quartile pay (25th percentile)',
  p75: 'Upper quartile pay (75th percentile)',
  min: 'Lowest pay',
  max: 'Highest pay',
  iqr: 'Pay spread (75th minus 25th percentile)',
}

export const GROUP_LABELS: Record<AnalyticsGroup, string> = {
  country: 'Country',
  department: 'Department',
  job_title: 'Job title',
  gender: 'Gender',
  level: 'Level',
}

export const STATUS_TEXT: Record<StatusFilter, string> = {
  active: 'Active employees',
  terminated: 'Employees who have left',
  all: 'All employees',
}
