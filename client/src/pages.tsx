import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Clipboard, Download, ExternalLink, Grid3X3, List,
  LockKeyhole, Plus, RefreshCw, Search, Shuffle, Trash2, UserRound, UsersRound, XCircle,
} from 'lucide-react'
import { api, ApiError, type CreateSessionInput, type PublicResults, type PublicSession, type Registration, type Session } from './api'
import { useAuth } from './auth'
import { Brand, ConfirmationModal, EmptyState, ErrorState, GroupsGrid, LoadingState, PageHeading, StatusBadge } from './components'

export function useRemote<T>(load: () => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const request = useCallback(() => {
    setLoading(true)
    setError('')
    load().then(setData).catch((cause) => setError(cause instanceof Error ? cause.message : 'Unexpected error'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
  useEffect(request, [request])
  return { data, setData, error, loading, retry: request }
}

export function LoginPage() {
  const { login, googleLogin, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/sessions'

  useEffect(() => {
    if (user) navigate(user.role === 'admin' ? '/admin' : '/sessions', { replace: true })
  }, [navigate, user])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(email, password, rememberMe)
      navigate(destination.startsWith('/login') ? '/sessions' : destination, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand"><Brand /></div>
      <section className="auth-card" aria-labelledby="login-title">
        <div className="auth-icon"><LockKeyhole size={22} /></div>
        <p className="eyebrow">Sign in</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="page-description">Create groups as a user, or manage the platform as an admin.</p>
        <form onSubmit={submit} className="stack-form">
          {error && <div className="form-error" role="alert">{error}</div>}
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" /></label>
          <label className="check-row"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Remember me</label>
          <button className="button primary full" disabled={submitting}>{submitting ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}</button>
        </form>
        <GoogleSignIn rememberMe={rememberMe} onToken={(token) => googleLogin(token, rememberMe).then(() => navigate(destination, { replace: true })).catch((cause) => setError(cause instanceof Error ? cause.message : 'Google sign-in failed.'))} onError={setError} />
        <p className="auth-links"><Link to="/forgot-password">Forgot password?</Link><Link to="/register">Create an account</Link></p>
      </section>
    </main>
  )
}

export function RegisterPage() {
  const { register, googleLogin, user } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate('/sessions', { replace: true })
  }, [navigate, user])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await register(name, email, password, rememberMe)
      navigate('/sessions', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create an account.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand"><Brand /></div>
      <section className="auth-card" aria-labelledby="register-title">
        <p className="eyebrow">New account</p>
        <h1 id="register-title">Start grouping</h1>
        <p className="page-description">Users can create and shuffle groups. Admins get a dashboard and user management.</p>
        <form onSubmit={submit} className="stack-form">
          {error && <div className="form-error" role="alert">{error}</div>}
          <label>Name<input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Rivera" /></label>
          <label>Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" /></label>
          <label>Password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></label>
          <label className="check-row"><input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} /> Remember me</label>
          <button className="button primary full" disabled={submitting}>{submitting ? 'Creating…' : <>Create account <ArrowRight size={17} /></>}</button>
        </form>
        <GoogleSignIn rememberMe={rememberMe} onToken={(token) => googleLogin(token, rememberMe).then(() => navigate('/sessions', { replace: true })).catch((cause) => setError(cause instanceof Error ? cause.message : 'Google sign-in failed.'))} onError={setError} />
        <p className="legal-agree">By continuing you agree to the <Link className="text-link" to="/terms">Terms & Conditions</Link> and <Link className="text-link" to="/privacy">Privacy Policy</Link>.</p>
        <p className="auth-links"><Link to="/login">Already have an account?</Link></p>
      </section>
    </main>
  )
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const result = await api.forgotPassword(email)
      setMessage(result.resetUrl ? `Reset link: ${result.resetUrl}` : 'A password reset link has been sent.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to start a password reset.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand"><Brand /></div>
      <section className="auth-card">
        <p className="eyebrow">Account recovery</p>
        <h1>Forgot password</h1>
        <p className="page-description">Password reset is only available for email accounts, not Google sign-in.</p>
        <form onSubmit={submit} className="stack-form">
          {error && <div className="form-error" role="alert">{error}</div>}
          {message && <div className="form-success" role="status">{message}</div>}
          <label>Email<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.edu" /></label>
          <button className="button primary full" disabled={submitting}>{submitting ? 'Checking…' : 'Send reset link'}</button>
        </form>
        <p className="auth-links"><Link to="/login">Back to sign in</Link></p>
      </section>
    </main>
  )
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const token = new URLSearchParams(window.location.search).get('token') || ''

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.resetPassword(token, password)
      navigate('/login', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand"><Brand /></div>
      <section className="auth-card">
        <p className="eyebrow">Account recovery</p>
        <h1>Choose a new password</h1>
        <form onSubmit={submit} className="stack-form">
          {error && <div className="form-error" role="alert">{error}</div>}
          {!token && <div className="form-error" role="alert">This reset link is missing a token.</div>}
          <label>New password<input type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="button primary full" disabled={submitting || !token}>{submitting ? 'Saving…' : 'Update password'}</button>
        </form>
      </section>
    </main>
  )
}

function GoogleSignIn({ onToken }: { rememberMe?: boolean; onToken: (token: string) => void; onError: (message: string) => void }) {
  const [clientId, setClientId] = useState<string | null>(null)
  const [configState, setConfigState] = useState<'loading' | 'ready' | 'missing' | 'unreachable'>('loading')
  const [scriptFailed, setScriptFailed] = useState(false)
  const buttonRef = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    void api.authConfig()
      .then((config) => {
        if (config.googleClientId) {
          setClientId(config.googleClientId)
          setConfigState('ready')
        } else {
          setConfigState('missing')
        }
      })
      .catch(() => setConfigState('unreachable'))
  }, [])

  useEffect(() => {
    if (!clientId) return
    const scriptId = 'google-gsi-client'
    let cancelled = false
    let script = document.getElementById(scriptId) as HTMLScriptElement | null

    const prepare = () => {
      if (cancelled || !buttonRef.current || !window.google) return
      buttonRef.current.replaceChildren()
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => onTokenRef.current(response.credential),
        ux_mode: 'popup',
      })
      const width = Math.max(240, Math.min(buttonRef.current.clientWidth || 320, 400))
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        width,
        text: 'continue_with',
      })
    }

    if (!script) {
      script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      document.head.appendChild(script)
    }

    if (window.google) prepare()
    else script.addEventListener('load', prepare)

    const timeout = window.setTimeout(() => {
      if (!cancelled && !window.google) setScriptFailed(true)
    }, 8000)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      script?.removeEventListener('load', prepare)
    }
  }, [clientId])

  return (
    <div className="google-wrap">
      <div className="auth-divider">or</div>
      {configState === 'loading' && <p className="auth-note">Checking Google sign-in…</p>}
      {configState === 'missing' && (
        <p className="auth-note">Google sign-in is not configured on the server. Restart npm run dev after saving GOOGLE_CLIENT_ID in server/.env.</p>
      )}
      {configState === 'unreachable' && (
        <p className="auth-note">Cannot reach the API, so Google sign-in is unavailable. Confirm the server is running on port 4000.</p>
      )}
      {configState === 'ready' && <div ref={buttonRef} className="google-official" />}
      {configState === 'ready' && scriptFailed && (
        <p className="auth-note">Google’s sign-in script did not load. Check that accounts.google.com is reachable.</p>
      )}
    </div>
  )
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void; ux_mode?: string }) => void
          prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
        }
      }
    }
  }
}

export function DashboardPage() {
  const { data: sessions, error, loading, retry } = useRemote(api.sessions, [])
  return (
    <>
      <PageHeading eyebrow="Workspace" title="Your groups" description="Create sessions, collect registrations, and shuffle balanced groups."
        action={<Link className="button primary" to="/sessions/new"><Plus size={17} />New session</Link>} />
      {loading ? <LoadingState label="Loading sessions…" /> : error ? <ErrorState message={error} retry={retry} /> :
        !sessions?.length ? <EmptyState title="No sessions yet" body="Create a session, share its link, then shuffle everyone into groups."
          action={<Link className="button primary" to="/sessions/new"><Plus size={17} />Create session</Link>} /> :
          <div className="session-list">
            {sessions.map((session) => {
              const registered = session.registeredCount
              const expected = session.expectedCount
              const limited = expected != null
              const percent = limited ? Math.min(100, Math.round((registered / Math.max(expected, 1)) * 100)) : 0
              return (
                <Link className="session-row" to={`/sessions/${session.id}`} key={session.id}>
                  <div className="session-main"><div className="session-title-line"><h2>{session.title}</h2><StatusBadge status={session.status} /></div>
                    <p>{session.roles.length} role{session.roles.length === 1 ? '' : 's'} · Created {new Date(session.createdAt).toLocaleDateString()}</p></div>
                  <div className="session-capacity"><div><span>{registered} registered</span><span>{limited ? `${session.expectedCount} expected` : 'No limit'}</span></div>
                    <div className="progress"><span style={{ width: `${percent}%` }} /></div></div>
                  <ArrowRight className="row-arrow" size={20} />
                </Link>
              )
            })}
          </div>}
    </>
  )
}

type RoleDraft = { id: number; name: string; slotsPerGroup: number }

const ROLE_PRESETS = [
  {
    label: 'Software studio',
    hint: '1 programmer, 1 UI/UX, 1 researcher',
    roles: [
      { name: 'Programmer', slotsPerGroup: 1 },
      { name: 'UI/UX', slotsPerGroup: 1 },
      { name: 'Researcher', slotsPerGroup: 1 },
    ],
  },
  {
    label: 'Product team',
    hint: '2 builders, 1 designer, 1 researcher',
    roles: [
      { name: 'Builder', slotsPerGroup: 2 },
      { name: 'Designer', slotsPerGroup: 1 },
      { name: 'Researcher', slotsPerGroup: 1 },
    ],
  },
  {
    label: 'Discussion',
    hint: '1 facilitator, 1 scribe, 1 speaker',
    roles: [
      { name: 'Facilitator', slotsPerGroup: 1 },
      { name: 'Scribe', slotsPerGroup: 1 },
      { name: 'Speaker', slotsPerGroup: 1 },
    ],
  },
  {
    label: 'Pairs',
    hint: '2 members per group',
    roles: [{ name: 'Member', slotsPerGroup: 2 }],
  },
] as const

function suggestedGroupSizes(expectedCount: number) {
  return [2, 3, 4, 5, 6]
    .filter((size) => size < expectedCount)
    .map((size) => {
      const remainder = expectedCount % size
      return {
        size,
        groups: Math.ceil(expectedCount / size),
        remainder,
        even: remainder === 0,
      }
    })
    .sort((a, b) => Number(b.even) - Number(a.even) || a.size - b.size)
}

function fitRolesToGroupSize(roles: RoleDraft[], size: number) {
  const kept = roles.slice(0, Math.max(1, size))
  let remaining = size
  return kept.map((role, index) => {
    const reservedForOthers = kept.length - 1 - index
    const maxSlots = Math.max(1, remaining - reservedForOthers)
    const slotsPerGroup = Math.min(Math.max(1, role.slotsPerGroup), maxSlots)
    remaining -= slotsPerGroup
    return { ...role, slotsPerGroup }
  })
}

export function NewSessionPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [expectedCount, setExpectedCount] = useState(20)
  const [limitParticipants, setLimitParticipants] = useState(true)
  const [membersPerGroup, setMembersPerGroup] = useState(3)
  const [roles, setRoles] = useState<RoleDraft[]>([
    { id: 1, name: 'Programmer', slotsPerGroup: 1 },
    { id: 2, name: 'UI/UX', slotsPerGroup: 1 },
    { id: 3, name: 'Researcher', slotsPerGroup: 1 },
  ])
  const [nextId, setNextId] = useState(4)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const assignedSeats = roles.reduce((sum, role) => sum + role.slotsPerGroup, 0)
  const remainingSeats = membersPerGroup - assignedSeats
  const fullGroups = Math.floor(expectedCount / Math.max(membersPerGroup, 1))
  const leftover = expectedCount % Math.max(membersPerGroup, 1)
  const sizeOptions = limitParticipants ? suggestedGroupSizes(expectedCount) : [2, 3, 4, 5, 6].map((size) => ({ size, groups: 0, remainder: 0, even: true }))

  function applyGroupSize(size: number) {
    const nextSize = Math.max(1, Math.min(50, size))
    setMembersPerGroup(nextSize)
    setRoles((current) => fitRolesToGroupSize(current, nextSize))
  }

  function applyPreset(preset: (typeof ROLE_PRESETS)[number]) {
    const size = preset.roles.reduce((sum, role) => sum + role.slotsPerGroup, 0)
    setMembersPerGroup(size)
    setRoles(preset.roles.map((role, index) => ({ id: nextId + index, ...role })))
    setNextId((id) => id + preset.roles.length)
  }

  function addRole() {
    if (remainingSeats <= 0) return
    setRoles((current) => [...current, { id: nextId, name: '', slotsPerGroup: remainingSeats }])
    setNextId((id) => id + 1)
  }

  function updateRole(id: number, patch: Partial<RoleDraft>) {
    setRoles((current) => current.map((role) => role.id === id ? { ...role, ...patch } : role))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (roles.some((role) => !role.name.trim())) return setError('Give every role a name.')
    if (new Set(roles.map((role) => role.name.trim().toLocaleLowerCase())).size !== roles.length) {
      return setError('Role names must be unique.')
    }
    if (assignedSeats !== membersPerGroup) {
      return setError(`Role seats must add up to ${membersPerGroup} members per group.`)
    }
    if (limitParticipants && expectedCount < membersPerGroup) {
      return setError('Participant limit must cover at least one full group.')
    }
    setSubmitting(true)
    setError('')
    const input: CreateSessionInput = {
      title: title.trim(),
      expectedCount: limitParticipants ? expectedCount : null,
      roles: roles.map(({ name, slotsPerGroup }) => ({ name: name.trim(), slotsPerGroup })),
    }
    try {
      const session = await api.createSession(input)
      navigate(`/sessions/${session.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create session.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="narrow-page">
      <Link className="back-link" to="/sessions"><ArrowLeft size={16} />All sessions</Link>
      <PageHeading eyebrow="New session" title="Design your groups" description="Choose a group size, add the roles that belong in each group, then pick how many seats each role gets." />
      <form className="card form-card" onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-grid">
          <label className="wide">Session title<input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer volunteer kickoff" /></label>
        </div>
        <div className="limit-row">
          <div className="section-heading"><div><h2>Participant limit</h2><p>Cap how many people can join, or leave enrollment open.</p></div></div>
          <div className="display-toggle limit-toggle" role="group" aria-label="Participant limit">
            <button type="button" aria-pressed={limitParticipants} onClick={() => setLimitParticipants(true)}>Limit</button>
            <button type="button" aria-pressed={!limitParticipants} onClick={() => setLimitParticipants(false)}>No limit</button>
          </div>
          {limitParticipants && <label>Maximum participants<input required type="number" min="1" max="1000" value={expectedCount} onChange={(e) => setExpectedCount(Number(e.target.value) || 1)} /></label>}
        </div>
        <div className="section-divider" />
        <div className="section-heading"><div><h2>Suggested setups</h2><p>Start from a common classroom pattern, then adjust.</p></div></div>
        <div className="option-chips">
          {ROLE_PRESETS.map((preset) => {
            const selected = preset.roles.length === roles.length
              && preset.roles.every((role, index) => roles[index]?.name === role.name && roles[index]?.slotsPerGroup === role.slotsPerGroup)
            return (
            <button type="button" className={`suggestion-chip ${selected ? 'selected' : ''}`} key={preset.label} onClick={() => applyPreset(preset)}>
              <strong>{preset.label}</strong>
              <span>{preset.hint}</span>
            </button>
            )
          })}
        </div>
        <div className="section-divider" />
        <div className="section-heading"><div><h2>Members per group</h2><p>This is the maximum size of every shuffled group.</p></div></div>
        <label className="group-size-field">Group size<input required type="number" min={Math.max(1, roles.length)} max="50" value={membersPerGroup} onChange={(e) => applyGroupSize(Number(e.target.value) || 1)} /></label>
        {!!sizeOptions.length && <div className="option-chips compact">
          {sizeOptions.map((option) => (
            <button type="button" className={`suggestion-chip ${option.size === membersPerGroup ? 'selected' : ''}`} key={option.size} onClick={() => applyGroupSize(option.size)}>
              <strong>{option.size} per group</strong>
              <span>{limitParticipants ? (option.even ? `${option.groups} even groups` : `${Math.floor(expectedCount / option.size)} full · ${option.remainder} leftover`) : 'Open enrollment'}</span>
            </button>
          ))}
        </div>}
        <p className="plan-preview" aria-live="polite">
          {limitParticipants
            ? `${expectedCount} participants → ${fullGroups} group${fullGroups === 1 ? '' : 's'} of ${membersPerGroup}${leftover ? `, plus one partial group of ${leftover}` : ''}.`
            : `No participant cap. People will be shuffled into groups of ${membersPerGroup}.`}
        </p>
        <div className="section-divider" />
        <div className="section-heading"><div><h2>Roles in each group</h2><p>Assign how many members of each role sit in a group. Seats used: {assignedSeats} of {membersPerGroup}{remainingSeats > 0 ? ` · ${remainingSeats} open` : remainingSeats < 0 ? ` · ${Math.abs(remainingSeats)} over the group size` : ''}.</p></div>
          <button type="button" className="button secondary small" disabled={remainingSeats <= 0} onClick={addRole}><Plus size={16} />Add role</button></div>
        <div className="roles-editor">
          {roles.map((role, index) => (
            <div className="role-row" key={role.id}>
              <span className="row-number">{index + 1}</span>
              <label>Role name<input required value={role.name} onChange={(e) => updateRole(role.id, { name: e.target.value })} placeholder="e.g. Designer" /></label>
              <label>Members per role<input required type="number" min="1" max={membersPerGroup} value={role.slotsPerGroup} onChange={(e) => updateRole(role.id, { slotsPerGroup: Math.max(1, Number(e.target.value) || 1) })} /></label>
              <button type="button" className="icon-button danger" disabled={roles.length === 1} onClick={() => setRoles((current) => current.filter((item) => item.id !== role.id))} aria-label={`Remove role ${index + 1}`}><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
        <div className="form-actions"><Link className="button secondary" to="/sessions">Cancel</Link>
          <button className="button primary" disabled={submitting}>{submitting ? 'Creating…' : <>Create session <ArrowRight size={17} /></>}</button></div>
      </form>
    </div>
  )
}

export function SessionDetailPage() {
  const { id = '' } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { data: session, setData: setSession, error, loading, retry } = useRemote(() => api.session(id), [id])
  const [action, setAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState<'join' | 'results' | ''>('')
  const [participantQuery, setParticipantQuery] = useState('')
  const [participantView, setParticipantView] = useState<'list' | 'cards'>('list')
  const [visibleParticipants, setVisibleParticipants] = useState(30)
  const [shuffleConfirmation, setShuffleConfirmation] = useState(false)
  const [participantToRemove, setParticipantToRemove] = useState<Registration | null>(null)
  const qrRef = useRef<HTMLDivElement>(null)
  const actionInProgress = useRef(false)
  const refreshGeneration = useRef(0)

  useEffect(() => {
    let active = true
    let refreshing = false
    const refresh = async () => {
      if (refreshing || actionInProgress.current || document.visibilityState === 'hidden') return
      refreshing = true
      const generation = refreshGeneration.current
      try {
        const latest = await api.session(id)
        if (active && generation === refreshGeneration.current && !actionInProgress.current) {
          setSession(latest)
        }
      } catch {
        // Keep the last successful snapshot during transient refresh failures.
      } finally {
        refreshing = false
      }
    }
    const interval = window.setInterval(() => void refresh(), 2000)
    const refreshOnFocus = () => void refresh()
    window.addEventListener('focus', refreshOnFocus)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('focus', refreshOnFocus)
    }
  }, [id, setSession])

  const joinUrl = session ? `${window.location.origin}/join/${session.token}` : ''
  const resultsUrl = session ? `${window.location.origin}/results/${session.token}` : ''
  const registered = session?.registrations?.length || 0
  const expected = session?.expectedCount
  const limited = expected != null
  const percent = limited ? Math.min(100, Math.round((registered / Math.max(expected, 1)) * 100)) : 0
  const filteredRegistrations = useMemo(() => {
    const query = participantQuery.trim().toLocaleLowerCase()
    if (!query) return session?.registrations || []
    return (session?.registrations || []).filter((person) => {
      const roleName = person.roleName || session?.roles.find((role) => role.id === person.roleId)?.name || ''
      return person.name.toLocaleLowerCase().includes(query) || roleName.toLocaleLowerCase().includes(query)
    })
  }, [participantQuery, session])
  const displayedRegistrations = filteredRegistrations.slice(0, visibleParticipants)

  useEffect(() => setVisibleParticipants(30), [participantQuery])

  async function runAction(name: string, operation: () => Promise<Session>) {
    actionInProgress.current = true
    refreshGeneration.current += 1
    setAction(name)
    setActionError('')
    try { setSession(await operation()) } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Action failed.')
    } finally {
      actionInProgress.current = false
      refreshGeneration.current += 1
      setAction('')
    }
  }

  async function copyLink(url: string, kind: 'join' | 'results') {
    await navigator.clipboard.writeText(url)
    setCopied(kind)
    window.setTimeout(() => setCopied(''), 1800)
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas || !session) return
    const link = document.createElement('a')
    link.download = `${session.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-qr.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function confirmShuffle() {
    setShuffleConfirmation(true)
  }

  function executeShuffle() {
    setShuffleConfirmation(false)
    void runAction('shuffle', () => api.shuffle(id))
  }

  function executeRemove() {
    if (!participantToRemove) return
    const studentId = participantToRemove.id
    setParticipantToRemove(null)
    void runAction('remove', () => api.removeParticipant(id, studentId))
  }

  if (loading || authLoading) return <LoadingState label="Loading session…" />
  if (error || !session) return <ErrorState message={error || 'Session not found.'} retry={retry} />

  const canManage = user?.id === session.ownerId

  return (
    <>
      {shuffleConfirmation && <ConfirmationModal
        title={session.groups.length ? 'Reshuffle participants?' : 'Shuffle participants?'}
        message={session.groups.length ? 'This will permanently replace the current group assignments with a new random arrangement.' : 'All registered participants will be assigned to groups using the configured role limits.'}
        confirmLabel={session.groups.length ? 'Reshuffle' : 'Shuffle groups'}
        onCancel={() => setShuffleConfirmation(false)}
        onConfirm={executeShuffle}
      />}
      {participantToRemove && <ConfirmationModal
        title={`Remove ${participantToRemove.name}?`}
        message={session.groups.length ? `${participantToRemove.name} will be removed from this session and any assigned group. You may need to reshuffle afterward.` : `${participantToRemove.name} will be removed from this session. They can join again later if enrollment is open.`}
        confirmLabel={action === 'remove' ? 'Removing…' : 'Remove'}
        onCancel={() => setParticipantToRemove(null)}
        onConfirm={executeRemove}
      />}
      <Link className="back-link" to="/sessions"><ArrowLeft size={16} />All sessions</Link>
      <PageHeading eyebrow="Session" title={session.title} description={`Created ${new Date(session.createdAt).toLocaleDateString()}`}
        action={<div className="heading-buttons"><StatusBadge status={session.status} />
          {canManage && (session.status === 'open' ? <button className="button secondary" disabled={!!action} onClick={() => void runAction('close', () => api.setSessionStatus(id, 'closed'))}><XCircle size={17} />{action === 'close' ? 'Closing…' : 'Close enrollment'}</button> :
            <button className="button secondary" disabled={!!action} onClick={() => void runAction('open', () => api.setSessionStatus(id, 'open'))}><CheckCircle2 size={17} />{action === 'open' ? 'Opening…' : 'Open enrollment'}</button>)}
          {canManage && <button className="button primary" disabled={!registered || !!action || !['closed', 'grouped'].includes(session.status)} title={session.status === 'open' ? 'Close enrollment before shuffling' : !registered ? 'At least one participant is required' : undefined} onClick={confirmShuffle}>
            {action === 'shuffle' ? <RefreshCw className="spin" size={17} /> : <Shuffle size={17} />}{action === 'shuffle' ? 'Shuffling…' : session.groups?.length ? 'Reshuffle' : 'Shuffle groups'}
          </button>}
        </div>} />
      {actionError && <div className="form-error" role="alert">{actionError}</div>}
      <div className="detail-grid">
        <section className="card share-card">
          <div><p className="eyebrow">Enrollment link</p><h2>Invite participants</h2><p>Share this link or QR code. Participants can join from any phone.</p>
            <div className="copy-field"><span>{joinUrl}</span><button onClick={() => void copyLink(joinUrl, 'join')} aria-label="Copy enrollment link">{copied === 'join' ? <Check size={17} /> : <Clipboard size={17} />}{copied === 'join' ? 'Copied' : 'Copy'}</button></div>
          </div>
          <div className="qr-wrap" ref={qrRef}><QRCodeCanvas value={joinUrl} size={116} bgColor="#ffffff" fgColor="#26251e" marginSize={1} />
            <button className="text-button" onClick={downloadQr}><Download size={15} />Download QR</button></div>
        </section>
        <section className="card capacity-card" aria-live="polite">
          <div className="section-heading"><div><p className="eyebrow">{limited ? 'Capacity' : 'Registered'}</p><h2>{limited ? `${registered} of ${expected}` : `${registered} joined`}</h2></div><span className="large-percent">{limited ? `${percent}%` : 'No limit'}</span></div>
          <div className="progress large"><span style={{ width: `${percent}%` }} /></div>
          <div className="role-stats">{session.roles.map((role) => <div key={role.id}><span>{role.name}</span><strong>{role.capacity == null ? `${role.enrolled || 0}` : `${role.enrolled || 0}/${role.capacity}`}</strong></div>)}</div>
        </section>
      </div>
      <section className="section-block" aria-live="polite">
        <div className="section-heading participant-heading">
          <div><p className="eyebrow">Registration roster</p><h2>Participants <span className="muted-count">{registered}</span></h2></div>
          {!!registered && <div className="participant-tools">
            <label className="participant-search"><Search size={16} /><input aria-label="Search participants" value={participantQuery} onChange={(event) => setParticipantQuery(event.target.value)} placeholder="Search name or role" /></label>
            <div className="display-toggle" aria-label="Participant display">
              <button type="button" aria-label="List view" aria-pressed={participantView === 'list'} onClick={() => setParticipantView('list')}><List size={17} /></button>
              <button type="button" aria-label="Card view" aria-pressed={participantView === 'cards'} onClick={() => setParticipantView('cards')}><Grid3X3 size={17} /></button>
            </div>
          </div>}
        </div>
        {!registered ? <EmptyState title="Nobody has joined yet" body="Open enrollment and share the link to start collecting participants." /> :
          !filteredRegistrations.length ? <div className="card participant-no-results">No participants match “{participantQuery}”.</div> :
            <>
              <div className={participantView === 'cards' ? 'participant-grid' : 'card roster'}>{displayedRegistrations.map((person) => {
                const roleName = person.roleName || session.roles.find((role) => role.id === person.roleId)?.name || 'Unassigned'
                const time = new Date(person.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                const removeButton = canManage ? (
                  <button type="button" className="icon-button danger" disabled={!!action} onClick={() => setParticipantToRemove(person)} aria-label={`Remove ${person.name}`}>
                    <Trash2 size={16} />
                  </button>
                ) : null
                return participantView === 'cards'
                  ? <article className="card participant-card" key={person.id}><div className="avatar">{person.name.slice(0, 1).toUpperCase()}</div><div><strong>{person.name}</strong><span>{roleName}</span></div>{removeButton}<time>{time}</time></article>
                  : <div className="roster-row" key={person.id}><div className="avatar">{person.name.slice(0, 1).toUpperCase()}</div><div><strong>{person.name}</strong><span>{roleName}</span></div><time>{time}</time>{removeButton}</div>
              })}</div>
              {displayedRegistrations.length < filteredRegistrations.length && <div className="show-more-wrap"><button className="button secondary" onClick={() => setVisibleParticipants((count) => count + 30)}>Show more ({filteredRegistrations.length - displayedRegistrations.length} remaining)</button></div>}
            </>}
      </section>
      <section className="section-block">
        <div className="section-heading groups-heading"><div><p className="eyebrow">Group results</p><h2>{session.groups?.length ? `${session.groups.length} groups` : 'Ready to shuffle?'}</h2>
          <p>{session.groups?.length ? 'Share the public link so anyone can see these groups.' : 'Rumbl distributes roles as evenly as possible.'}</p></div>
          {!!session.groups?.length && <div className="results-share">
            <div className="copy-field"><span>{resultsUrl}</span>
              <button onClick={() => void copyLink(resultsUrl, 'results')} aria-label="Copy public results link">{copied === 'results' ? <Check size={17} /> : <Clipboard size={17} />}{copied === 'results' ? 'Copied' : 'Copy'}</button></div>
            <a className="button secondary small" href={resultsUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Preview</a>
          </div>}</div>
        {!!session.groups?.length && <GroupsGrid groups={session.groups} />}
      </section>
    </>
  )
}

type JoinView = 'form' | 'success'

export function JoinPage() {
  const { token = '' } = useParams()
  const { data: session, setData: setSession, error, loading, retry } = useRemote<PublicSession>(() => api.publicSession(token), [token])
  const [name, setName] = useState('')
  const [roleId, setRoleId] = useState('')
  const [view, setView] = useState<JoinView>('form')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const availableRoles = useMemo(() => session?.roles.filter((role) => role.capacity == null || role.enrolled < role.capacity) || [], [session])

  useEffect(() => {
    let active = true
    let refreshing = false
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return
      refreshing = true
      try {
        const latest = await api.publicSession(token)
        if (active) setSession(latest)
      } catch {
        // Keep the invitation usable during transient refresh failures.
      } finally {
        refreshing = false
      }
    }
    const interval = window.setInterval(() => void refresh(), 2000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [token, setSession])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(() => setCooldown((seconds) => Math.max(0, seconds - 1)), 1000)
    return () => window.clearInterval(timer)
  }, [cooldown > 0])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    try {
      await api.enroll(token, name.trim(), roleId)
      setView('success')
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) retry()
      if (cause instanceof ApiError && cause.status === 429) {
        setCooldown(cause.retryAfterSeconds || 60)
      }
      setSubmitError(cause instanceof Error ? cause.message : 'Unable to join.')
    } finally { setSubmitting(false) }
  }

  if (loading) return <main className="join-page"><Brand /><LoadingState label="Loading session…" /></main>
  if (error || !session) return <main className="join-page"><Brand /><ErrorState message={error || 'This invitation is not available.'} retry={retry} /></main>
  if (view === 'success') return <main className="join-page"><Brand /><section className="join-card success-card"><div className="success-mark"><Check size={30} /></div><p className="eyebrow">You’re in</p><h1>Thanks, {name}.</h1><p>You’ve registered for <strong>{session.title}</strong>. Your organizer will share your group soon.</p></section></main>

  const isClosed = session.status !== 'open'
  const isFull = (session.expectedCount != null && session.enrolledCount >= session.expectedCount) || !availableRoles.length
  const isGrouped = session.status === 'grouped'
  if (isClosed || isFull) return <main className="join-page"><Brand /><section className="join-card message-card">
    <div className="auth-icon">{isFull || isGrouped ? <UsersRound size={23} /> : <LockKeyhole size={23} />}</div>
    <p className="eyebrow">{isGrouped ? 'Groups are ready' : isFull ? 'Session full' : 'Enrollment closed'}</p><h1>{session.title}</h1>
    <p>{isGrouped ? 'Enrollment is closed and groups have been assigned.' : isFull ? 'All available spots have been filled. Check with your organizer in case more are added.' : 'This session is not accepting registrations right now.'}</p>
    {isGrouped && <Link className="button primary" to={`/results/${token}`}>View group results <ArrowRight size={17} /></Link>}
  </section></main>

  return (
    <main className="join-page">
      <Brand />
      <section className="join-card">
        <p className="eyebrow">You’re invited</p><h1>{session.title}</h1>
        <p className="page-description">Tell us who you are and choose the role that fits you best.</p>
        <div className="join-count"><UserRound size={17} /><strong>{session.enrolledCount}</strong> joined{session.expectedCount != null ? ` · ${Math.max(0, session.expectedCount - session.enrolledCount)} spots left` : ' · no limit'}</div>
        <form className="stack-form" onSubmit={submit}>
          {submitError && <div className="form-error" role="alert">{submitError}</div>}
          <label>Your name<input autoFocus required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" /></label>
          <fieldset><legend>Choose your role</legend><div className="role-options">
            {session.roles.map((role) => {
              const full = role.capacity != null && role.enrolled >= role.capacity
              return <label className={`role-option ${full ? 'disabled' : ''}`} key={role.id}>
                <input type="radio" name="role" value={role.id} required disabled={full} checked={roleId === role.id} onChange={() => setRoleId(role.id)} />
                <span className="radio-mark" /><span><strong>{role.name}</strong><small>{full ? 'Full' : role.capacity == null ? 'Open' : `${role.capacity - role.enrolled} of ${role.capacity} available`}</small></span>
              </label>
            })}
          </div></fieldset>
          <button className="button primary full" disabled={submitting || !roleId || cooldown > 0}>
            {submitting ? 'Joining…' : cooldown > 0 ? `Try again in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}` : <>Join session <ArrowRight size={17} /></>}
          </button>
        </form>
        <p className="legal-agree">By joining you agree to the <Link className="text-link" to="/privacy">Privacy Policy</Link>.</p>
      </section>
    </main>
  )
}

export function ResultsPage() {
  const { token = '' } = useParams()
  const { data, setData, error, loading, retry } = useRemote<PublicResults>(() => api.publicResults(token), [token])

  useEffect(() => {
    let active = true
    let refreshing = false
    const refresh = async () => {
      if (refreshing || document.visibilityState === 'hidden') return
      refreshing = true
      try {
        const latest = await api.publicResults(token)
        if (active) setData(latest)
      } catch {
        // Keep the last successful snapshot during transient refresh failures.
      } finally {
        refreshing = false
      }
    }
    const interval = window.setInterval(() => void refresh(), 2000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [token, setData])

  if (loading) return <main className="results-page"><Brand /><LoadingState label="Loading group results…" /></main>
  if (error || !data) return <main className="results-page"><Brand /><ErrorState message={error || 'These results are not available.'} retry={retry} /></main>

  const grouped = data.status === 'grouped' && data.groups.length > 0
  if (!grouped) {
    return (
      <main className="results-page">
        <Brand />
        <section className="join-card message-card">
          <div className="auth-icon"><UsersRound size={23} /></div>
          <p className="eyebrow">Waiting on groups</p>
          <h1>{data.title}</h1>
          <p>Groups haven’t been shuffled yet. This page updates automatically once your organizer is ready.</p>
        </section>
      </main>
    )
  }

  return (
    <main className="results-page">
      <Brand />
      <div className="results-shell">
        <p className="eyebrow">Group results</p>
        <h1>{data.title}</h1>
        <p className="page-description">{data.groups.length} group{data.groups.length === 1 ? '' : 's'} assigned for this session.</p>
        <GroupsGrid groups={data.groups} />
      </div>
    </main>
  )
}
