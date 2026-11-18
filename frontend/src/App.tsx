import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import EmployeeCreatePage from './pages/EmployeeCreatePage'
import EmployeeDetailPage from './pages/EmployeeDetailPage'
import EmployeeEditPage from './pages/EmployeeEditPage'
import EmployeesPage from './pages/EmployeesPage'
import ExplorerPage from './pages/ExplorerPage'
import InsightsPage from './pages/InsightsPage'
import NotFoundPage from './pages/NotFoundPage'
import QuestionsPage from './pages/QuestionsPage'

// The router itself lives in main.tsx so tests can supply a MemoryRouter.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/employees" replace />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="explorer" element={<ExplorerPage />} />
        <Route path="questions" element={<QuestionsPage />} />
        <Route path="employees/new" element={<EmployeeCreatePage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="employees/:id/edit" element={<EmployeeEditPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
