import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute, ProtectedRoute } from './auth'
import { AppLayout } from './components'
import { AdminDashboardPage, AdminGroupsPage, UsersPage } from './admin'
import { LandingPage } from './LandingPage'
import { DocsPage } from './DocsPage'
import { PrivacyPage, TermsPage } from './LegalPages'
import { ProfilePage } from './ProfilePage'
import {
  DashboardPage, ForgotPasswordPage, JoinPage, LoginPage,
  NewSessionPage, RegisterPage, ResetPasswordPage, ResultsPage, SessionDetailPage,
} from './pages'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/docs" element={<DocsPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/results/:token" element={<ResultsPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/sessions" element={<DashboardPage />} />
          <Route path="/sessions/new" element={<NewSessionPage />} />
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
          <Route path="/settings" element={<ProfilePage />} />
        </Route>
      </Route>
      <Route element={<AdminRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/groups" element={<AdminGroupsPage />} />
          <Route path="/admin/users" element={<UsersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
