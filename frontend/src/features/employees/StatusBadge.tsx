import { Badge } from 'react-bootstrap'
import type { EmployeeStatus } from '../../api/types'

const LABELS: Record<EmployeeStatus, { text: string; bg: string }> = {
  active: { text: 'Active', bg: 'success' },
  terminated: { text: 'Terminated', bg: 'secondary' },
}

export default function StatusBadge({ status }: { status: EmployeeStatus }) {
  const { text, bg } = LABELS[status]
  return <Badge bg={bg}>{text}</Badge>
}
