// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import { JoinPage, LoginPage } from './pages'

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
  it('signs an administrator in with username and password', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/api/auth/me')) return json({ error: 'Authentication required' }, 401)
      if (url.endsWith('/api/auth/login')) {
        return json({ admin: { id: 1, username: 'admin' } })
      }
      return json({ error: 'Unexpected request' }, 500)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<h1>Session dashboard</h1>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    )

    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Username'), 'admin')
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
})

