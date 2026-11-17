import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './ApiError'

// Every failed query or mutation in this app is an ApiError (see client.ts), so
// say so once and `error` is typed that way everywhere.
declare module '@tanstack/react-query' {
  interface Register {
    defaultError: ApiError
  }
}

const MAX_RETRIES = 2

/**
 * Only transient failures (server down, 5xx) are retried. A 404 or a
 * validation error will fail the same way again, so retrying just delays the
 * message the user needs to see.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return error instanceof ApiError && error.isTransient && failureCount < MAX_RETRIES
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetry, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })
}
