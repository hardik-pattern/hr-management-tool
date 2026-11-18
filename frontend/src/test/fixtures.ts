import type {
  Employee,
  EmployeeBrief,
  GenderPayGap,
  OutOfBand,
  OutOfBandRow,
  QuestionAnswer,
  QuestionInfo,
  SalaryRecord,
  StaleSalaries,
  StaleSalaryRow,
  Summary,
  SummaryRow,
} from '../api/types'

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

// ----- Analytics -----

export function summaryRow(
  label: string,
  headcount: number,
  value: number | null,
  formatted: string | null,
  id = label,
): SummaryRow {
  return { group: { department: { id, label } }, headcount, value, formatted }
}

/** A summary of pay by department unless told otherwise. */
export function buildSummary(overrides: Partial<Summary> = {}): Summary {
  return {
    metric: 'sum',
    unit: 'usd_cents',
    currency: 'USD',
    group_by: ['department'],
    status: 'active',
    filters: {},
    rows: [
      summaryRow('Engineering', 3, 600_000, '6,000.00 USD'),
      summaryRow('Sales', 2, 200_000, '2,000.00 USD'),
    ],
    total: { group: {}, headcount: 5, value: 800_000, formatted: '8,000.00 USD' },
    ...overrides,
  }
}

export function buildGenderGap(overrides: Partial<GenderPayGap> = {}): GenderPayGap {
  return {
    status: 'active',
    filters: {},
    min_group_size: 3,
    small_sample_below: 20,
    adjusted_gap_percent: -4.1,
    unadjusted_gap_percent: -1.0,
    women: 120,
    men: 130,
    women_compared: 100,
    comparisons_made: 12,
    comparisons_possible: 20,
    rows: [
      {
        job_title: { id: 1, name: 'Staff Engineer', level: 5, department: 'Engineering' },
        women: 50,
        men: 55,
        women_compared: 50,
        gap_percent: -6.2,
        small_sample: false,
      },
      {
        job_title: { id: 2, name: 'Head of Support', level: 6, department: 'Customer Support' },
        women: 6,
        men: 5,
        women_compared: 4,
        gap_percent: -16.7,
        small_sample: true,
      },
      {
        job_title: { id: 3, name: 'Paralegal', level: 1, department: 'Legal' },
        women: 2,
        men: 3,
        women_compared: 0,
        gap_percent: null,
        small_sample: false,
      },
    ],
    ...overrides,
  }
}

export function employeeBrief(overrides: Partial<EmployeeBrief> = {}): EmployeeBrief {
  return {
    id: 7,
    employee_number: 'E000007',
    full_name: 'Asha Rao',
    status: 'active',
    country: { id: 1, code: 'US', name: 'United States' },
    department: { id: 1, name: 'Engineering' },
    job_title: { id: 1, name: 'Software Engineer', level: 2 },
    salary: { amount_cents: 4_000_000, currency: 'USD', formatted: '40,000.00 USD' },
    ...overrides,
  }
}

export function outOfBandRow(overrides: Partial<OutOfBandRow> = {}): OutOfBandRow {
  return {
    ...employeeBrief(),
    direction: 'below',
    distance_percent: 20,
    band: {
      min_cents: 5_000_000,
      max_cents: 9_000_000,
      formatted: '50,000.00 USD to 90,000.00 USD',
    },
    ...overrides,
  }
}

export function buildOutOfBand(overrides: Partial<OutOfBand> = {}): OutOfBand {
  return {
    status: 'active',
    direction: 'any',
    total: 1,
    below: 1,
    above: 0,
    limit: 50,
    rows: [outOfBandRow()],
    ...overrides,
  }
}

export function staleRow(overrides: Partial<StaleSalaryRow> = {}): StaleSalaryRow {
  return { ...employeeBrief(), last_change_on: '2017-07-11', months_since: 112, ...overrides }
}

export function buildStale(overrides: Partial<StaleSalaries> = {}): StaleSalaries {
  return { status: 'active', months: 24, total: 1, limit: 50, rows: [staleRow()], ...overrides }
}

export const questionList: QuestionInfo[] = [
  {
    id: 'payroll-by-department',
    title: 'What is the total payroll by department?',
    description: 'The sum of current salaries for each department, in USD.',
    kind: 'summary',
  },
  {
    id: 'gender-pay-gap',
    title: 'What is the gender pay gap, comparing like with like?',
    description: 'Women against men in the same role and country.',
    kind: 'gender_pay_gap',
  },
  {
    id: 'paid-below-band',
    title: 'Who is paid below the band for their role?',
    description: 'Employees under the minimum of their pay band.',
    kind: 'out_of_band',
  },
  {
    id: 'no-raise-24-months',
    title: 'Who has not had a salary change in 24 months?',
    description: 'Longest without a change first.',
    kind: 'stale_salaries',
  },
]

export function buildAnswer(id: string): QuestionAnswer {
  const info = questionList.find((question) => question.id === id)!
  switch (info.kind) {
    case 'summary':
      return {
        ...info,
        kind: 'summary',
        params: { metric: 'sum', group_by: 'department' },
        result: buildSummary(),
      }
    case 'gender_pay_gap':
      return { ...info, kind: 'gender_pay_gap', params: {}, result: buildGenderGap() }
    case 'out_of_band':
      return {
        ...info,
        kind: 'out_of_band',
        params: { direction: 'below' },
        result: buildOutOfBand(),
      }
    case 'stale_salaries':
      return { ...info, kind: 'stale_salaries', params: { months: '24' }, result: buildStale() }
  }
}
