// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { clearClientReadCache } from './api'
import { AdminDashboardPage, AdminGroupsPage, UsersPage } from './admin'
import { AuthProvider } from './auth'
import { AppLayout } from './components'
import { DocsPage } from './DocsPage'
import { ProfilePage } from './ProfilePage'
import { LandingPage } from './LandingPage'
import { JoinPage, LoginPage, ResultsPage, SessionDetailPage } from './pages'
import { PrivacyPage, TermsPage } from './LegalPages'

afterEach(() => {
  cleanup()
  clearClientReadCache()
  vi.unstubAllGlobals()
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('critical user flows', () => {
  it('explains the product on the public landing page', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) return json({ error: 'Authentication required' }, 401)
      return json({ error: 'Unexpected request' }, 500)
    }))

    render(
      <MemoryRouter>
        <AuthProvider>
          <LandingPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /fair teams in a few taps/i })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /get started/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /shuffle into groups/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /terms & conditions/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeTruthy()
  })

  it('shows signed-out landing CTAs before auth resolves, then workspace when signed in', async () => {
    let resolveMe!: (value: Response) => void
    const pendingMe = new Promise<Response>((resolve) => {
      resolveMe = resolve
    })
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/api/auth/me')) return pendingMe
      return json({ error: 'Unexpected request' }, 500)
    }))

    render(
      <MemoryRouter>
        <AuthProvider>
          <LandingPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('link', { name: /get started/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /^sign in$/i })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /open workspace/i })).toBeNull()

    resolveMe(json({ user: { id: 2, email: 'teacher@school.edu', name: 'Teacher', role: 'user' } }))
    expect((await screen.findAllByRole('link', { name: /open workspace/i })).length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('link', { name: /get started/i })).toHaveLength(0)
    expect(screen.getByRole('link', { name: /^workspace$/i })).toBeTruthy()
  })

  it('does not fetch the current user on public join pages', async () => {
    const fetchMock = vi.fn(async () => json({ error: 'Unexpected request' }, 500))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/join/publictoken123456']}>
        <AuthProvider>
          <p>public join shell</p>
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(screen.getByText('public join shell')).toBeTruthy()
    await Promise.resolve()
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/auth/me'))).toBe(false)
  })

  it('publishes terms and a privacy policy', () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /terms & conditions/i })).toBeTruthy()
    expect(screen.getByText(/role-aware group generator/i)).toBeTruthy()

    cleanup()
    render(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { name: /privacy policy/i })).toBeTruthy()
    expect(screen.getByText(/rumbl_auth/i)).toBeTruthy()
    expect(screen.getByText(/does not sell personal information/i)).toBeTruthy()
  })

  it('explains how organizers and participants use Rumbl', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) return json({ error: 'Authentication required' }, 401)
      return json({ error: 'Unexpected request' }, 500)
    }))

    render(
      <MemoryRouter initialEntries={['/docs']}>
        <AuthProvider>
          <DocsPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: /how rumbl puts people into groups/i })).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'On this page' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Shuffle' })).toBeTruthy()
    expect(screen.getByText(/you can open and manage only the groups you created/i)).toBeTruthy()
  })

  it('signs a user in with email and password', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) return json({ error: 'Authentication required' }, 401)
      if (url.endsWith('/api/auth/config')) return json({ googleClientId: null })
      if (url.endsWith('/api/auth/login')) {
        return json({ user: { id: 1, email: 'admin@rumbl.local', name: 'admin', role: 'admin' } })
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sessions" element={<h1>Session dashboard</h1>} />
            <Route path="/admin" element={<h1>Session dashboard</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Email'), 'admin@rumbl.local')
    await user.type(screen.getByLabelText('Password'), 'correct horse battery staple')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('heading', { name: 'Session dashboard' })).toBeTruthy()
  })

  it('enrolls a student into an available role', async () => {
    const token = '1234567890abcdef'
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(`/api/public/sessions/${token}`)) {
        return json({
          session: {
            id: 7,
            title: 'Software Studio',
            status: 'OPEN',
            expectedStudentCount: 3,
            registeredCount: 0,
            roles: [
              {
                id: 11,
                name: 'Coder',
                slotsPerGroup: 1,
                capacity: 1,
                registeredCount: 0,
              },
            ],
          },
        })
      }
      if (url.endsWith(`/api/public/sessions/${token}/enroll`)) {
        return json({
          student: {
            id: 21,
            name: 'Alex Student',
            roleId: 11,
            createdAt: new Date().toISOString(),
            role: { name: 'Coder' },
          },
        }, 201)
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={[`/join/${token}`]}>
        <Routes>
          <Route path="/join/:token" element={<JoinPage />} />
        </Routes>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Your name'), 'Alex Student')
    await user.click(screen.getByRole('radio', { name: /coder/i }))
    await user.click(screen.getByRole('button', { name: /join session/i }))

    expect(await screen.findByRole('heading', { name: 'Thanks, Alex Student.' })).toBeTruthy()
  })

  it('shows public group results for a shuffled session', async () => {
    const token = '1234567890abcdef'
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(`/api/public/sessions/${token}/results`)) {
        return json({
          session: { id: 7, title: 'Software Studio', status: 'GROUPED' },
          groups: [
            {
              id: 31,
              name: 'Group 1',
              members: [
                { student: { id: 21, name: 'Alex Student' }, role: { name: 'Coder' } },
                { student: { id: 22, name: 'Blair Designer' }, role: { name: 'Designer' } },
              ],
            },
          ],
        })
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={[`/results/${token}`]}>
        <Routes>
          <Route path="/results/:token" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Software Studio' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Group 1' })).toBeTruthy()
    expect(screen.getByText('Alex Student')).toBeTruthy()
    expect(screen.getByText('Blair Designer')).toBeTruthy()
  })

  it('waits when public group results are not ready yet', async () => {
    const token = '1234567890abcdef'
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith(`/api/public/sessions/${token}/results`)) {
        return json({
          session: { id: 7, title: 'Software Studio', status: 'CLOSED' },
          groups: [],
        })
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={[`/results/${token}`]}>
        <Routes>
          <Route path="/results/:token" element={<ResultsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Software Studio' })).toBeTruthy()
    expect(screen.getByText(/haven’t been shuffled yet/i)).toBeTruthy()
  })

  it('lets an organizer copy a public group results link', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) {
        return json({ user: { id: 1, email: 'teacher@school.edu', name: 'Teacher', role: 'user' } })
      }
      if (url.endsWith('/api/sessions/9')) {
        return json({
          session: {
            id: 9,
            ownerId: 1,
            title: 'Studio',
            expectedStudentCount: 2,
            status: 'GROUPED',
            publicToken: 'publictoken123456',
            createdAt: new Date().toISOString(),
            roles: [{ id: 1, name: 'Coder', slotsPerGroup: 1, capacity: 1, registeredCount: 1 }],
            students: [{
              id: 21,
              name: 'Alex',
              roleId: 1,
              createdAt: new Date().toISOString(),
              role: { name: 'Coder' },
            }],
            _count: { students: 1 },
          },
        })
      }
      if (url.endsWith('/api/sessions/9/results')) {
        return json({
          groups: [{
            id: 31,
            name: 'Group 1',
            members: [{ student: { id: 21, name: 'Alex' }, role: { name: 'Coder' } }],
          }],
        })
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/sessions/9']}>
        <AuthProvider>
          <Routes>
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    const resultsUrl = `${window.location.origin}/results/publictoken123456`
    expect(await screen.findByText(resultsUrl)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy public results link' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /preview/i }).getAttribute('href')).toBe(resultsUrl)
  })

  it('renders admin dashboard widgets from overview metrics', async () => {
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/admin/overview')) {
        const range = new URL(url, 'http://localhost').searchParams.get('range') || '14d'
        return json({
          overview: { users: 4, admins: 1, sessions: 2, students: 9, requests: range === '7d' ? 42 : 18, errors: 0 },
          charts: {
            range,
            trafficByDay: range === '24h' ? [] : [{ date: '2026-08-25', requests: 18, errors: 0 }],
            signupsByDay: [{ date: '2026-08-25', users: 1 }],
            hourlyTraffic: range === '24h' ? [{ hour: new Date().toISOString(), requests: 3 }] : [],
            sessionsByStatus: [
              { status: 'draft', count: 0 },
              { status: 'open', count: 1 },
              { status: 'closed', count: 0 },
              { status: 'grouped', count: 1 },
            ],
            requestsByStatus: [
              { bucket: '2xx', count: 16 },
              { bucket: '4xx', count: 2 },
              { bucket: '5xx', count: 0 },
            ],
          },
        })
      }
    if (url.includes('/api/admin/traffic')) return json({ events: [] })
    if (url.includes('/api/admin/logs')) return json({ logs: [] })
    if (url.endsWith('/api/auth/me')) return json({ user: { id: 1, email: 'admin@rumbl.local', name: 'Admin', role: 'admin' } })
    return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <AuthProvider>
          <AdminDashboardPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByText('Users')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('Requests over the last 14 days')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Manage users' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '14d', pressed: true })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '7d' }))
    expect(await screen.findByText('Requests over the last 7 days')).toBeTruthy()
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/admin/overview?range=7d'))).toBe(true)
  })

  it('lists users for an administrator', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) {
        return json({ user: { id: 1, email: 'admin@rumbl.local', name: 'Admin', role: 'admin' } })
      }
      if (url.endsWith('/api/admin/users')) {
        return json({
          users: [
            {
              id: 1,
              email: 'admin@rumbl.local',
              name: 'Admin',
              role: 'admin',
              status: 'active',
              google: false,
              hasPassword: true,
              sessionCount: 0,
              createdAt: new Date().toISOString(),
            },
            {
              id: 2,
              email: 'teacher@school.edu',
              name: 'Teacher',
              role: 'user',
              status: 'active',
              google: false,
              hasPassword: true,
              sessionCount: 3,
              createdAt: new Date().toISOString(),
            },
          ],
        })
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <UsersPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeTruthy()
    expect(await screen.findByText('teacher@school.edu')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Add user' })).toBeTruthy()
  })

  it('opens a guided form for adding a platform user', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) {
        return json({ user: { id: 1, email: 'admin@rumbl.local', name: 'Admin', role: 'admin' } })
      }
      if (url.endsWith('/api/admin/users') && (input instanceof Request ? input.method : 'GET') !== 'POST') {
        return json({ users: [] })
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <UsersPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Add user' }))
    expect(await screen.findByRole('heading', { name: 'Add a platform user' })).toBeTruthy()
    expect((screen.getByRole('radio', { name: /create sessions/i }) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByRole('radio', { name: /monitor traffic/i }) as HTMLInputElement).checked).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Generate' }))
    expect((screen.getByLabelText('Password') as HTMLInputElement).value.length).toBeGreaterThanOrEqual(8)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('button', { name: 'Add user' })).toBeTruthy()
  })

  it('opens an edit form and status control for a platform user', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) {
        return json({ user: { id: 1, email: 'admin@rumbl.local', name: 'Admin', role: 'admin' } })
      }
      if (url.endsWith('/api/admin/users')) {
        return json({
          users: [
            {
              id: 1,
              email: 'admin@rumbl.local',
              name: 'Admin',
              role: 'admin',
              status: 'active',
              google: false,
              hasPassword: true,
              sessionCount: 0,
              createdAt: new Date().toISOString(),
            },
            {
              id: 2,
              email: 'teacher@school.edu',
              name: 'Teacher',
              role: 'user',
              status: 'active',
              google: false,
              hasPassword: true,
              sessionCount: 3,
              createdAt: new Date().toISOString(),
            },
          ],
        })
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <UsersPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Edit Teacher' }))
    expect(await screen.findByRole('heading', { name: 'Edit Teacher' })).toBeTruthy()
    expect(screen.getByDisplayValue('teacher@school.edu')).toBeTruthy()
    expect((screen.getByRole('radio', { name: /they can sign in/i }) as HTMLInputElement).checked).toBe(true)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('switch', { name: 'Account status for Teacher' })).toBeTruthy()
  })

  it('filters platform groups by search and status', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) {
        return json({ user: { id: 1, email: 'admin@rumbl.local', name: 'Admin', role: 'admin' } })
      }
      if (url.endsWith('/api/admin/sessions')) {
        return json({
          sessions: [
            {
              id: 11,
              title: 'Software Studio',
              status: 'OPEN',
              createdAt: new Date().toISOString(),
              owner: { id: 1, email: 'admin@rumbl.local', name: 'Admin' },
              _count: { students: 8, groups: 0 },
            },
            {
              id: 12,
              title: 'Debate Night',
              status: 'GROUPED',
              createdAt: new Date().toISOString(),
              owner: { id: 2, email: 'coach@school.edu', name: 'Coach' },
              _count: { students: 12, groups: 4 },
            },
          ],
        })
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <AdminGroupsPage />
        </AuthProvider>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    expect(await screen.findByRole('heading', { name: 'All groups' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Software Studio/ })).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Debate Night/ })).toBeNull()
    expect(screen.getByText('Debate Night')).toBeTruthy()

    await user.type(screen.getByLabelText('Search groups'), 'debate')
    expect(screen.queryByText('Software Studio')).toBeNull()
    expect(screen.getByText('Debate Night')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    await user.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.getByText('Software Studio')).toBeTruthy()
    expect(screen.queryByText('Debate Night')).toBeNull()
  })

  it('lets a user update profile settings from the header', async () => {
    const account = {
      id: 2,
      email: 'teacher@school.edu',
      name: 'Teacher',
      role: 'user',
      google: false,
      hasPassword: true,
      createdAt: '2026-01-15T00:00:00.000Z',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me') && init?.method === 'PATCH') {
        const body = JSON.parse(String(init.body)) as { name?: string; email?: string }
        return json({ user: { ...account, name: body.name ?? account.name, email: body.email ?? account.email } })
      }
      if (url.endsWith('/api/auth/me')) return json({ user: account })
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/sessions']}>
        <AuthProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/sessions" element={<div>My groups</div>} />
              <Route path="/settings" element={<ProfilePage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    expect(await screen.findByRole('link', { name: 'Settings' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Teacher/ })).toBeTruthy()
    await user.click(screen.getByRole('link', { name: 'Settings' }))

    expect(await screen.findByRole('heading', { name: 'Profile settings' })).toBeTruthy()
    expect(screen.getByDisplayValue('Teacher')).toBeTruthy()
    expect(screen.getByDisplayValue('teacher@school.edu')).toBeTruthy()
    expect(screen.getByText('User')).toBeTruthy()
    expect(screen.getByLabelText('Current password')).toBeTruthy()

    const nameField = screen.getByLabelText('Name')
    await user.clear(nameField)
    await user.type(nameField, 'Alex Rivera')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))

    expect(await screen.findByText('Profile saved.')).toBeTruthy()
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(patch).toBeTruthy()
    expect(JSON.parse(String(patch?.[1]?.body))).toMatchObject({ name: 'Alex Rivera', email: 'teacher@school.edu' })
  })

  it('lets an admin set a password on a Google-only account', async () => {
    const account = {
      id: 1,
      email: 'admin@rumbl.local',
      name: 'Admin',
      role: 'admin',
      google: true,
      hasPassword: false,
      createdAt: '2026-02-01T00:00:00.000Z',
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me') && init?.method === 'PATCH') {
        return json({ user: { ...account, hasPassword: true } })
      }
      if (url.endsWith('/api/auth/me')) return json({ user: account })
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AuthProvider>
          <Routes>
            <Route path="/settings" element={<ProfilePage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    const user = userEvent.setup()
    expect(await screen.findByRole('heading', { name: 'Profile settings' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Set a password' })).toBeTruthy()
    expect(screen.getByText('Administrator')).toBeTruthy()
    expect(screen.queryByLabelText('Current password')).toBeNull()
    expect(screen.getByText(/google sign-in still uses your google account/i)).toBeTruthy()

    await user.type(screen.getByLabelText('New password'), 'newpass12')
    await user.type(screen.getByLabelText('Confirm new password'), 'newpass12')
    await user.click(screen.getByRole('button', { name: 'Set password' }))

    expect(await screen.findByText(/password added/i)).toBeTruthy()
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(String(patch?.[1]?.body))).toEqual({ password: 'newpass12' })
  })
})

