// Shapes of the Rails API's JSON (backend/app/presenters and controllers).
// Dates arrive as ISO strings ("2024-03-01"), timestamps as ISO date-times.

export type Gender = 'female' | 'male' | 'non_binary' | 'undisclosed'
export type EmployeeStatus = 'active' | 'terminated'
export type SalaryReason = 'hire' | 'merit' | 'promotion' | 'adjustment' | 'correction' | 'rehire'

export interface Salary {
  amount_cents: number
  currency: string
  formatted: string
}

export interface Employee {
  id: number
  employee_number: string
  full_name: string
  email: string
  gender: Gender
  hire_date: string
  status: EmployeeStatus
  termination_date: string | null
  deleted_at: string | null
  country: { id: number; code: string; name: string }
  department: { id: number; name: string }
  job_title: { id: number; name: string; level: number }
  salary: Salary
}

export interface SalaryRecord extends Salary {
  id: number
  effective_from: string
  reason: SalaryReason
  created_at: string
}

export interface Country {
  id: number
  code: string
  name: string
  currency_code: string
}

export interface Currency {
  id: number
  code: string
  name: string
  minor_unit_exponent: number
  rate_to_usd: string
}

export interface Department {
  id: number
  name: string
}

export interface JobTitle {
  id: number
  name: string
  level: number
  department_id: number
  department_name: string
}

export interface EmployeeList {
  data: Employee[]
  meta: { total: number; per_page: number; next_cursor: string | null }
}

export type StatusFilter = 'active' | 'terminated' | 'all'
export type EmployeeSort =
  | 'full_name'
  | 'hire_date'
  | 'current_salary_cents'
  | 'employee_number'
  | `-${'full_name' | 'hire_date' | 'current_salary_cents' | 'employee_number'}`

/** Query parameters accepted by GET /employees (see EmployeeSearch). */
export interface EmployeeFilters {
  q?: string
  country_id?: number
  department_id?: number
  job_title_id?: number
  status?: StatusFilter
  deleted?: 'only'
  /** In the country's currency; the API requires country_id with these. */
  salary_min?: number
  salary_max?: number
  sort?: EmployeeSort
  per_page?: number
  cursor?: string
}

export interface NewEmployee {
  full_name: string
  email: string
  gender: Gender
  hire_date: string
  country_id: number
  department_id: number
  job_title_id: number
  salary_cents: number
}

/** Country and hire date cannot be changed after creation. */
export type EmployeeUpdate = Partial<
  Pick<NewEmployee, 'full_name' | 'email' | 'gender' | 'department_id' | 'job_title_id'>
>

export interface SalaryChange {
  amount_cents: number
  effective_from: string
  reason: Exclude<SalaryReason, 'hire'>
}

export interface SalaryChangeResult {
  salary_record: SalaryRecord
  employee: Employee
}

export interface Rehire {
  salary_cents?: number
  effective_from?: string
}

// ----- Analytics (see backend/app/services/analytics) -----

export type AnalyticsMetric =
  'headcount' | 'sum' | 'avg' | 'median' | 'p25' | 'p75' | 'min' | 'max' | 'iqr'
export type AnalyticsGroup = 'country' | 'department' | 'job_title' | 'gender' | 'level'

export interface GroupLabel {
  id: number | string
  label: string
}

export interface SummaryRow {
  group: Partial<Record<AnalyticsGroup, GroupLabel>>
  headcount: number
  /** USD cents for money measures, a count for headcount; null when nobody matched. */
  value: number | null
  formatted: string | null
}

export interface Summary {
  metric: AnalyticsMetric
  unit: 'count' | 'usd_cents'
  currency: 'USD' | null
  group_by: AnalyticsGroup[]
  status: StatusFilter
  filters: Record<string, number | string>
  rows: SummaryRow[]
  total: SummaryRow
}

/** What can be asked of GET /analytics/summary. */
export interface SummaryParams {
  metric?: AnalyticsMetric
  group_by?: AnalyticsGroup[]
  status?: StatusFilter
  country_id?: number
  department_id?: number
  job_title_id?: number
  gender?: Gender
  level?: number
}

export interface GenderGapRow {
  job_title: { id: number; name: string; level: number; department: string }
  women: number
  men: number
  women_compared: number
  /** Negative: women are paid less than men in the same role and country. Null: too few to compare. */
  gap_percent: number | null
  small_sample: boolean
}

export interface GenderPayGap {
  status: StatusFilter
  filters: Record<string, number>
  min_group_size: number
  small_sample_below: number
  adjusted_gap_percent: number | null
  unadjusted_gap_percent: number | null
  women: number
  men: number
  women_compared: number
  comparisons_made: number
  comparisons_possible: number
  rows: GenderGapRow[]
}

export interface EmployeeBrief {
  id: number
  employee_number: string
  full_name: string
  status: EmployeeStatus
  country: { id: number; code: string; name: string }
  department: { id: number; name: string }
  job_title: { id: number; name: string; level: number }
  salary: Salary
}

export interface OutOfBandRow extends EmployeeBrief {
  direction: 'below' | 'above'
  distance_percent: number
  band: { min_cents: number; max_cents: number; formatted: string }
}

export interface OutOfBand {
  status: StatusFilter
  direction: 'any' | 'below' | 'above'
  total: number
  below: number
  above: number
  limit: number
  rows: OutOfBandRow[]
}

export interface StaleSalaryRow extends EmployeeBrief {
  last_change_on: string
  months_since: number
}

export interface StaleSalaries {
  status: StatusFilter
  months: number
  total: number
  limit: number
  rows: StaleSalaryRow[]
}

export type QuestionKind = 'summary' | 'gender_pay_gap' | 'out_of_band' | 'stale_salaries'

export interface QuestionInfo {
  id: string
  title: string
  description: string
  kind: QuestionKind
}

/** A catalog answer: the result is shaped like the analytics endpoint behind its kind. */
export type QuestionAnswer = QuestionInfo & { params: Record<string, string> } & (
    | { kind: 'summary'; result: Summary }
    | { kind: 'gender_pay_gap'; result: GenderPayGap }
    | { kind: 'out_of_band'; result: OutOfBand }
    | { kind: 'stale_salaries'; result: StaleSalaries }
  )
