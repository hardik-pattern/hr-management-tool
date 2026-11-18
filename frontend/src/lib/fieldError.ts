/** Id of the message element that explains a problem with the control +controlId+. */
export const feedbackId = (controlId: string) => `${controlId}-error`

/**
 * The attributes that tie a control to its error message, for assistive
 * technology: it is announced as invalid, and the message is read with it.
 * Spread onto a react-bootstrap Form.Control or Form.Select.
 */
export function invalidProps(controlId: string, message?: string) {
  return message
    ? { isInvalid: true, 'aria-invalid': true as const, 'aria-describedby': feedbackId(controlId) }
    : { isInvalid: false }
}
