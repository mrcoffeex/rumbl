export type SessionStatus = 'draft' | 'open' | 'closed' | 'grouped'

export interface Role {
  id: string
  name: string
  slotsPerGroup: number
  capacity: number
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
  title: string
  expectedCount: number
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
  username: string
}

export interface PublicSession {
  id: string
  title: string
  status: SessionStatus
  expectedCount: number
  enrolledCount: number
  roles: Role[]
}

export interface CreateSessionInput {
  title: string
  expectedCount: number
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
  capacity?: number
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
  title: string
  expectedStudentCount: number
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
    (raw.capacity?.roles || []).map((role) => [role.id, role.capacity || 0]),
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
    title: raw.title,
    expectedCount: raw.expectedStudentCount,
    registeredCount: raw._count?.students ?? registrations.length,
    status: status(raw.status),
    token: raw.publicToken,
    roles: raw.roles.map((role) => ({
      id: String(role.id),
      name: role.name,
      slotsPerGroup: role.slotsPerGroup,
      capacity: role.capacity ?? capacityByRole.get(role.id) ?? 0,
      enrolled: role.registeredCount ?? role._count?.students ?? 0,
    })),
    registrations,
    groups: normalizeGroups(groups),
    createdAt: raw.createdAt,
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
}

export const api = {
  login: async (username: string, password: string) => {
    const { admin } = await request<{ admin: { id: number; username: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    return { user: { id: String(admin.id), username: admin.username } }
  },
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: async () => {
    const { admin } = await request<{ admin: { adminId: number; username: string } }>('/auth/me')
    return { user: { id: String(admin.adminId), username: admin.username } }
  },
  sessions: async () => {
    const { sessions } = await request<{ sessions: RawSession[] }>('/admin/sessions')
    return sessions.map((session) => normalizeSession(session))
  },
  session: async (id: string) => {
    const [{ session }, { groups }] = await Promise.all([
      request<{ session: RawSession }>(`/admin/sessions/${id}`),
      request<{ groups: RawGroup[] }>(`/admin/sessions/${id}/results`),
    ])
    return normalizeSession(session, groups)
  },
  createSession: async (input: CreateSessionInput) => {
    const { session } = await request<{ session: RawSession }>('/admin/sessions', {
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
    await request(`/admin/sessions/${id}/${action}`, { method: 'POST' })
    return api.session(id)
  },
  shuffle: async (id: string) => {
    await request(`/admin/sessions/${id}/shuffle`, { method: 'POST' })
    return api.session(id)
  },
  publicSession: async (token: string) => {
    const { session } = await request<{
      session: {
        id: number
        title: string
        status: string
        expectedStudentCount: number
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
        capacity: role.capacity || 0,
        enrolled: role.registeredCount || 0,
      })),
    }
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
