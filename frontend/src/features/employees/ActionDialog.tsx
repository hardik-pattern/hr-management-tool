import type { FormEvent, ReactNode } from 'react'
import { Alert, Button, Form, Modal, Spinner } from 'react-bootstrap'

interface Props {
  title: string
  children: ReactNode
  submitLabel: string
  /** Colour of the confirm button; destructive actions use "danger". */
  variant?: 'primary' | 'danger'
  submitting: boolean
  /** Sentences explaining why the last attempt failed. */
  errors: string[]
  onSubmit: () => void
  onClose: () => void
}

/**
 * The shell shared by the employee actions: a titled dialog with a form,
 * Cancel and confirm buttons, and the reason shown inside when an attempt
 * fails. It stays open on failure, so what was typed is not lost. While
 * saving it cannot be dismissed, so an action cannot be abandoned half-sent.
 */
export default function ActionDialog(props: Props) {
  const {
    title,
    children,
    submitLabel,
    variant = 'primary',
    submitting,
    errors,
    onSubmit,
    onClose,
  } = props

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <Modal
      show
      onHide={submitting ? undefined : onClose}
      backdrop={submitting ? 'static' : true}
      centered
    >
      <Form onSubmit={handleSubmit} noValidate>
        <Modal.Header closeButton={!submitting}>
          <Modal.Title as="h2" className="h5">
            {title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errors.length > 0 && (
            <Alert variant="danger" role="alert">
              {errors.map((message) => (
                <div key={message}>{message}</div>
              ))}
            </Alert>
          )}
          {children}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant={variant} disabled={submitting}>
            {submitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />
                Saving…
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  )
}
