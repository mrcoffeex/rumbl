import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { api, type User } from './api'

interface AuthValue {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.me()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const value: AuthValue = {
    user,
    loading,
    login: async (username, password) => {
      const result = await api.login(username, password)
      setUser(result.user)
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
