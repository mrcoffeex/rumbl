// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AdminDashboardPage, AdminGroupsPage, UsersPage } from './admin'
import { AuthProvider } from './auth'
import { DocsPage } from './DocsPage'
import { LandingPage } from './LandingPage'
import { JoinPage, LoginPage, ResultsPage, SessionDetailPage } from './pages'
import { PrivacyPage, TermsPage } from './LegalPages'

afterEach(() => {
  cleanup()
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
      <AuthProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(await screen.findByRole('heading', { name: /fair teams in a few taps/i })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /get started/i }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /shuffle into groups/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /terms & conditions/i })).toBeTruthy()
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeTruthy()
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
      <AuthProvider>
        <MemoryRouter initialEntries={['/docs']}>
          <DocsPage />
        </MemoryRouter>
      </AuthProvider>,
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
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/sessions" element={<h1>Session dashboard</h1>} />
            <Route path="/admin" element={<h1>Session dashboard</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
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
      <AuthProvider>
        <MemoryRouter initialEntries={['/sessions/9']}>
          <Routes>
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
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
        return json({
          overview: { users: 4, admins: 1, sessions: 2, students: 9, requests24h: 18, errors24h: 0 },
          charts: {
            trafficByDay: [{ date: '2026-08-25', requests: 18, errors: 0 }],
            signupsByDay: [{ date: '2026-08-25', users: 1 }],
            hourlyTraffic: [{ hour: new Date().toISOString(), requests: 3 }],
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

    render(
      <AuthProvider>
        <MemoryRouter>
          <AdminDashboardPage />
        </MemoryRouter>
      </AuthProvider>,
    )

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
    expect(screen.getByText('Users')).toBeTruthy()
    expect(screen.getByText('4')).toBeTruthy()
    expect(screen.getByText('Requests over the last 14 days')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Manage users' })).toBeTruthy()
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
      <AuthProvider>
        <MemoryRouter>
          <UsersPage />
        </MemoryRouter>
      </AuthProvider>,
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
      <AuthProvider>
        <MemoryRouter>
          <UsersPage />
        </MemoryRouter>
      </AuthProvider>,
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
      <AuthProvider>
        <MemoryRouter>
          <UsersPage />
        </MemoryRouter>
      </AuthProvider>,
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
      <AuthProvider>
        <MemoryRouter>
          <AdminGroupsPage />
        </MemoryRouter>
      </AuthProvider>,
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
})

