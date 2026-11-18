import type { ReactNode } from 'react'
import { Card } from 'react-bootstrap'
import { Link } from 'react-router-dom'

interface Props {
  title: string
  children: ReactNode
  /** A link to the fuller answer elsewhere. */
  more?: { to: string; label: string }
}

/** A titled block of the dashboard, with an optional way through to the full answer. */
export default function Section({ title, children, more }: Props) {
  const headingId = `section-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <Card as="section" aria-labelledby={headingId} className="h-100">
      <Card.Body>
        <Card.Title as="h2" className="h5 mb-3" id={headingId}>
          {title}
        </Card.Title>
        {children}
        {more && (
          <p className="mt-3 mb-0 small">
            <Link to={more.to}>{more.label}</Link>
          </p>
        )}
      </Card.Body>
    </Card>
  )
}
