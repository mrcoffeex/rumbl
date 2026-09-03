import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute, ProtectedRoute } from './auth'
import { AppLayout, LoadingState } from './components'
import { LandingPage } from './LandingPage'

const AdminDashboardPage = lazy(() => import('./admin').then((mod) => ({ default: mod.AdminDashboardPage })))
const AdminGroupsPage = lazy(() => import('./admin').then((mod) => ({ default: mod.AdminGroupsPage })))
const UsersPage = lazy(() => import('./admin').then((mod) => ({ default: mod.UsersPage })))
const DocsPage = lazy(() => import('./DocsPage').then((mod) => ({ default: mod.DocsPage })))
const PrivacyPage = lazy(() => import('./LegalPages').then((mod) => ({ default: mod.PrivacyPage })))
const TermsPage = lazy(() => import('./LegalPages').then((mod) => ({ default: mod.TermsPage })))
const ProfilePage = lazy(() => import('./ProfilePage').then((mod) => ({ default: mod.ProfilePage })))
const DashboardPage = lazy(() => import('./pages').then((mod) => ({ default: mod.DashboardPage })))
const ForgotPasswordPage = lazy(() => import('./pages').then((mod) => ({ default: mod.ForgotPasswordPage })))
const JoinPage = lazy(() => import('./pages').then((mod) => ({ default: mod.JoinPage })))
const LoginPage = lazy(() => import('./pages').then((mod) => ({ default: mod.LoginPage })))
const NewSessionPage = lazy(() => import('./pages').then((mod) => ({ default: mod.NewSessionPage })))
const RegisterPage = lazy(() => import('./pages').then((mod) => ({ default: mod.RegisterPage })))
const ResetPasswordPage = lazy(() => import('./pages').then((mod) => ({ default: mod.ResetPasswordPage })))
const ResultsPage = lazy(() => import('./pages').then((mod) => ({ default: mod.ResultsPage })))
const SessionDetailPage = lazy(() => import('./pages').then((mod) => ({ default: mod.SessionDetailPage })))

function RouteFallback() {
  return <LoadingState label="Loading…" />
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  )
}
