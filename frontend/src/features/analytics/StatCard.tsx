import { Card } from 'react-bootstrap'

interface Props {
  label: string
  value: string
  hint?: string
}

/** One headline figure: what it is, the number, and a line of context. */
export default function StatCard({ label, value, hint }: Props) {
  return (
    <Card className="h-100">
      <Card.Body>
        <Card.Text className="text-body-secondary mb-1">{label}</Card.Text>
        <p className="h3 mb-1">{value}</p>
        {hint && <p className="small text-body-secondary mb-0">{hint}</p>}
      </Card.Body>
    </Card>
  )
}
