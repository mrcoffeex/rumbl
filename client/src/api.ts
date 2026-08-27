export type SessionStatus = 'draft' | 'open' | 'closed' | 'grouped'

export interface Role {
  id: string
  name: string
  slotsPerGroup: number
  capacity: number | null
  enrolled: number
}

export interface Registration {
  id: string
  name: string
  roleId: string
  roleName?: string
  createdAt: string
}

export interface GroupMember {
  id: string
  name: string
  roleName: string
}

export interface Group {
  id: string
  name: string
  members: GroupMember[]
}

export interface Session {
  id: string
  ownerId: string
  title: string
  expectedCount: number | null
  registeredCount: number
  status: SessionStatus
  token: string
  roles: Role[]
  registrations: Registration[]
  groups: Group[]
  createdAt: string
}

export interface User {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  google?: boolean
  hasPassword?: boolean
  createdAt?: string
}

export interface ProfileUpdate {
  name?: string
  email?: string
  currentPassword?: string
  password?: string
}

export interface PublicSession {
  id: string
  title: string
  status: SessionStatus
  expectedCount: number | null
  enrolledCount: number
  roles: Role[]
}

export interface PublicResults {
  title: string
  status: SessionStatus
  groups: Group[]
}

export interface AdminOverview {
  users: number
  admins: number
  sessions: number
  students: number
  requests: number
  errors: number
}

export type DashboardRange = '24h' | '7d' | '14d' | '30d'

export interface AdminCharts {
  range: DashboardRange
  trafficByDay: Array<{ date: string; requests: number; errors: number }>
  signupsByDay: Array<{ date: string; users: number }>
  hourlyTraffic: Array<{ hour: string; requests: number }>
  sessionsByStatus: Array<{ status: string; count: number }>
  requestsByStatus: Array<{ bucket: string; count: number }>
}

export interface AdminUser {
  id: string
  email: string
  name: string
  role: 'user' | 'admin'
  status: 'active' | 'disabled'
  google: boolean
  hasPassword: boolean
  sessionCount: number
  createdAt: string
}

export interface AdminSession {
  id: string
  title: string
  status: SessionStatus
  createdAt: string
  owner: { id: string; email: string; name: string }
  registeredCount: number
  groupCount: number
}

export interface CreateSessionInput {
  title: string
  expectedCount: number | null
  roles: Array<{ name: string; slotsPerGroup: number }>
}

class ApiError extends Error {
  status: number
  retryAfterSeconds?: number

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

type RawRole = {
  id: number
  name: string
  slotsPerGroup: number
  capacity?: number | null
  registeredCount?: number
  _count?: { students?: number }
}

type RawStudent = {
  id: number
  name: string
  roleId: number
  createdAt: string
  role?: { name: string }
}

type RawGroup = {
  id: number
  name: string
  members: Array<{
    id?: number
    student: { id: number; name: string }
    role: { name: string }
  }>
}

type RawSession = {
  id: number
  ownerId: number
  title: string
  expectedStudentCount: number | null
  status: string
  publicToken: string
  createdAt: string
  roles: RawRole[]
  students?: RawStudent[]
  _count?: { students?: number }
  capacity?: { roles: RawRole[] }
}

function status(value: string): SessionStatus {
  return value.toLowerCase() as SessionStatus
}

function normalizeGroups(groups: RawGroup[]): Group[] {
  return groups.map((group) => ({
    id: String(group.id),
    name: group.name,
    members: group.members.map((member) => ({
      id: String(member.student.id),
      name: member.student.name,
      roleName: member.role.name,
    })),
  }))
}

function normalizeSession(raw: RawSession, groups: RawGroup[] = []): Session {
  const capacityByRole = new Map(
    (raw.capacity?.roles || []).map((role) => [role.id, role.capacity ?? null]),
  )
  const registrations = (raw.students || []).map((student) => ({
    id: String(student.id),
    name: student.name,
    roleId: String(student.roleId),
    roleName: student.role?.name,
    createdAt: student.createdAt,
  }))

  return {
    id: String(raw.id),
    ownerId: String(raw.ownerId),
    title: raw.title,
    expectedCount: raw.expectedStudentCount,
    registeredCount: raw._count?.students ?? registrations.length,
    status: status(raw.status),
    token: raw.publicToken,
    roles: raw.roles.map((role) => ({
      id: String(role.id),
      name: role.name,
      slotsPerGroup: role.slotsPerGroup,
      capacity: role.capacity !== undefined ? role.capacity : (capacityByRole.get(role.id) ?? 0),
      enrolled: role.registeredCount ?? role._count?.students ?? 0,
    })),
    registrations,
    groups: normalizeGroups(groups),
    createdAt: raw.createdAt,
  }
}

type RawAdminUser = {
  id: number
  email: string
  name: string
  role: 'user' | 'admin'
  status?: 'active' | 'disabled'
  google: boolean
  hasPassword: boolean
  sessionCount: number
  createdAt: string
}

function normalizeAdminUser(user: RawAdminUser): AdminUser {
  return { ...user, id: String(user.id), status: user.status || 'active' }
}

type RawUser = {
  id: number
  email: string
  name: string
  role: 'user' | 'admin'
  google?: boolean
  hasPassword?: boolean
  createdAt?: string
}

function normalizeUser(user: RawUser): User {
  return {
    id: String(user.id),
    email: user.email,
    name: user.name,
    role: user.role,
    google: user.google,
    hasPassword: user.hasPassword,
    createdAt: user.createdAt,
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase()
  const cacheable = method === 'GET' && isClientCacheable(path)
  const key = `${method}:${path}`

  if (cacheable) {
    const cached = clientReadCache.get(key)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T
    }
    const inflight = clientInflight.get(key)
    if (inflight) return inflight as Promise<T>
  }

  const run = (async () => {
    const response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      const retryAfter = Number(response.headers.get('Retry-After'))
      throw new ApiError(
        body?.message || body?.error || 'Something went wrong.',
        response.status,
        Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : undefined,
      )
    }

    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  })()

  if (cacheable) {
    clientInflight.set(key, run)
    try {
      const value = await run
      clientReadCache.set(key, { value, expiresAt: Date.now() + clientCacheTtlMs(path) })
      return value
    } finally {
      clientInflight.delete(key)
    }
  }

  const value = await run
  if (method !== 'GET') invalidateClientCaches(path)
  return value
}

function isClientCacheable(path: string) {
  return (
    path === '/auth/config'
    || path.startsWith('/public/sessions/')
    || /^\/sessions\/\d+(\/results)?$/.test(path)
    || path === '/sessions'
    || path.startsWith('/admin/overview')
  )
}

function clientCacheTtlMs(path: string) {
  if (path === '/auth/config') return 60_000
  if (path.includes('/results') && path.startsWith('/public/')) return 2_000
  if (path.startsWith('/admin/overview')) return 5_000
  return 1_000
}

function invalidateClientCaches(path: string) {
  if (path.startsWith('/public/sessions/') || path.startsWith('/sessions')) {
    for (const key of [...clientReadCache.keys()]) {
      if (key.includes('/sessions') || key.includes('/public/sessions')) {
        clientReadCache.delete(key)
      }
    }
    return
  }
  if (path.startsWith('/admin/') || path.startsWith('/auth/')) {
    clientReadCache.clear()
  }
}

const clientReadCache = new Map<string, { value: unknown; expiresAt: number }>()
const clientInflight = new Map<string, Promise<unknown>>()

/** Test helper — drop short-lived GET responses between cases. */
export function clearClientReadCache() {
  clientReadCache.clear()
  clientInflight.clear()
}

export const api = {
  authConfig: () => request<{ googleClientId: string | null }>('/auth/config'),
  login: async (email: string, password: string, rememberMe = false) => {
    const { user } = await request<{ user: RawUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    })
    return { user: normalizeUser(user) }
  },
  register: async (name: string, email: string, password: string, rememberMe = false) => {
    const { user } = await request<{ user: RawUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, rememberMe }),
    })
    return { user: normalizeUser(user) }
  },
  googleLogin: async (idToken: string, rememberMe = false) => {
    const { user } = await request<{ user: RawUser }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken, rememberMe }),
    })
    return { user: normalizeUser(user) }
  },
  forgotPassword: (email: string) => request<{ ok: boolean; resetUrl?: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
  resetPassword: (token: string, password: string) => request<{ ok: boolean }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: async () => {
    const { user } = await request<{ user: RawUser }>('/auth/me')
    return { user: normalizeUser(user) }
  },
  updateProfile: async (input: ProfileUpdate) => {
    const { user } = await request<{ user: RawUser }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return { user: normalizeUser(user) }
  },
  sessions: async () => {
    const { sessions } = await request<{ sessions: RawSession[] }>('/sessions')
    return sessions.map((session) => normalizeSession(session))
  },
  session: async (id: string) => {
    const [{ session }, { groups }] = await Promise.all([
      request<{ session: RawSession }>(`/sessions/${id}`),
      request<{ groups: RawGroup[] }>(`/sessions/${id}/results`),
    ])
    return normalizeSession(session, groups)
  },
  createSession: async (input: CreateSessionInput) => {
    const { session } = await request<{ session: RawSession }>('/sessions', {
      method: 'POST',
      body: JSON.stringify({
        title: input.title,
        expectedStudentCount: input.expectedCount,
        roles: input.roles,
      }),
    })
    return normalizeSession(session)
  },
  setSessionStatus: async (id: string, nextStatus: 'open' | 'closed') => {
    const action = nextStatus === 'closed' ? 'close' : 'open'
    await request(`/sessions/${id}/${action}`, { method: 'POST' })
    return api.session(id)
  },
  shuffle: async (id: string) => {
    await request(`/sessions/${id}/shuffle`, { method: 'POST' })
    return api.session(id)
  },
  removeParticipant: async (sessionId: string, studentId: string) => {
    await request(`/sessions/${sessionId}/students/${studentId}`, { method: 'DELETE' })
    return api.session(sessionId)
  },
  adminOverview: (range: DashboardRange = '14d') =>
    request<{ overview: AdminOverview; charts: AdminCharts }>(`/admin/overview?range=${range}`),
  adminTraffic: (limit = 8) => request<{ events: Array<{ id: number; method: string; path: string; status: number; durationMs: number; ip: string | null; createdAt: string; user: { email: string; name: string } | null }> }>(`/admin/traffic?limit=${limit}`),
  adminLogs: (limit = 8) => request<{ logs: Array<{ id: number; level: string; category: string; message: string; meta: unknown; ip: string | null; createdAt: string; user: { email: string; name: string } | null }> }>(`/admin/logs?limit=${limit}`),
  adminSessions: async () => {
    const { sessions } = await request<{
      sessions: Array<{
        id: number
        title: string
        status: string
        createdAt: string
        owner: { id: number; email: string; name: string }
        _count: { students: number; groups: number }
      }>
    }>('/admin/sessions')
    return sessions.map((session) => ({
      id: String(session.id),
      title: session.title,
      status: status(session.status),
      createdAt: session.createdAt,
      owner: { id: String(session.owner.id), email: session.owner.email, name: session.owner.name },
      registeredCount: session._count.students,
      groupCount: session._count.groups,
    } satisfies AdminSession))
  },
  adminUsers: async () => {
    const { users } = await request<{ users: RawAdminUser[] }>('/admin/users')
    return users.map(normalizeAdminUser)
  },
  adminCreateUser: async (input: { name: string; email: string; password: string; role: 'user' | 'admin' }) => {
    const { user } = await request<{ user: RawAdminUser }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return normalizeAdminUser(user)
  },
  adminUpdateUser: async (id: string, input: { name?: string; email?: string; password?: string; role?: 'user' | 'admin'; status?: 'active' | 'disabled' }) => {
    const { user } = await request<{ user: RawAdminUser }>(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return normalizeAdminUser(user)
  },
  adminDeleteUser: (id: string) => request<void>(`/admin/users/${id}`, { method: 'DELETE' }),
  publicSession: async (token: string) => {
    const { session } = await request<{
      session: {
        id: number
        title: string
        status: string
        expectedStudentCount: number | null
        registeredCount: number
        roles: RawRole[]
      }
    }>(`/public/sessions/${token}`)
    return {
      id: String(session.id),
      title: session.title,
      status: status(session.status),
      expectedCount: session.expectedStudentCount,
      enrolledCount: session.registeredCount,
      roles: session.roles.map((role) => ({
        id: String(role.id),
        name: role.name,
        slotsPerGroup: role.slotsPerGroup,
        capacity: role.capacity ?? null,
        enrolled: role.registeredCount || 0,
      })),
    }
  },
  publicResults: async (token: string) => {
    const { session, groups } = await request<{
      session: { id: number; title: string; status: string }
      groups: RawGroup[]
    }>(`/public/sessions/${token}/results`)
    return {
      title: session.title,
      status: status(session.status),
      groups: normalizeGroups(groups),
    } satisfies PublicResults
  },
  enroll: async (token: string, name: string, roleId: string) => {
    const { student } = await request<{ student: RawStudent }>(`/public/sessions/${token}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ name, roleId: Number(roleId) }),
    })
    return {
      registration: {
        id: String(student.id),
        name: student.name,
        roleId: String(student.roleId),
        roleName: student.role?.name,
        createdAt: student.createdAt,
      },
    }
  },
}

export { ApiError }
