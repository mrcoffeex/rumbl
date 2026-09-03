import { useEffect, useRef, useState } from 'react'
import { api } from './api'

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

export default function GoogleSignIn({ onToken }: { rememberMe?: boolean; onToken: (token: string) => void; onError: (message: string) => void }) {
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
