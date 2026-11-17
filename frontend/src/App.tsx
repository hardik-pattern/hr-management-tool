import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import EmployeesPage from './pages/EmployeesPage'
import NotFoundPage from './pages/NotFoundPage'

// The router itself lives in main.tsx so tests can supply a MemoryRouter.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/employees" replace />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
