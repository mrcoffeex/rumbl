import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './auth'
import { AdminLayout } from './components'
import { DashboardPage, JoinPage, LoginPage, NewSessionPage, SessionDetailPage } from './pages'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/sessions/new" element={<NewSessionPage />} />
          <Route path="/admin/sessions/:id" element={<SessionDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  )
}
