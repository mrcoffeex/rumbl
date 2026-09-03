import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity, Check, Copy, Eye, EyeOff, FolderKanban, Pencil, Plus, Search, Sparkles, Trash2, TriangleAlert, Users, UsersRound, X,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, type AdminCharts, type AdminOverview, type AdminUser, type DashboardRange, type SessionStatus } from './api'
import { useAuth } from './auth'
import { ConfirmationModal, ErrorState, LoadingState, PageHeading, StatusBadge } from './components'
import { useRemote } from './useRemote'

const INK = '#26251e'
const ORANGE = '#f54e00'
const MUTED = '#85827a'
const LINE = '#e6e5e0'
const STATUS_COLORS: Record<string, string> = {
  draft: '#c9c7c0',
  open: '#317344',
  closed: '#6e6b65',
  grouped: ORANGE,
}
const BUCKET_COLORS: Record<string, string> = {
  '2xx': '#317344',
  '4xx': '#b45309',
  '5xx': '#a53022',
}
const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  grouped: 'Grouped',
}
const BUCKET_LABELS: Record<string, string> = {
  '2xx': 'Success',
  '4xx': 'Client errors',
  '5xx': 'Server errors',
}

const RANGE_FILTERS: Array<{ id: DashboardRange; label: string }> = [
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
  { id: '14d', label: '14d' },
  { id: '30d', label: '30d' },
]

const RANGE_LABELS: Record<DashboardRange, string> = {
  '24h': 'last 24 hours',
  '7d': 'last 7 days',
  '14d': 'last 14 days',
  '30d': 'last 30 days',
}

const RANGE_SHORT: Record<DashboardRange, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '14d': '14 days',
  '30d': '30 days',
}

function formatDay(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function formatHour(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric' })
}

function formatDayLabel(label: unknown) {
  return formatDay(String(label ?? ''))
}

function formatHourLabel(label: unknown) {
  return formatHour(String(label ?? ''))
}

function relativeTime(iso: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(iso).toLocaleDateString()
}

function statusTone(status: number) {
  if (status < 300) return 'ok'
  if (status < 400) return 'info'
  if (status < 500) return 'warn'
  return 'bad'
}

function ChartCard({
  title,
  meta,
  legend,
  empty,
  emptyText,
  children,
}: {
  title: string
  meta?: string
  legend?: ReactNode
  empty?: boolean
  emptyText?: string
  children: ReactNode
}) {
  return (
    <section className="card chart-card">
      <div className="chart-head">
        <div>
          <h2>{title}</h2>
          {meta && <p className="chart-meta">{meta}</p>}
        </div>
        {legend}
      </div>
      <div className="chart-body">
        {empty ? <p className="chart-empty">{emptyText || 'Nothing to plot yet.'}</p> : children}
      </div>
    </section>
  )
}

function DashTooltip({
  active,
  payload,
  label,
  formatLabel,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string }>
  label?: unknown
  formatLabel: (label: unknown) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="dash-tooltip">
      <strong>{formatLabel(label)}</strong>
      {payload.map((item) => (
        <div key={item.name}>
          <i style={{ background: item.color }} />
          <span>{item.name}</span>
          <em>{item.value}</em>
        </div>
      ))}
    </div>
  )
}

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [range, setRange] = useState<DashboardRange>('14d')
  const dashboard = useRemote(() => api.adminOverview(range), [range])
  const traffic = useRemote(() => api.adminTraffic(8).then((result) => result.events), [])
  const logs = useRemote(() => api.adminLogs(8).then((result) => result.logs), [])
  const overview = dashboard.data?.overview
  const charts = dashboard.data?.charts
  const firstName = user?.name?.trim().split(/\s+/)[0]
  const summary = overview
    ? `${overview.users} accounts · ${overview.sessions} sessions · ${overview.requests} requests in the ${RANGE_LABELS[range]}`
    : 'Live activity across accounts, sessions, and traffic.'

  return (
    <div className="dashboard-page">
      <PageHeading
        eyebrow="Administrator"
        title="Dashboard"
        description={firstName ? `Hi ${firstName}. ${summary}` : summary}
        action={<Link className="button secondary" to="/admin/users"><Users size={17} />Manage users</Link>}
      />
      <div className="filter-bar dashboard-range-bar">
        <div className="filter-chips" role="group" aria-label="Filter by time range">
          {RANGE_FILTERS.map((filter) => (
            <button
              type="button"
              key={filter.id}
              className={`filter-chip${range === filter.id ? ' selected' : ''}`}
              aria-pressed={range === filter.id}
              onClick={() => setRange(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      {dashboard.error ? <ErrorState message={dashboard.error} retry={dashboard.retry} /> :
        dashboard.loading || !overview || !charts ? <LoadingState label="Loading dashboard…" /> :
          <DashboardBody overview={overview} charts={charts} range={range} />}
      <div className="dash-feed">
        <article className="card dash-panel">
          <header>
            <div><p className="eyebrow">Live</p><h2>Recent requests</h2></div>
          </header>
          {traffic.loading ? <LoadingState /> : traffic.error ? <ErrorState message={traffic.error} retry={traffic.retry} /> :
            <div className="feed-list">{(traffic.data || []).length ? (traffic.data || []).map((event) => (
              <div className="feed-row" key={event.id}>
                <span className={`pill method`}>{event.method}</span>
                <span className="feed-main">{event.path}</span>
                <span className={`pill ${statusTone(event.status)}`}>{event.status}</span>
                <time>{relativeTime(event.createdAt)}</time>
              </div>
            )) : <p className="feed-empty">No requests recorded yet.</p>}</div>}
        </article>
        <article className="card dash-panel">
          <header>
            <div><p className="eyebrow">System</p><h2>Latest events</h2></div>
          </header>
          {logs.loading ? <LoadingState /> : logs.error ? <ErrorState message={logs.error} retry={logs.retry} /> :
            <div className="feed-list">{(logs.data || []).length ? (logs.data || []).map((entry) => (
              <div className="feed-row" key={entry.id}>
                <span className={`pill ${entry.level === 'error' ? 'bad' : entry.level === 'warn' ? 'warn' : 'info'}`}>{entry.level}</span>
                <span className="feed-main">{entry.message}</span>
                <em>{entry.category}</em>
                <time>{relativeTime(entry.createdAt)}</time>
              </div>
            )) : <p className="feed-empty">No logs yet.</p>}</div>}
        </article>
      </div>
    </div>
  )
}

function DashboardBody({ overview, charts, range }: { overview: AdminOverview; charts: AdminCharts; range: DashboardRange }) {
  const newUsers = charts.signupsByDay.reduce((sum, row) => sum + row.users, 0)
  const sessionHint = charts.sessionsByStatus
    .filter((row) => row.count > 0)
    .map((row) => `${row.count} ${STATUS_LABELS[row.status] || row.status}`)
    .join(' · ') || 'No sessions yet'

  return (
    <>
      <div className="kpi-grid">
        <Link className="card kpi-card" to="/admin/users" aria-label="View user accounts">
          <div className="kpi-top"><span className="kpi-icon"><Users size={16} /></span><p className="eyebrow">Users</p></div>
          <h2>{overview.users}</h2>
          <p>{overview.admins} admin{overview.admins === 1 ? '' : 's'} · {newUsers} new in {RANGE_SHORT[range]}</p>
        </Link>
        <Link className="card kpi-card" to="/admin/groups" aria-label="View all groups">
          <div className="kpi-top"><span className="kpi-icon"><FolderKanban size={16} /></span><p className="eyebrow">Sessions</p></div>
          <h2>{overview.sessions}</h2>
          <p>{sessionHint}</p>
        </Link>
        <article className="card kpi-card">
          <div className="kpi-top"><span className="kpi-icon"><UsersRound size={16} /></span><p className="eyebrow">Participants</p></div>
          <h2>{overview.students}</h2>
          <p>Registered across every session</p>
        </article>
        <article className={`card kpi-card${overview.errors ? ' alert' : ''}`}>
          <div className="kpi-top"><span className="kpi-icon">{overview.errors ? <TriangleAlert size={16} /> : <Activity size={16} />}</span><p className="eyebrow">{RANGE_FILTERS.find((item) => item.id === range)?.label}</p></div>
          <h2>{overview.requests}</h2>
          <p>{overview.errors ? `${overview.errors} error${overview.errors === 1 ? '' : 's'} in the ${RANGE_LABELS[range]}` : `No errors in the ${RANGE_LABELS[range]}`}</p>
        </article>
      </div>
      <DashboardCharts charts={charts} range={range} />
    </>
  )
}

function DashboardCharts({ charts, range }: { charts: AdminCharts; range: DashboardRange }) {
  const hourlyMode = range === '24h'
  const trafficEmpty = hourlyMode
    ? !charts.hourlyTraffic.some((row) => row.requests)
    : !charts.trafficByDay.some((row) => row.requests)
  const statusEmpty = !charts.sessionsByStatus.some((row) => row.count)
  const bucketTotal = charts.requestsByStatus.reduce((sum, row) => sum + row.count, 0)
  const sessionTotal = charts.sessionsByStatus.reduce((sum, row) => sum + row.count, 0)
  const signupEmpty = !charts.signupsByDay.some((row) => row.users)

  return (
    <>
      <div className="dash-primary">
        <ChartCard
          title="Traffic"
          meta={hourlyMode ? 'Requests by hour' : `Requests over the ${RANGE_LABELS[range]}`}
          empty={trafficEmpty}
          emptyText="No API traffic yet. This chart fills in as people use Rumbl."
          legend={<div className="chart-legend"><span><i style={{ background: ORANGE }} />Requests</span>{!hourlyMode && <span><i style={{ background: '#a53022' }} />Errors</span>}</div>}
        >
          <ResponsiveContainer width="100%" height="100%">
            {hourlyMode ? (
              <BarChart data={charts.hourlyTraffic} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis dataKey="hour" tickFormatter={formatHour} interval={3} tick={{ fill: MUTED, fontSize: 11 }} axisLine={{ stroke: LINE }} tickLine={false} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(38, 37, 30, .04)' }} content={<DashTooltip formatLabel={formatHourLabel} />} />
                <Bar dataKey="requests" name="Requests" fill={ORANGE} radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            ) : (
              <AreaChart data={charts.trafficByDay} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ORANGE} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fill: MUTED, fontSize: 11 }} axisLine={{ stroke: LINE }} tickLine={false} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ stroke: LINE }} content={<DashTooltip formatLabel={formatDayLabel} />} />
                <Area type="monotone" dataKey="requests" name="Requests" stroke={ORANGE} fill="url(#trafficFill)" strokeWidth={2.2} />
                <Area type="monotone" dataKey="errors" name="Errors" stroke="#a53022" fill="transparent" strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Sessions" meta={`${sessionTotal} total`} empty={statusEmpty} emptyText="Create a session to see the status mix.">
          <div className="status-mix">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={charts.sessionsByStatus} dataKey="count" nameKey="status" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                  {charts.sessionsByStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || INK} />
                  ))}
                </Pie>
                <Tooltip content={<DashTooltip formatLabel={(label) => STATUS_LABELS[String(label)] || String(label)} />} />
              </PieChart>
            </ResponsiveContainer>
            <ul className="status-legend">
              {charts.sessionsByStatus.map((entry) => (
                <li key={entry.status}>
                  <i style={{ background: STATUS_COLORS[entry.status] }} />
                  <span>{STATUS_LABELS[entry.status] || entry.status}</span>
                  <strong>{entry.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </div>
      <div className="dash-split">
        <ChartCard
          title={hourlyMode ? 'Signups' : 'New accounts'}
          meta={hourlyMode ? `Accounts created in the ${RANGE_LABELS[range]}` : `Signups over the ${RANGE_LABELS[range]}`}
          empty={signupEmpty}
          emptyText="No new accounts in this range."
        >
          {hourlyMode ? (
            <div className="meter-list">
              <div className="meter-row">
                <div className="meter-label"><span>New users</span><strong>{charts.signupsByDay[0]?.users ?? 0}</strong></div>
                <div className="meter-track"><span style={{ width: charts.signupsByDay[0]?.users ? '100%' : '0%', background: ORANGE }} /></div>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts.signupsByDay} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={LINE} vertical={false} />
                <XAxis dataKey="date" tickFormatter={formatDay} tick={{ fill: MUTED, fontSize: 11 }} axisLine={{ stroke: LINE }} tickLine={false} />
                <YAxis allowDecimals={false} width={28} tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(38, 37, 30, .04)' }} content={<DashTooltip formatLabel={formatDayLabel} />} />
                <Bar dataKey="users" name="Users" fill={INK} radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
        <ChartCard title="Reliability" meta={`HTTP responses over the ${RANGE_LABELS[range]}`} empty={!bucketTotal} emptyText="No responses recorded yet.">
          <div className="meter-list">
            {charts.requestsByStatus.map((entry) => {
              const percent = bucketTotal ? Math.round((entry.count / bucketTotal) * 100) : 0
              return (
                <div className="meter-row" key={entry.bucket}>
                  <div className="meter-label"><span>{BUCKET_LABELS[entry.bucket] || entry.bucket}</span><strong>{entry.count} · {percent}%</strong></div>
                  <div className="meter-track"><span style={{ width: `${percent}%`, background: BUCKET_COLORS[entry.bucket] }} /></div>
                </div>
              )
            })}
          </div>
        </ChartCard>
      </div>
    </>
  )
}

const STATUS_FILTERS: Array<{ id: 'all' | SessionStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'closed', label: 'Closed' },
  { id: 'grouped', label: 'Grouped' },
  { id: 'draft', label: 'Draft' },
]

export function AdminGroupsPage() {
  const { user } = useAuth()
  const { data: sessions, error, loading, retry } = useRemote(api.adminSessions, [])
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<'all' | SessionStatus>('all')
  const [owner, setOwner] = useState('all')

  const owners = useMemo(() => {
    const unique = new Map<string, string>()
    for (const session of sessions || []) unique.set(session.owner.email, session.owner.name)
    return [...unique.entries()].sort((left, right) => left[1].localeCompare(right[1]))
  }, [sessions])

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return (sessions || []).filter((session) => {
      if (status !== 'all' && session.status !== status) return false
      if (owner !== 'all' && session.owner.email !== owner) return false
      if (!needle) return true
      return session.title.toLocaleLowerCase().includes(needle)
        || session.owner.name.toLocaleLowerCase().includes(needle)
        || session.owner.email.toLocaleLowerCase().includes(needle)
    })
  }, [owner, query, sessions, status])

  const filtering = query.trim() !== '' || status !== 'all' || owner !== 'all'

  function clearFilters() {
    setQuery('')
    setStatus('all')
    setOwner('all')
  }

  return (
    <>
      <PageHeading
        eyebrow="Administrator"
        title="All groups"
        description="Browse every session on the platform. You can only open and manage groups you created."
      />
      {loading ? <LoadingState label="Loading groups…" /> : error ? <ErrorState message={error} retry={retry} /> :
        !sessions?.length ? <div className="card participant-no-results">No groups have been created yet.</div> :
          <>
            <div className="filter-bar">
              <label className="participant-search user-search"><Search size={16} /><input aria-label="Search groups" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title or owner" /></label>
              <div className="filter-chips" role="group" aria-label="Filter by status">
                {STATUS_FILTERS.map((filter) => (
                  <button type="button" key={filter.id} className={`filter-chip${status === filter.id ? ' selected' : ''}`} aria-pressed={status === filter.id} onClick={() => setStatus(filter.id)}>
                    {filter.label}
                  </button>
                ))}
              </div>
              {owners.length > 1 && (
                <label className="filter-select">Owner
                  <select aria-label="Filter by owner" value={owner} onChange={(event) => setOwner(event.target.value)}>
                    <option value="all">All owners</option>
                    {owners.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
                  </select>
                </label>
              )}
              {filtering && <button type="button" className="text-button" onClick={clearFilters}>Clear filters</button>}
            </div>
            <p className="filter-count">{filtered.length} of {sessions.length} group{sessions.length === 1 ? '' : 's'}</p>
            {!filtered.length ? <div className="card participant-no-results">No groups match those filters.</div> :
              <div className="card group-table">
                <div className="group-row group-head"><span>Session</span><span>Owner</span><span>Status</span><span>People</span><span>Results</span><span>Created</span></div>
                {filtered.map((session) => {
                  const cells = (
                    <>
                      <strong>{session.title}</strong>
                      <span className="group-owner">{session.owner.name}<small>{session.owner.email}</small></span>
                      <StatusBadge status={session.status} />
                      <span>{session.registeredCount}</span>
                      <span>{session.groupCount || '—'}</span>
                      <time>{new Date(session.createdAt).toLocaleDateString()}</time>
                    </>
                  )
                  return user?.id === session.owner.id
                    ? <Link className="group-row" to={`/sessions/${session.id}`} key={session.id}>{cells}</Link>
                    : <div className="group-row locked" key={session.id} title="You can only manage your own groups">{cells}</div>
                })}
              </div>}
          </>}
    </>
  )
}

const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'

function generatePassword(length = 12) {
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => PASSWORD_ALPHABET.charAt(value % PASSWORD_ALPHABET.length)).join('')
}

function UserAccountForm({
  person,
  lockAccess,
  onSaved,
  onCancel,
}: {
  person?: AdminUser
  lockAccess?: boolean
  onSaved: (user: AdminUser) => void
  onCancel: () => void
}) {
  const editing = Boolean(person)
  const nameRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(person?.name ?? '')
  const [email, setEmail] = useState(person?.email ?? '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>(person?.role ?? 'user')
  const [status, setStatus] = useState<'active' | 'disabled'>(person?.status ?? 'active')
  const [showPassword, setShowPassword] = useState(false)
  const [copied, setCopied] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const remaining = Math.max(0, 8 - password.length)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel
  const titleId = editing ? 'edit-user-title' : 'add-user-title'
  const passwordId = editing ? 'edit-user-password' : 'new-user-password'

  useEffect(() => {
    nameRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancelRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (password && password.length < 8) {
      setFormError('Password must be at least 8 characters, or leave it blank to keep the current one.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      if (editing && person) {
        const updated = await api.adminUpdateUser(person.id, {
          name: name.trim(),
          email: email.trim(),
          role,
          status,
          ...(password ? { password } : {}),
        })
        onSaved(updated)
      } else {
        const created = await api.adminCreateUser({ name: name.trim(), email: email.trim(), password, role })
        onSaved(created)
      }
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : editing ? 'Unable to update user.' : 'Unable to create user.')
    } finally {
      setSubmitting(false)
    }
  }

  function fillGeneratedPassword() {
    const next = generatePassword()
    setPassword(next)
    setShowPassword(true)
    setCopied(false)
  }

  async function copyPassword() {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setFormError('Could not copy the password. Select it and copy manually.')
    }
  }

  return (
    <form className="card user-create-card" onSubmit={(event) => void submit(event)} autoComplete="off" aria-labelledby={titleId}>
      <div className="user-create-head">
        <div>
          <p className="eyebrow">{editing ? 'Edit account' : 'New account'}</p>
          <h2 id={titleId}>{editing ? `Edit ${person?.name}` : 'Add a platform user'}</h2>
          <p>
            {editing
              ? 'Update their details, access, or sign-in status. Leave the password blank to keep the current one.'
              : 'They will sign in with this email and password. Share the password with them separately.'}
          </p>
        </div>
        <button type="button" className="icon-button" onClick={onCancel} aria-label={editing ? 'Close edit user form' : 'Close add user form'}><X size={16} /></button>
      </div>
      {formError && <div className="form-error" role="alert">{formError}</div>}
      <div className="user-create-grid">
        <label>Name
          <input
            ref={nameRef}
            required
            maxLength={120}
            autoCapitalize="words"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Jordan Lee"
          />
        </label>
        <label>Email
          <input
            type="email"
            required
            maxLength={190}
            autoComplete="off"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="jordan@school.edu"
          />
        </label>
        <div className="wide">
          <label htmlFor={passwordId}>{editing ? 'New password' : 'Password'}</label>
          <div className="password-field">
            <input
              id={passwordId}
              type={showPassword ? 'text' : 'password'}
              required={!editing}
              minLength={editing ? undefined : 8}
              maxLength={200}
              autoComplete="new-password"
              value={password}
              onChange={(event) => { setPassword(event.target.value); setCopied(false) }}
              placeholder={editing ? 'Leave blank to keep the current password' : 'At least 8 characters'}
              aria-describedby={`${passwordId}-hint`}
            />
            <button type="button" className="icon-button" onClick={() => setShowPassword((open) => !open)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="password-meta" id={`${passwordId}-hint`}>
            <span className={password.length >= 8 ? 'is-ready' : undefined}>
              {password.length === 0
                ? (editing ? (person?.google && !person.hasPassword ? 'Optional — this account currently uses Google sign-in' : 'Optional') : 'At least 8 characters')
                : remaining > 0 ? `${remaining} more character${remaining === 1 ? '' : 's'}` : 'Ready to share'}
            </span>
            <div className="password-tools">
              <button type="button" className="text-button" onClick={fillGeneratedPassword}><Sparkles size={14} />Generate</button>
              <button type="button" className="text-button" onClick={() => void copyPassword()} disabled={!password}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
        <fieldset className="wide role-fieldset">
          <legend>Access</legend>
          <div className="role-picks">
            <label className="role-pick">
              <input type="radio" name={`${titleId}-role`} checked={role === 'user'} disabled={lockAccess} onChange={() => setRole('user')} />
              <strong>User</strong>
              <span>Create sessions, collect joins, and shuffle groups.</span>
            </label>
            <label className="role-pick">
              <input type="radio" name={`${titleId}-role`} checked={role === 'admin'} disabled={lockAccess} onChange={() => setRole('admin')} />
              <strong>Administrator</strong>
              <span>Monitor traffic, manage accounts, and see every group.</span>
            </label>
          </div>
          {lockAccess && <p className="lock-note">You cannot change the role or status of your own account.</p>}
          {role === 'admin' && !lockAccess && <p className="role-warning">Admins can change roles and delete any account, including other administrators.</p>}
        </fieldset>
        {editing && (
          <fieldset className="wide role-fieldset">
            <legend>Status</legend>
            <div className="role-picks">
              <label className="role-pick">
                <input type="radio" name={`${titleId}-status`} checked={status === 'active'} disabled={lockAccess} onChange={() => setStatus('active')} />
                <strong>Active</strong>
                <span>They can sign in and use the platform.</span>
              </label>
              <label className="role-pick">
                <input type="radio" name={`${titleId}-status`} checked={status === 'disabled'} disabled={lockAccess} onChange={() => setStatus('disabled')} />
                <strong>Disabled</strong>
                <span>They cannot sign in until an admin reactivates them.</span>
              </label>
            </div>
            {status === 'disabled' && !lockAccess && <p className="role-warning">Open sessions stay in place, but this person will be signed out and blocked from logging in.</p>}
          </fieldset>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel}>Cancel</button>
        <button className="button primary" disabled={submitting}>{submitting ? (editing ? 'Saving…' : 'Creating…') : (editing ? 'Save changes' : 'Create user')}</button>
      </div>
    </form>
  )
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const { data: users, setData: setUsers, error, loading, retry } = useRemote(api.adminUsers, [])
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<AdminUser | null>(null)
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null)
  const [pendingDisable, setPendingDisable] = useState<AdminUser | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const focusAddButton = useRef(false)
  const formOpen = creating || Boolean(editing)

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return (users || []).filter((person) => {
      if (statusFilter !== 'all' && person.status !== statusFilter) return false
      if (!needle) return true
      return person.name.toLocaleLowerCase().includes(needle)
        || person.email.toLocaleLowerCase().includes(needle)
        || person.role.includes(needle)
    })
  }, [query, statusFilter, users])

  useEffect(() => {
    if (formOpen || !focusAddButton.current) return
    focusAddButton.current = false
    addButtonRef.current?.focus()
  }, [formOpen])

  function closeForm() {
    focusAddButton.current = true
    setCreating(false)
    setEditing(null)
  }

  function handleSaved(saved: AdminUser, created: boolean) {
    setUsers((current) => {
      const list = current || []
      if (created) return [saved, ...list.filter((item) => item.id !== saved.id)]
      return list.map((item) => item.id === saved.id ? saved : item)
    })
    setNotice(created
      ? `${saved.name} can now sign in with ${saved.email}.`
      : `${saved.name} was updated.`)
    closeForm()
  }

  async function changeStatus(person: AdminUser, nextStatus: 'active' | 'disabled') {
    if (person.status === nextStatus) return
    setActionError('')
    try {
      const updated = await api.adminUpdateUser(person.id, { status: nextStatus })
      setUsers((current) => (current || []).map((item) => item.id === updated.id ? updated : item))
      setNotice(nextStatus === 'disabled'
        ? `${updated.name} can no longer sign in.`
        : `${updated.name} can sign in again.`)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to update status.')
    }
  }

  async function confirmDisable() {
    if (!pendingDisable) return
    const person = pendingDisable
    setPendingDisable(null)
    await changeStatus(person, 'disabled')
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setPendingDelete(null)
    setActionError('')
    try {
      await api.adminDeleteUser(id)
      setUsers((current) => (current || []).filter((item) => item.id !== id))
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Unable to delete user.')
    }
  }

  return (
    <>
      {pendingDelete && <ConfirmationModal
        title={`Delete ${pendingDelete.name}?`}
        message={`${pendingDelete.email} will be removed, including any sessions they own. This cannot be undone.`}
        confirmLabel="Delete user"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
      />}
      {pendingDisable && <ConfirmationModal
        title={`Disable ${pendingDisable.name}?`}
        message={`${pendingDisable.email} will not be able to sign in until you activate them again. Their sessions stay in place.`}
        confirmLabel="Disable account"
        onCancel={() => setPendingDisable(null)}
        onConfirm={() => void confirmDisable()}
      />}
      <PageHeading
        eyebrow="Administrator"
        title="Users"
        description="Create accounts, edit details, and activate or disable sign-in."
        action={!formOpen ? (
          <button ref={addButtonRef} className="button primary" onClick={() => { setCreating(true); setEditing(null); setNotice(''); setActionError('') }}>
            <Plus size={17} />Add user
          </button>
        ) : undefined}
      />
      {creating && <UserAccountForm onSaved={(user) => handleSaved(user, true)} onCancel={closeForm} />}
      {editing && <UserAccountForm key={editing.id} person={editing} lockAccess={editing.id === currentUser?.id} onSaved={(user) => handleSaved(user, false)} onCancel={closeForm} />}
      {notice && <div className="form-success user-notice" role="status">{notice}</div>}
      {actionError && <div className="form-error" role="alert">{actionError}</div>}
      {loading ? <LoadingState label="Loading users…" /> : error ? <ErrorState message={error} retry={retry} /> :
        <>
          <div className="filter-bar">
            <label className="participant-search user-search"><Search size={16} /><input aria-label="Search users" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or email" /></label>
            <div className="filter-chips" role="group" aria-label="Filter by status">
              {([['all', 'All'], ['active', 'Active'], ['disabled', 'Disabled']] as const).map(([id, label]) => (
                <button type="button" key={id} className={`filter-chip${statusFilter === id ? ' selected' : ''}`} aria-pressed={statusFilter === id} onClick={() => setStatusFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {!filtered.length ? <div className="card participant-no-results">No users match those filters.</div> :
            <div className="card user-table">
              <div className="user-row user-head"><span>Name</span><span>Email</span><span>Role</span><span>Status</span><span>Sessions</span><span>Joined</span><span /></div>
              {filtered.map((person) => {
                const self = person.id === currentUser?.id
                return (
                  <div className={`user-row${person.status === 'disabled' ? ' is-disabled' : ''}`} key={person.id}>
                    <div className="user-name"><div className="avatar">{person.name.slice(0, 1).toUpperCase()}</div><div><strong>{person.name}</strong><span>{person.google ? 'Google' : person.hasPassword ? 'Password' : 'No sign-in'}</span></div></div>
                    <span className="user-email">{person.email}</span>
                    <span className="user-role-label">{person.role === 'admin' ? 'Admin' : 'User'}</span>
                    <button
                      type="button"
                      className={`status-switch${person.status === 'active' ? ' is-on' : ''}`}
                      role="switch"
                      aria-checked={person.status === 'active'}
                      aria-label={`Account status for ${person.name}`}
                      disabled={self}
                      onClick={() => {
                        if (person.status === 'active') setPendingDisable(person)
                        else void changeStatus(person, 'active')
                      }}
                    >
                      <span className="status-switch-track" aria-hidden="true"><span className="status-switch-thumb" /></span>
                      <span className="status-switch-label">{person.status === 'active' ? 'Active' : 'Disabled'}</span>
                    </button>
                    <span>{person.sessionCount}</span>
                    <time>{new Date(person.createdAt).toLocaleDateString()}</time>
                    <div className="user-actions">
                      <button type="button" className="icon-button" onClick={() => { setEditing(person); setCreating(false); setNotice(''); setActionError('') }} aria-label={`Edit ${person.name}`}><Pencil size={16} /></button>
                      <button type="button" className="icon-button danger" disabled={self} onClick={() => setPendingDelete(person)} aria-label={`Delete ${person.name}`}><Trash2 size={16} /></button>
                    </div>
                  </div>
                )
              })}
            </div>}
        </>}
    </>
  )
}
