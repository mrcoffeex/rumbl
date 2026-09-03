import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { api, type ProfileUpdate, type User } from './api'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  register: (name: string, email: string, password: string, rememberMe?: boolean) => Promise<void>
  googleLogin: (idToken: string, rememberMe?: boolean) => Promise<void>
  updateProfile: (input: ProfileUpdate) => Promise<User>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

function isPublicPath(pathname: string) {
  if (
    pathname === '/'
    || pathname === '/docs'
    || pathname === '/terms'
    || pathname === '/privacy'
    || pathname === '/login'
    || pathname === '/register'
    || pathname === '/forgot-password'
    || pathname === '/reset-password'
  ) return true
  return pathname.startsWith('/join/') || pathname.startsWith('/results/')
}

function shouldFetchSession(pathname: string) {
  if (pathname.startsWith('/join/') || pathname.startsWith('/results/')) return false
  if (pathname === '/terms' || pathname === '/privacy') return false
  if (pathname === '/forgot-password' || pathname === '/reset-password') return false
  return true
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [user, setUser] = useState<User | null>(null)
  const [resolved, setResolved] = useState(false)
  const inFlight = useRef(false)
  const publicRoute = isPublicPath(pathname)
  const loading = !resolved && !publicRoute

  useEffect(() => {
    if (resolved || inFlight.current || !shouldFetchSession(pathname)) return
    inFlight.current = true
    api.me()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => {
        inFlight.current = false
        setResolved(true)
      })
  }, [pathname, resolved])

  const value: AuthValue = {
    user,
    loading,
    login: async (email, password, rememberMe) => {
      const result = await api.login(email, password, rememberMe)
      setUser(result.user)
      setResolved(true)
    },
    register: async (name, email, password, rememberMe) => {
      const result = await api.register(name, email, password, rememberMe)
      setUser(result.user)
      setResolved(true)
    },
    googleLogin: async (idToken, rememberMe) => {
      const result = await api.googleLogin(idToken, rememberMe)
      setUser(result.user)
      setResolved(true)
    },
    updateProfile: async (input) => {
      const result = await api.updateProfile(input)
      setUser(result.user)
      return result.user
    },
    logout: async () => {
      await api.logout().finally(() => setUser(null))
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// oxlint-disable-next-line react/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="page-state"><span className="spinner" />Checking your session…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

export function AdminRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="page-state"><span className="spinner" />Checking your session…</div>
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  if (user.role !== 'admin') return <Navigate to="/sessions" replace />
  return <Outlet />
}
