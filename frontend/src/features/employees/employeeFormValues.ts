import type { ApiError } from '../../api/ApiError'
import type { Employee, EmployeeUpdate, Gender, NewEmployee } from '../../api/types'
import { parseAmount } from '../../lib/money'

/** What the form holds while it is being filled in: everything is text. */
export interface FormValues {
  full_name: string
  email: string
  gender: Gender | ''
  hire_date: string
  country_id: string
  department_id: string
  job_title_id: string
  salary: string
}

export type FormField = keyof FormValues
export type FormErrors = Partial<Record<FormField, string>>
export type FormMode = 'create' | 'edit'

export const EMPTY_VALUES: FormValues = {
  full_name: '',
  email: '',
  gender: '',
  hire_date: '',
  country_id: '',
  department_id: '',
  job_title_id: '',
  salary: '',
}

export const FIELD_LABELS: Record<FormField, string> = {
  full_name: 'Name',
  email: 'Email',
  gender: 'Gender',
  hire_date: 'Hire date',
  country_id: 'Country',
  department_id: 'Department',
  job_title_id: 'Job title',
  salary: 'Salary',
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function valuesFromEmployee(employee: Employee): FormValues {
  return {
    ...EMPTY_VALUES,
    full_name: employee.full_name,
    email: employee.email,
    gender: employee.gender,
    department_id: String(employee.department.id),
    job_title_id: String(employee.job_title.id),
  }
}

/** The checks the API would make anyway, done first so most mistakes need no round trip. */
// In edit mode only name, email, gender, department and job title are checked:
// the API fixes country and hire date after creation, and salary has its own
// change flow.
export function validate(values: FormValues, mode: FormMode, exponent: number): FormErrors {
  const errors: FormErrors = {}

  if (!values.full_name.trim()) errors.full_name = 'Enter a name.'
  if (!values.email.trim()) errors.email = 'Enter an email address.'
  else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (!values.gender) errors.gender = 'Choose a gender.'
  if (!values.department_id) errors.department_id = 'Choose a department.'
  if (!values.job_title_id) errors.job_title_id = 'Choose a job title.'

  if (mode === 'create') {
    if (!values.hire_date) errors.hire_date = 'Enter the hire date.'
    if (!values.country_id) errors.country_id = 'Choose a country.'

    const salary = parseAmount(values.salary, exponent)
    if (!values.salary.trim()) errors.salary = 'Enter the starting salary.'
    else if (!salary.ok) errors.salary = 'Enter an amount like 50000 or 50000.50.'
    else if (!salary.cents) errors.salary = 'The salary must be more than zero.'
  }

  return errors
}

export function toNewEmployee(values: FormValues, exponent: number): NewEmployee {
  const salary = parseAmount(values.salary, exponent)
  return {
    full_name: values.full_name.trim(),
    email: values.email.trim(),
    gender: values.gender as Gender,
    hire_date: values.hire_date,
    country_id: Number(values.country_id),
    department_id: Number(values.department_id),
    job_title_id: Number(values.job_title_id),
    salary_cents: salary.ok ? (salary.cents ?? 0) : 0,
  }
}

/**
 * Only what actually changed. Department and job title go together, because
 * the API checks that the title belongs to the department.
 */
export function toChanges(values: FormValues, original: Employee): EmployeeUpdate {
  const changes: EmployeeUpdate = {}

  if (values.full_name.trim() !== original.full_name) changes.full_name = values.full_name.trim()
  if (values.email.trim().toLowerCase() !== original.email) changes.email = values.email.trim()
  if (values.gender !== original.gender) changes.gender = values.gender as Gender

  const department_id = Number(values.department_id)
  const job_title_id = Number(values.job_title_id)
  if (department_id !== original.department.id || job_title_id !== original.job_title.id) {
    changes.department_id = department_id
    changes.job_title_id = job_title_id
  }

  return changes
}

// The API names fields after its own model attributes; this maps them to the form's.
const SERVER_FIELDS: Record<string, FormField> = {
  full_name: 'full_name',
  email: 'email',
  gender: 'gender',
  hire_date: 'hire_date',
  country: 'country_id',
  department: 'department_id',
  job_title: 'job_title_id',
  current_salary_cents: 'salary',
  current_currency: 'country_id',
}

/**
 * Splits a failed save into messages for individual fields and messages that
 * belong to no field (shown together at the top of the form).
 */
export function splitServerErrors(error: ApiError): { fields: FormErrors; general: string[] } {
  if (!error.isValidation) return { fields: {}, general: [error.message] }

  const fields: FormErrors = {}
  const general: string[] = []

  for (const [key, messages] of Object.entries(error.details)) {
    const field = SERVER_FIELDS[key]
    if (field)
      fields[field] = messages.map((message) => `${FIELD_LABELS[field]} ${message}.`).join(' ')
    else
      general.push(
        ...messages.map((message) => (key === 'base' ? `This ${message}.` : `${key} ${message}.`)),
      )
  }

  return {
    fields,
    general: general.length || Object.keys(fields).length ? general : [error.message],
  }
}
