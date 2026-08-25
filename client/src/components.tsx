import { LogOut, UsersRound } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from './auth'

export function Brand() {
  return <Link className="brand" to="/admin" aria-label="Rumbl home">rumbl<span>.</span></Link>
}

export function AdminLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="app-shell">
      <header className="site-header">
        <Brand />
        <nav aria-label="Main navigation">
          <NavLink to="/admin" end>Sessions</NavLink>
          <button className="nav-button" onClick={() => void logout()} title={`Sign out ${user?.username}`}>
            <LogOut size={17} /> <span>Sign out</span>
          </button>
        </nav>
      </header>
      <main className="main-content"><Outlet /></main>
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
