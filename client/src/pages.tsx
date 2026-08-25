import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Clipboard, Download, Grid3X3, List,
  LockKeyhole, Plus, RefreshCw, Search, Shuffle, Trash2, UserRound, UsersRound, XCircle,
} from 'lucide-react'
import { api, ApiError, type CreateSessionInput, type PublicSession, type Session } from './api'
import { useAuth } from './auth'
import { Brand, ConfirmationModal, EmptyState, ErrorState, LoadingState, PageHeading, StatusBadge } from './components'

function useRemote<T>(load: () => Promise<T>, dependencies: unknown[]) {
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
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user) navigate('/admin', { replace: true })
  }, [navigate, user])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(username, password)
      const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/admin'
      navigate(destination, { replace: true })
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
        <p className="eyebrow">Admin access</p>
        <h1 id="login-title">Welcome back</h1>
        <p className="page-description">Sign in to create sessions and make balanced groups.</p>
        <form onSubmit={submit} className="stack-form">
          {error && <div className="form-error" role="alert">{error}</div>}
          <label>Username<input autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" /></label>
          <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" /></label>
          <button className="button primary full" disabled={submitting}>{submitting ? 'Signing in…' : <>Sign in <ArrowRight size={17} /></>}</button>
        </form>
      </section>
    </main>
  )
}

export function DashboardPage() {
  const { data: sessions, error, loading, retry } = useRemote(api.sessions, [])
  return (
    <>
      <PageHeading eyebrow="Admin" title="Your sessions" description="Collect registrations and turn them into balanced groups."
        action={<Link className="button primary" to="/admin/sessions/new"><Plus size={17} />New session</Link>} />
      {loading ? <LoadingState label="Loading sessions…" /> : error ? <ErrorState message={error} retry={retry} /> :
        !sessions?.length ? <EmptyState title="No sessions yet" body="Create a session, share its link, then shuffle everyone into groups."
          action={<Link className="button primary" to="/admin/sessions/new"><Plus size={17} />Create session</Link>} /> :
          <div className="session-list">
            {sessions.map((session) => {
              const registered = session.registeredCount
              const percent = Math.min(100, Math.round((registered / Math.max(session.expectedCount, 1)) * 100))
              return (
                <Link className="session-row" to={`/admin/sessions/${session.id}`} key={session.id}>
                  <div className="session-main"><div className="session-title-line"><h2>{session.title}</h2><StatusBadge status={session.status} /></div>
                    <p>{session.roles.length} role{session.roles.length === 1 ? '' : 's'} · Created {new Date(session.createdAt).toLocaleDateString()}</p></div>
                  <div className="session-capacity"><div><span>{registered} registered</span><span>{session.expectedCount} expected</span></div>
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

export function NewSessionPage() {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [expectedCount, setExpectedCount] = useState(20)
  const [roles, setRoles] = useState<RoleDraft[]>([{ id: 1, name: '', slotsPerGroup: 1 }])
  const [nextId, setNextId] = useState(2)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function addRole() {
    setRoles((current) => [...current, { id: nextId, name: '', slotsPerGroup: 1 }])
    setNextId((id) => id + 1)
  }

  function updateRole(id: number, patch: Partial<RoleDraft>) {
    setRoles((current) => current.map((role) => role.id === id ? { ...role, ...patch } : role))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (roles.some((role) => !role.name.trim())) return setError('Give every role a name.')
    setSubmitting(true)
    setError('')
    const input: CreateSessionInput = {
      title: title.trim(),
      expectedCount,
      roles: roles.map(({ name, slotsPerGroup }) => ({ name: name.trim(), slotsPerGroup })),
    }
    try {
      const session = await api.createSession(input)
      navigate(`/admin/sessions/${session.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create session.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="narrow-page">
      <Link className="back-link" to="/admin"><ArrowLeft size={16} />All sessions</Link>
      <PageHeading eyebrow="New session" title="Design your groups" description="Define who you expect. Rumbl will spread each role evenly when you shuffle." />
      <form className="card form-card" onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-grid">
          <label className="wide">Session title<input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer volunteer kickoff" /></label>
          <label>Expected participants<input required type="number" min="1" max="1000" value={expectedCount} onChange={(e) => setExpectedCount(Number(e.target.value))} /></label>
        </div>
        <div className="section-divider" />
        <div className="section-heading"><div><h2>Roles</h2><p>Set the ideal number of each role per group.</p></div>
          <button type="button" className="button secondary small" onClick={addRole}><Plus size={16} />Add role</button></div>
        <div className="roles-editor">
          {roles.map((role, index) => (
            <div className="role-row" key={role.id}>
              <span className="row-number">{index + 1}</span>
              <label>Role name<input required value={role.name} onChange={(e) => updateRole(role.id, { name: e.target.value })} placeholder="e.g. Designer" /></label>
              <label>Slots per group<input required type="number" min="1" max="50" value={role.slotsPerGroup} onChange={(e) => updateRole(role.id, { slotsPerGroup: Number(e.target.value) })} /></label>
              <button type="button" className="icon-button danger" disabled={roles.length === 1} onClick={() => setRoles((current) => current.filter((item) => item.id !== role.id))} aria-label={`Remove role ${index + 1}`}><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
        <div className="form-actions"><Link className="button secondary" to="/admin">Cancel</Link>
          <button className="button primary" disabled={submitting}>{submitting ? 'Creating…' : <>Create session <ArrowRight size={17} /></>}</button></div>
      </form>
    </div>
  )
}

export function SessionDetailPage() {
  const { id = '' } = useParams()
  const { data: session, setData: setSession, error, loading, retry } = useRemote(() => api.session(id), [id])
  const [action, setAction] = useState('')
  const [actionError, setActionError] = useState('')
  const [copied, setCopied] = useState(false)
  const [participantQuery, setParticipantQuery] = useState('')
  const [participantView, setParticipantView] = useState<'list' | 'cards'>('list')
  const [visibleParticipants, setVisibleParticipants] = useState(30)
  const [shuffleConfirmation, setShuffleConfirmation] = useState(false)
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
  const registered = session?.registrations?.length || 0
  const capacity = session?.roles?.reduce((sum, role) => sum + (role.capacity || 0), 0) || session?.expectedCount || 0
  const percent = Math.min(100, Math.round((registered / Math.max(capacity, 1)) * 100))
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

  async function copyLink() {
    await navigator.clipboard.writeText(joinUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
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

  if (loading) return <LoadingState label="Loading session…" />
  if (error || !session) return <ErrorState message={error || 'Session not found.'} retry={retry} />

  return (
    <>
      {shuffleConfirmation && <ConfirmationModal
        title={session.groups.length ? 'Reshuffle participants?' : 'Shuffle participants?'}
        message={session.groups.length ? 'This will permanently replace the current group assignments with a new random arrangement.' : 'All registered participants will be assigned to groups using the configured role limits.'}
        confirmLabel={session.groups.length ? 'Reshuffle' : 'Shuffle groups'}
        onCancel={() => setShuffleConfirmation(false)}
        onConfirm={executeShuffle}
      />}
      <Link className="back-link" to="/admin"><ArrowLeft size={16} />All sessions</Link>
      <PageHeading eyebrow="Session" title={session.title} description={`Created ${new Date(session.createdAt).toLocaleDateString()}`}
        action={<div className="heading-buttons"><StatusBadge status={session.status} />
          {session.status === 'open' ? <button className="button secondary" disabled={!!action} onClick={() => void runAction('close', () => api.setSessionStatus(id, 'closed'))}><XCircle size={17} />{action === 'close' ? 'Closing…' : 'Close enrollment'}</button> :
            <button className="button secondary" disabled={!!action} onClick={() => void runAction('open', () => api.setSessionStatus(id, 'open'))}><CheckCircle2 size={17} />{action === 'open' ? 'Opening…' : 'Open enrollment'}</button>}
          <button className="button primary" disabled={!registered || !!action || !['closed', 'grouped'].includes(session.status)} title={session.status === 'open' ? 'Close enrollment before shuffling' : !registered ? 'At least one participant is required' : undefined} onClick={confirmShuffle}>
            {action === 'shuffle' ? <RefreshCw className="spin" size={17} /> : <Shuffle size={17} />}{action === 'shuffle' ? 'Shuffling…' : session.groups?.length ? 'Reshuffle' : 'Shuffle groups'}
          </button>
        </div>} />
      {actionError && <div className="form-error" role="alert">{actionError}</div>}
      <div className="detail-grid">
        <section className="card share-card">
          <div><p className="eyebrow">Enrollment link</p><h2>Invite participants</h2><p>Share this link or QR code. Participants can join from any phone.</p>
            <div className="copy-field"><span>{joinUrl}</span><button onClick={() => void copyLink()} aria-label="Copy enrollment link">{copied ? <Check size={17} /> : <Clipboard size={17} />}{copied ? 'Copied' : 'Copy'}</button></div>
          </div>
          <div className="qr-wrap" ref={qrRef}><QRCodeCanvas value={joinUrl} size={116} bgColor="#ffffff" fgColor="#26251e" marginSize={1} />
            <button className="text-button" onClick={downloadQr}><Download size={15} />Download QR</button></div>
        </section>
        <section className="card capacity-card" aria-live="polite">
          <div className="section-heading"><div><p className="eyebrow">Capacity</p><h2>{registered} of {capacity}</h2></div><span className="large-percent">{percent}%</span></div>
          <div className="progress large"><span style={{ width: `${percent}%` }} /></div>
          <div className="role-stats">{session.roles.map((role) => <div key={role.id}><span>{role.name}</span><strong>{role.enrolled || 0}/{role.capacity || '—'}</strong></div>)}</div>
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
                return participantView === 'cards'
                  ? <article className="card participant-card" key={person.id}><div className="avatar">{person.name.slice(0, 1).toUpperCase()}</div><div><strong>{person.name}</strong><span>{roleName}</span></div><time>{time}</time></article>
                  : <div className="roster-row" key={person.id}><div className="avatar">{person.name.slice(0, 1).toUpperCase()}</div><div><strong>{person.name}</strong><span>{roleName}</span></div><time>{time}</time></div>
              })}</div>
              {displayedRegistrations.length < filteredRegistrations.length && <div className="show-more-wrap"><button className="button secondary" onClick={() => setVisibleParticipants((count) => count + 30)}>Show more ({filteredRegistrations.length - displayedRegistrations.length} remaining)</button></div>}
            </>}
      </section>
      <section className="section-block">
        <div className="section-heading groups-heading"><div><p className="eyebrow">Group results</p><h2>{session.groups?.length ? `${session.groups.length} groups` : 'Ready to shuffle?'}</h2>
          <p>{session.groups?.length ? 'Use the shuffle button above whenever you need a fresh mix.' : 'Rumbl distributes roles as evenly as possible.'}</p></div></div>
        {!!session.groups?.length && <div className="groups-grid">{session.groups.map((group, index) =>
          <article className="card group-card" key={group.id}><div className="group-title"><span>{String(index + 1).padStart(2, '0')}</span><h3>{group.name || `Group ${index + 1}`}</h3><strong>{group.members.length}</strong></div>
            <div className="group-members">{group.members.map((member) => <div key={member.id}><div className="avatar small">{member.name.slice(0, 1).toUpperCase()}</div><span>{member.name}</span><em>{member.roleName}</em></div>)}</div>
          </article>)}</div>}
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
  const availableRoles = useMemo(() => session?.roles.filter((role) => role.enrolled < role.capacity) || [], [session])

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
  const isFull = session.enrolledCount >= session.expectedCount || !availableRoles.length
  if (isClosed || isFull) return <main className="join-page"><Brand /><section className="join-card message-card">
    <div className="auth-icon">{isFull ? <UsersRound size={23} /> : <LockKeyhole size={23} />}</div>
    <p className="eyebrow">{isFull ? 'Session full' : 'Enrollment closed'}</p><h1>{session.title}</h1>
    <p>{isFull ? 'All available spots have been filled. Check with your organizer in case more are added.' : 'This session is not accepting registrations right now.'}</p>
  </section></main>

  return (
    <main className="join-page">
      <Brand />
      <section className="join-card">
        <p className="eyebrow">You’re invited</p><h1>{session.title}</h1>
        <p className="page-description">Tell us who you are and choose the role that fits you best.</p>
        <div className="join-count"><UserRound size={17} /><strong>{session.enrolledCount}</strong> joined · {session.expectedCount - session.enrolledCount} spots left</div>
        <form className="stack-form" onSubmit={submit}>
          {submitError && <div className="form-error" role="alert">{submitError}</div>}
          <label>Your name<input autoFocus required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" /></label>
          <fieldset><legend>Choose your role</legend><div className="role-options">
            {session.roles.map((role) => {
              const full = role.enrolled >= role.capacity
              return <label className={`role-option ${full ? 'disabled' : ''}`} key={role.id}>
                <input type="radio" name="role" value={role.id} required disabled={full} checked={roleId === role.id} onChange={() => setRoleId(role.id)} />
                <span className="radio-mark" /><span><strong>{role.name}</strong><small>{full ? 'Full' : `${role.capacity - role.enrolled} of ${role.capacity} available`}</small></span>
              </label>
            })}
          </div></fieldset>
          <button className="button primary full" disabled={submitting || !roleId || cooldown > 0}>
            {submitting ? 'Joining…' : cooldown > 0 ? `Try again in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, '0')}` : <>Join session <ArrowRight size={17} /></>}
          </button>
        </form>
      </section>
    </main>
  )
}
