import { describe, expect, it } from 'vitest'
import { ApiError } from './ApiError'
import { shouldRetry } from './queryClient'

describe('ApiError', () => {
  it('exposes the status, code, message and field details', () => {
    const error = new ApiError(422, 'validation_failed', 'Validation failed', {
      email: ['is invalid'],
    })

    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({
      status: 422,
      code: 'validation_failed',
      message: 'Validation failed',
    })
    expect(error.isValidation).toBe(true)
    expect(error.fieldErrors('email')).toEqual(['is invalid'])
  })

  it('returns no messages for a field without errors', () => {
    expect(new ApiError(422, 'validation_failed', 'x').fieldErrors('email')).toEqual([])
  })

  it('recognises not-found errors', () => {
    expect(new ApiError(404, 'not_found', 'x').isNotFound).toBe(true)
    expect(new ApiError(422, 'validation_failed', 'x').isNotFound).toBe(false)
  })

  it('treats network failures and server errors as transient, client errors as not', () => {
    expect(new ApiError(0, 'network_error', 'x').isTransient).toBe(true)
    expect(new ApiError(503, 'http_error', 'x').isTransient).toBe(true)
    expect(new ApiError(404, 'not_found', 'x').isTransient).toBe(false)
    expect(new ApiError(422, 'validation_failed', 'x').isTransient).toBe(false)
  })
})

describe('shouldRetry', () => {
  it('retries transient errors up to twice', () => {
    const transient = new ApiError(503, 'http_error', 'x')

    expect(shouldRetry(0, transient)).toBe(true)
    expect(shouldRetry(1, transient)).toBe(true)
    expect(shouldRetry(2, transient)).toBe(false)
  })

  it('never retries errors that would fail the same way again', () => {
    expect(shouldRetry(0, new ApiError(404, 'not_found', 'x'))).toBe(false)
    expect(shouldRetry(0, new ApiError(422, 'validation_failed', 'x'))).toBe(false)
  })

  it('does not retry unexpected non-API errors', () => {
    expect(shouldRetry(0, new TypeError('bug'))).toBe(false)
  })
})
