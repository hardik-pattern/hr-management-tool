import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/ApiError'
import { describeError } from './errors'

const validation = (details: Record<string, string[]>) =>
  new ApiError(422, 'validation_failed', 'Validation failed', details)

describe('describeError', () => {
  it('turns field errors into sentences naming the field', () => {
    expect(describeError(validation({ termination_date: ['cannot be in the future'] }))).toEqual([
      'Termination date cannot be in the future.',
    ])
  })

  it('refers to errors on the record as a whole as "This"', () => {
    expect(describeError(validation({ base: ['is already terminated'] }))).toEqual([
      'This is already terminated.',
    ])
  })

  it('lists every message', () => {
    expect(
      describeError(
        validation({ email: ['has already been taken'], employee: ['has been deleted'] }),
      ),
    ).toEqual(['Email has already been taken.', 'Employee has been deleted.'])
  })

  it('uses the message of errors that are not about fields', () => {
    expect(describeError(new ApiError(0, 'network_error', 'Could not reach the server.'))).toEqual([
      'Could not reach the server.',
    ])
    expect(describeError(new ApiError(404, 'not_found', 'Employee not found'))).toEqual([
      'Employee not found',
    ])
  })

  it('falls back to the message when a validation error has no details', () => {
    expect(describeError(validation({}))).toEqual(['Validation failed'])
  })

  it('does not leak the text of unexpected errors', () => {
    expect(describeError(new TypeError('x is undefined'))).toEqual([
      'Something went wrong. Please try again.',
    ])
  })
})
