import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <>
      <h1 className="h3">Page not found</h1>
      <p>
        There is nothing at this address. <Link to="/employees">Go to employees</Link>.
      </p>
    </>
  )
}
