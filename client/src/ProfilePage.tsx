import { useEffect, useState, type FormEvent } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { api, type User } from './api'
import { useAuth } from './auth'
import { ErrorState, LoadingState, PageHeading } from './components'

function signInLabel(profile: User) {
  if (profile.google && profile.hasPassword) return 'Google and password'
  if (profile.google) return 'Google'
  if (profile.hasPassword) return 'Email and password'
  return 'Not set'
}

function joinedLabel(createdAt?: string) {
  if (!createdAt) return '—'
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [profile, setProfile] = useState<User | null>(user)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const remaining = Math.max(0, 8 - password.length)
  const hasPassword = Boolean(profile?.hasPassword)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError('')
    api.me()
      .then(({ user: current }) => {
        if (!active) return
        setProfile(current)
        setName(current.name)
        setEmail(current.email)
      })
      .catch((cause) => {
        if (!active) return
        setLoadError(cause instanceof Error ? cause.message : 'Unable to load your profile.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [])

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    setSavingProfile(true)
    setProfileError('')
    setProfileNotice('')
    try {
      const next = await updateProfile({ name: name.trim(), email: email.trim() })
      setProfile(next)
      setProfileNotice('Profile saved.')
    } catch (cause) {
      setProfileError(cause instanceof Error ? cause.message : 'Unable to save your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    setSavingPassword(true)
    setPasswordError('')
    setPasswordNotice('')
    try {
      const next = await updateProfile({
        password,
        ...(hasPassword ? { currentPassword } : {}),
      })
      setProfile(next)
      setCurrentPassword('')
      setPassword('')
      setConfirmPassword('')
      setPasswordNotice(hasPassword ? 'Password updated.' : 'Password added. You can now sign in with email as well.')
    } catch (cause) {
      setPasswordError(cause instanceof Error ? cause.message : 'Unable to update your password.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading && !profile) return <LoadingState label="Loading your profile…" />
  if (loadError && !profile) return <ErrorState message={loadError} />
  if (!profile) return <LoadingState label="Loading your profile…" />

  return (
    <div className="narrow-page profile-page">
      <PageHeading
        eyebrow="Account"
        title="Profile settings"
        description="Update how you appear in Rumbl and how you sign in. These settings are yours, whether you are a user or an administrator."
      />

      <form className="card profile-card" onSubmit={(event) => void saveProfile(event)}>
        <div className="section-heading">
          <div>
            <h2>Your details</h2>
            <p>Your name is shown in the app. Email is how you sign in if you use a password.</p>
          </div>
        </div>
        {profileError && <div className="form-error" role="alert">{profileError}</div>}
        {profileNotice && <div className="form-success" role="status">{profileNotice}</div>}
        <div className="user-create-grid">
          <label>Name
            <input
              required
              maxLength={120}
              autoCapitalize="words"
              autoComplete="name"
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
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@school.edu"
            />
          </label>
        </div>
        {profile.google && (
          <p className="profile-note">Google sign-in still uses your Google account, even if you change this email.</p>
        )}
        <div className="form-actions">
          <button className="button primary" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
        </div>
      </form>

      <form className="card profile-card" onSubmit={(event) => void savePassword(event)}>
        <div className="section-heading">
          <div>
            <h2>{hasPassword ? 'Change password' : 'Set a password'}</h2>
            <p>
              {hasPassword
                ? 'Enter your current password, then choose a new one of at least 8 characters.'
                : profile.google
                  ? 'This account uses Google. Add a password if you also want to sign in with email.'
                  : 'Choose a password of at least 8 characters.'}
            </p>
          </div>
        </div>
        {passwordError && <div className="form-error" role="alert">{passwordError}</div>}
        {passwordNotice && <div className="form-success" role="status">{passwordNotice}</div>}
        <div className="stack-form profile-password-form">
          {hasPassword && (
            <div>
              <label htmlFor="current-password">Current password</label>
              <div className="password-field">
                <input
                  id="current-password"
                  type={showCurrent ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="Your current password"
                />
                <button type="button" className="icon-button" onClick={() => setShowCurrent((open) => !open)} aria-label={showCurrent ? 'Hide current password' : 'Show current password'}>
                  {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}
          <div>
            <label htmlFor="new-password">New password</label>
            <div className="password-field">
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                maxLength={200}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                aria-describedby="new-password-hint"
              />
              <button type="button" className="icon-button" onClick={() => setShowPassword((open) => !open)} aria-label={showPassword ? 'Hide new password' : 'Show new password'}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="password-meta" id="new-password-hint">
              <span className={password.length >= 8 ? 'is-ready' : undefined}>
                {password.length === 0 ? 'At least 8 characters' : remaining > 0 ? `${remaining} more character${remaining === 1 ? '' : 's'}` : 'Ready to save'}
              </span>
            </div>
          </div>
          <label htmlFor="confirm-password">Confirm new password
            <input
              id="confirm-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat the new password"
            />
          </label>
        </div>
        <div className="form-actions">
          <button className="button primary" disabled={savingPassword}>{savingPassword ? 'Saving…' : hasPassword ? 'Update password' : 'Set password'}</button>
        </div>
      </form>

      <section className="card profile-card" aria-labelledby="account-summary-title">
        <div className="section-heading">
          <div>
            <h2 id="account-summary-title">Account</h2>
            <p>Your role is set by an administrator. You cannot change it here.</p>
          </div>
        </div>
        <dl className="profile-meta">
          <div>
            <dt>Role</dt>
            <dd>{profile.role === 'admin' ? 'Administrator' : 'User'}</dd>
          </div>
          <div>
            <dt>Sign-in</dt>
            <dd>{signInLabel(profile)}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{joinedLabel(profile.createdAt)}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
