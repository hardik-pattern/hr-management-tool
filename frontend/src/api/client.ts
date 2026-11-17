import { ApiError, type FieldErrors } from './ApiError'

type QueryValue = string | number | boolean | undefined | null
export type QueryParams = Record<string, QueryValue>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: QueryParams
  body?: unknown
  signal?: AbortSignal
}

const API_PREFIX = '/api/v1'

/** Builds /api/v1/path?x=1, leaving out empty values so filters can be passed as-is. */
export function buildUrl(path: string, query: QueryParams = {}): URL {
  // Absolute against the page origin: relative URLs do not resolve in every fetch implementation.
  const url = new URL(`${API_PREFIX}${path}`, window.location.origin)
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url
}

/**
 * Calls the Rails API and returns the parsed JSON body. Any failure, whether
 * the server answered with an error envelope, answered with something else
 * (a proxy's HTML 502), or did not answer, is thrown as an ApiError.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', query, body, signal } = options

  let response: Response
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    // An aborted request is the caller cancelling, not a failure to report.
    if ((error as { name?: string }).name === 'AbortError') throw error
    throw new ApiError(0, 'network_error', 'Could not reach the server. Check your connection.')
  }

  const payload = await parseJson(response)

  if (!response.ok) throw toApiError(response.status, payload)
  return payload as T
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (text === '') return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: FieldErrors }
}

function toApiError(status: number, payload: unknown): ApiError {
  const error = (payload as ErrorEnvelope | undefined)?.error
  if (error?.code && error.message) {
    return new ApiError(status, error.code, error.message, error.details)
  }
  return new ApiError(status, 'http_error', `The server returned an unexpected error (${status}).`)
}
