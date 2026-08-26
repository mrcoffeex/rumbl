import { LogOut, UsersRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { Group } from './api'
import { useAuth } from './auth'

export function Brand({ to = '/' }: { to?: string }) {
  return <Link className="brand" to={to} aria-label="Rumbl home">rumbl<span>.</span></Link>
}

export function PublicFooter() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-copy">
        <Brand to="/" />
        <p>Role-aware groups for classrooms and workshops.</p>
      </div>
      <nav className="landing-footer-links" aria-label="Legal">
        <Link to="/docs">Docs</Link>
        <Link to="/terms">Terms & Conditions</Link>
        <Link to="/privacy">Privacy Policy</Link>
      </nav>
    </footer>
  )
}

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const admin = user?.role === 'admin'

  async function signOut() {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <Brand to={admin ? '/admin' : '/sessions'} />
        <div className="site-header-bar">
          <nav className="nav-links" aria-label="Main navigation">
            {admin && (
              <div className="nav-cluster" aria-label="Administration">
                <span className="nav-label">Admin</span>
                <NavLink to="/admin" end>Dashboard</NavLink>
                <NavLink to="/admin/groups">All groups</NavLink>
                <NavLink to="/admin/users">Users</NavLink>
              </div>
            )}
            {admin && <span className="nav-divider" aria-hidden="true" />}
            <div className="nav-cluster" aria-label="Workspace">
              <NavLink to="/sessions">{admin ? 'My groups' : 'Groups'}</NavLink>
              <NavLink to="/settings">Settings</NavLink>
              <NavLink to="/docs">Docs</NavLink>
            </div>
          </nav>
          <div className="nav-account">
            <NavLink to="/settings" className="nav-user" title="Profile settings">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </NavLink>
            <button type="button" className="button secondary small signout-button" onClick={() => void signOut()}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="main-content"><Outlet /></main>
      <footer className="app-footer">
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </footer>
    </div>
  )
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status status-${status}`}>{status}</span>
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><UsersRound size={24} /></div>
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  )
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return <div className="page-state"><span className="spinner" />{label}</div>
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <strong>We couldn’t load this.</strong>
      <span>{message}</span>
      {retry && <button className="button secondary small" onClick={retry}>Try again</button>}
    </div>
  )
}

export function GroupsGrid({ groups }: { groups: Group[] }) {
  return (
    <div className="groups-grid">
      {groups.map((group, index) => (
        <article className="card group-card" key={group.id}>
          <div className="group-title">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <h3>{group.name || `Group ${index + 1}`}</h3>
            <strong>{group.members.length}</strong>
          </div>
          <div className="group-members">
            {group.members.map((member) => (
              <div key={member.id}>
                <div className="avatar small">{member.name.slice(0, 1).toUpperCase()}</div>
                <span>{member.name}</span>
                <em>{member.roleName}</em>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  )
}

export function ConfirmationModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cancelButton = useRef<HTMLButtonElement>(null)
  const cancelHandler = useRef(onCancel)
  cancelHandler.current = onCancel

  useEffect(() => {
    cancelButton.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelHandler.current()
    }
    document.addEventListener('keydown', closeOnEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onCancel()
    }}>
      <section className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
        <p className="eyebrow">Please confirm</p>
        <h2 id="confirmation-title">{title}</h2>
        <p id="confirmation-message">{message}</p>
        <div className="modal-actions">
          <button ref={cancelButton} className="button secondary" onClick={onCancel}>Cancel</button>
          <button className="button primary" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
