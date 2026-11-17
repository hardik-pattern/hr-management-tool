/** Field name -> messages, as in the API's validation_failed `details`. */
export type FieldErrors = Record<string, string[]>

/**
 * Any failed API call. +code+ is the API's error code ("validation_failed",
 * "not_found", "bad_request") or "network_error" / "http_error" when the
 * server did not answer with its usual error envelope.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: FieldErrors

  constructor(status: number, code: string, message: string, details: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }

  get isValidation() {
    return this.code === 'validation_failed'
  }

  get isNotFound() {
    return this.status === 404
  }

  /** Worth retrying: the server was unreachable or failed, not the request. */
  get isTransient() {
    return this.code === 'network_error' || this.status >= 500
  }

  /** Messages for one field, e.g. fieldErrors('email'). */
  fieldErrors(field: string): string[] {
    return this.details[field] ?? []
  }
}
