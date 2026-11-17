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
