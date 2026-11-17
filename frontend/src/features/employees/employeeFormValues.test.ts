import { describe, expect, it } from 'vitest'
import { ApiError } from '../../api/ApiError'
import { buildEmployee } from '../../test/fixtures'
import {
  EMPTY_VALUES,
  splitServerErrors,
  toChanges,
  toNewEmployee,
  validate,
  valuesFromEmployee,
  type FormValues,
} from './employeeFormValues'

const valid: FormValues = {
  full_name: 'Asha Rao',
  email: 'asha.rao@acme.test',
  gender: 'female',
  hire_date: '2024-03-01',
  country_id: '1',
  department_id: '1',
  job_title_id: '2',
  salary: '80000',
}

describe('validate (create)', () => {
  it('accepts a complete form', () => {
    expect(validate(valid, 'create', 2)).toEqual({})
  })

  it('asks for every required field on an empty form', () => {
    expect(Object.keys(validate(EMPTY_VALUES, 'create', 2)).sort()).toEqual([
      'country_id',
      'department_id',
      'email',
      'full_name',
      'gender',
      'hire_date',
      'job_title_id',
      'salary',
    ])
  })

  it('treats a name of only spaces as missing', () => {
    expect(validate({ ...valid, full_name: '   ' }, 'create', 2).full_name).toBeDefined()
  })

  it.each(['asha', 'asha@', '@acme.test', 'asha rao@acme.test', 'asha@acme'])(
    'rejects the email %s',
    (email) => {
      expect(validate({ ...valid, email }, 'create', 2).email).toBe('Enter a valid email address.')
    },
  )

  it.each(['abc', '-5', '1,000'])('rejects the salary %s as not an amount', (salary) => {
    expect(validate({ ...valid, salary }, 'create', 2).salary).toMatch(/Enter an amount/)
  })

  it('rejects a salary of zero', () => {
    expect(validate({ ...valid, salary: '0' }, 'create', 2).salary).toBe(
      'The salary must be more than zero.',
    )
    expect(validate({ ...valid, salary: '0.00' }, 'create', 2).salary).toBe(
      'The salary must be more than zero.',
    )
  })

  it('rejects a salary that rounds to zero in the currency', () => {
    expect(validate({ ...valid, salary: '0.4' }, 'create', 0).salary).toBe(
      'The salary must be more than zero.',
    )
  })
})

describe('validate (edit)', () => {
  it('checks only the fields that can be edited', () => {
    const values = { ...valid, hire_date: '', country_id: '', salary: '' }

    expect(validate(values, 'edit', 2)).toEqual({})
  })

  it('still requires the editable fields', () => {
    expect(Object.keys(validate({ ...EMPTY_VALUES }, 'edit', 2)).sort()).toEqual([
      'department_id',
      'email',
      'full_name',
      'gender',
      'job_title_id',
    ])
  })
})

describe('toNewEmployee', () => {
  it('trims text, converts ids and turns the salary into minor units', () => {
    const result = toNewEmployee(
      { ...valid, full_name: '  Asha Rao ', email: ' asha.rao@acme.test ', salary: '80000.5' },
      2,
    )

    expect(result).toEqual({
      full_name: 'Asha Rao',
      email: 'asha.rao@acme.test',
      gender: 'female',
      hire_date: '2024-03-01',
      country_id: 1,
      department_id: 1,
      job_title_id: 2,
      salary_cents: 8_000_050,
    })
  })

  it('uses whole units for a currency without decimals', () => {
    expect(toNewEmployee({ ...valid, salary: '8000000' }, 0).salary_cents).toBe(8_000_000)
  })
})

describe('valuesFromEmployee', () => {
  it('fills the editable fields as text', () => {
    const employee = buildEmployee({ id: 1 })

    expect(valuesFromEmployee(employee)).toMatchObject({
      full_name: 'Asha Rao',
      email: 'asha.rao@acme.test',
      gender: 'female',
      department_id: '1',
      job_title_id: '1',
    })
  })
})

describe('toChanges', () => {
  const original = buildEmployee({ id: 1 })
  const unchanged = valuesFromEmployee(original)

  it('is empty when nothing changed', () => {
    expect(toChanges(unchanged, original)).toEqual({})
  })

  it('includes only the fields that changed', () => {
    expect(toChanges({ ...unchanged, full_name: 'Asha R. Rao' }, original)).toEqual({
      full_name: 'Asha R. Rao',
    })
    expect(toChanges({ ...unchanged, gender: 'undisclosed' }, original)).toEqual({
      gender: 'undisclosed',
    })
  })

  it('ignores surrounding spaces and the case of an unchanged email', () => {
    expect(
      toChanges({ ...unchanged, full_name: ' Asha Rao ', email: ' ASHA.RAO@acme.test ' }, original),
    ).toEqual({})
  })

  it('sends department and job title together when either changes', () => {
    expect(toChanges({ ...unchanged, job_title_id: '2' }, original)).toEqual({
      department_id: 1,
      job_title_id: 2,
    })
    expect(toChanges({ ...unchanged, department_id: '2', job_title_id: '3' }, original)).toEqual({
      department_id: 2,
      job_title_id: 3,
    })
  })
})

describe('splitServerErrors', () => {
  const validation = (details: Record<string, string[]>) =>
    new ApiError(422, 'validation_failed', 'Validation failed', details)

  it('puts a field error next to its field, with the field named', () => {
    const { fields, general } = splitServerErrors(validation({ email: ['has already been taken'] }))

    expect(fields).toEqual({ email: 'Email has already been taken.' })
    expect(general).toEqual([])
  })

  it('maps the API’s attribute names to the form’s fields', () => {
    const { fields } = splitServerErrors(
      validation({
        country: ['must exist'],
        job_title: ['does not belong to the department'],
        current_salary_cents: ['must be greater than 0'],
        department: ['must exist'],
      }),
    )

    expect(fields).toEqual({
      country_id: 'Country must exist.',
      job_title_id: 'Job title does not belong to the department.',
      salary: 'Salary must be greater than 0.',
      department_id: 'Department must exist.',
    })
  })

  it('joins several messages for one field', () => {
    const { fields } = splitServerErrors(validation({ email: ['is invalid', 'is too short'] }))

    expect(fields.email).toBe('Email is invalid. Email is too short.')
  })

  it('keeps messages that belong to no field for the top of the form', () => {
    const { fields, general } = splitServerErrors(
      validation({ base: ['is already terminated'], mystery: ['is odd'] }),
    )

    expect(fields).toEqual({})
    expect(general).toEqual(['This is already terminated.', 'mystery is odd.'])
  })

  it('shows any other kind of failure as a general message', () => {
    const { fields, general } = splitServerErrors(
      new ApiError(0, 'network_error', 'Could not reach the server.'),
    )

    expect(fields).toEqual({})
    expect(general).toEqual(['Could not reach the server.'])
  })

  it('falls back to the error message when a validation error has no details', () => {
    expect(splitServerErrors(validation({})).general).toEqual(['Validation failed'])
  })
})
