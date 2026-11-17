import type { Employee, SalaryRecord } from '../api/types'

export function buildEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    employee_number: 'E000001',
    full_name: 'Asha Rao',
    email: 'asha.rao@acme.test',
    gender: 'female',
    hire_date: '2024-03-01',
    status: 'active',
    termination_date: null,
    deleted_at: null,
    country: { id: 1, code: 'US', name: 'United States' },
    department: { id: 1, name: 'Engineering' },
    job_title: { id: 1, name: 'Software Engineer', level: 2 },
    salary: { amount_cents: 8_000_000, currency: 'USD', formatted: '80,000.00 USD' },
    ...overrides,
  }
}

export function buildSalaryRecord(overrides: Partial<SalaryRecord> = {}): SalaryRecord {
  return {
    id: 1,
    amount_cents: 8_000_000,
    currency: 'USD',
    formatted: '80,000.00 USD',
    effective_from: '2024-03-01',
    reason: 'hire',
    created_at: '2024-03-01T00:00:00.000Z',
    ...overrides,
  }
}

/** The API's error envelope, for mocking failed calls. */
export function errorBody(code: string, message: string, details?: Record<string, string[]>) {
  return { error: { code, message, ...(details ? { details } : {}) } }
}

/** A list response, as GET /employees returns it. */
export function employeeList(
  employees: Employee[],
  meta: Partial<{ total: number; per_page: number; next_cursor: string | null }> = {},
) {
  return {
    data: employees,
    meta: { total: employees.length, per_page: 25, next_cursor: null, ...meta },
  }
}
