import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/server'
import { errorBody } from '../test/fixtures'
import { ApiError } from './ApiError'
import { buildUrl, request } from './client'

// Resolves with the error a request fails with, and fails the test if it succeeds.
async function failureOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise
  } catch (error) {
    return error as ApiError
  }
  throw new Error('expected the request to fail')
}

describe('buildUrl', () => {
  it('prefixes the API path and leaves out empty values', () => {
    const url = buildUrl('/employees', { q: 'asha', status: undefined, cursor: null, page: '' })

    expect(url.pathname).toBe('/api/v1/employees')
    expect(url.search).toBe('?q=asha')
  })

  it('keeps zero and false, which are real values', () => {
    expect(buildUrl('/x', { n: 0, flag: false }).search).toBe('?n=0&flag=false')
  })

  it('encodes values', () => {
    expect(buildUrl('/x', { q: 'a&b c' }).searchParams.get('q')).toBe('a&b c')
  })
})

describe('request', () => {
  it('returns the parsed JSON body', async () => {
    server.use(http.get('/api/v1/ping', () => HttpResponse.json({ data: [1, 2] })))

    expect(await request('/ping')).toEqual({ data: [1, 2] })
  })

  it('sends query parameters', async () => {
    let seen = ''
    server.use(
      http.get('/api/v1/employees', ({ request: req }) => {
        seen = new URL(req.url).search
        return HttpResponse.json({})
      }),
    )

    await request('/employees', { query: { q: 'asha', per_page: 25, status: undefined } })

    expect(seen).toBe('?q=asha&per_page=25')
  })

  it('sends a JSON body with a content type, and none on GET', async () => {
    let post: { type: string | null; body: unknown } | undefined
    let getType: string | null | undefined = 'unset'
    server.use(
      http.post('/api/v1/things', async ({ request: req }) => {
        post = { type: req.headers.get('content-type'), body: await req.json() }
        return HttpResponse.json({})
      }),
      http.get('/api/v1/things', ({ request: req }) => {
        getType = req.headers.get('content-type')
        return HttpResponse.json({})
      }),
    )

    await request('/things', { method: 'POST', body: { a: 1 } })
    await request('/things')

    expect(post).toEqual({ type: 'application/json', body: { a: 1 } })
    expect(getType).toBeNull()
  })

  it('throws an ApiError carrying the error envelope, including field details', async () => {
    server.use(
      http.post('/api/v1/employees', () =>
        HttpResponse.json(
          errorBody('validation_failed', 'Validation failed', { email: ['is invalid'] }),
          { status: 422 },
        ),
      ),
    )

    const error = await failureOf(request('/employees', { method: 'POST', body: {} }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 422, code: 'validation_failed' })
    expect(error.fieldErrors('email')).toEqual(['is invalid'])
  })

  it('throws a not-found ApiError for a 404 envelope', async () => {
    server.use(
      http.get('/api/v1/employees/9', () =>
        HttpResponse.json(errorBody('not_found', 'Employee not found'), { status: 404 }),
      ),
    )

    const error = await failureOf(request('/employees/9'))

    expect(error.isNotFound).toBe(true)
    expect(error.message).toBe('Employee not found')
  })

  it('throws a generic ApiError when the server answers without the error envelope', async () => {
    server.use(
      http.get('/api/v1/ping', () => new HttpResponse('<html>Bad gateway</html>', { status: 502 })),
    )

    const error = await failureOf(request('/ping'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, code: 'http_error' })
    expect(error.isTransient).toBe(true)
  })

  it('throws a network ApiError when the server cannot be reached', async () => {
    server.use(http.get('/api/v1/ping', () => HttpResponse.error()))

    const error = await failureOf(request('/ping'))

    expect(error).toMatchObject({ status: 0, code: 'network_error' })
    expect(error.isTransient).toBe(true)
  })

  it('lets a cancelled request through as an abort, not an API error', async () => {
    server.use(http.get('/api/v1/ping', () => HttpResponse.json({})))
    const controller = new AbortController()
    controller.abort()

    const error = await failureOf(request('/ping', { signal: controller.signal }))

    expect(error).not.toBeInstanceOf(ApiError)
    expect(error.name).toBe('AbortError')
  })

  it('returns undefined for an empty success body', async () => {
    server.use(http.delete('/api/v1/ping', () => new HttpResponse(null, { status: 204 })))

    expect(await request('/ping', { method: 'DELETE' })).toBeUndefined()
  })
})
