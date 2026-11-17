import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// The lookup lists every employees screen loads for its dropdowns. Tests that
// care about them override these with server.use(...).
export const referenceHandlers = [
  http.get('/api/v1/reference/countries', () =>
    HttpResponse.json({
      data: [
        { id: 1, code: 'US', name: 'United States', currency_code: 'USD' },
        { id: 2, code: 'JP', name: 'Japan', currency_code: 'JPY' },
      ],
    }),
  ),
  http.get('/api/v1/reference/currencies', () =>
    HttpResponse.json({
      data: [
        { id: 1, code: 'USD', name: 'US Dollar', minor_unit_exponent: 2, rate_to_usd: '1.0' },
        { id: 2, code: 'JPY', name: 'Japanese Yen', minor_unit_exponent: 0, rate_to_usd: '0.0067' },
      ],
    }),
  ),
  http.get('/api/v1/reference/departments', () =>
    HttpResponse.json({
      data: [
        { id: 1, name: 'Engineering' },
        { id: 2, name: 'Sales' },
      ],
    }),
  ),
  http.get('/api/v1/reference/job_titles', () =>
    HttpResponse.json({
      data: [
        {
          id: 1,
          name: 'Software Engineer',
          level: 2,
          department_id: 1,
          department_name: 'Engineering',
        },
        {
          id: 2,
          name: 'Staff Engineer',
          level: 5,
          department_id: 1,
          department_name: 'Engineering',
        },
        { id: 3, name: 'Account Executive', level: 2, department_id: 2, department_name: 'Sales' },
      ],
    }),
  ),
]

// Shared mock API for tests. Tests add their own handlers with
// server.use(...); anything unhandled fails the test (see setup.ts).
export const server = setupServer(...referenceHandlers)
