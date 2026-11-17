import { http, HttpResponse } from 'msw'
import { server } from './server'
import type { employeeList } from './fixtures'

/**
 * Serves GET /employees from +respond+ and returns the query string of every
 * request received, in order, so tests can assert on what the page asked for.
 */
export function serveEmployees(
  respond: (params: URLSearchParams) => ReturnType<typeof employeeList>,
) {
  const searches: URLSearchParams[] = []
  server.use(
    http.get('/api/v1/employees', ({ request }) => {
      const params = new URL(request.url).searchParams
      searches.push(params)
      return HttpResponse.json(respond(params))
    }),
  )
  return searches
}
