import { describe, expect, it } from 'vitest'
import { feedbackId, invalidProps } from './fieldError'

describe('invalidProps', () => {
  it('marks a control invalid and points it at its message', () => {
    expect(invalidProps('employee-email', 'Enter a valid email address.')).toEqual({
      isInvalid: true,
      'aria-invalid': true,
      'aria-describedby': 'employee-email-error',
    })
  })

  it('adds nothing to a control without a problem, so it is not announced as invalid', () => {
    expect(invalidProps('employee-email')).toEqual({ isInvalid: false })
    expect(invalidProps('employee-email', '')).toEqual({ isInvalid: false })
  })

  it('names the message element after the control', () => {
    expect(feedbackId('termination-date')).toBe('termination-date-error')
  })
})
