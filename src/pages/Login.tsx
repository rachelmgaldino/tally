import { useState } from 'react'
import { Mascot } from '../components/Sidebar'
import { language, t } from '../lib/i18n'
import { supabase } from '../lib/supabase'

/** Turns Supabase's sign-up errors into something a person can act on. */
function signUpError(message: string): string {
  const s = t().login
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) return s.errAlreadyRegistered
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return s.errSignupsClosed
  if (m.includes('password')) return s.errPassword
  if (m.includes('rate limit')) return s.errRateLimit
  return s.errSignup
}

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const signingUp = mode === 'signup'
  const s = t().login

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (signingUp) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // The account starts in the language of the screen it was made on.
        options: { data: { name: name.trim(), prefs: { language: language() } }, emailRedirectTo: window.location.origin },
      })
      setBusy(false)
      if (error) setError(signUpError(error.message))
      // No session means the project asks people to confirm their e-mail first.
      else if (!data.session) setSentTo(email.trim())
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message.toLowerCase().includes('not confirmed') ? s.errNotConfirmed : s.errWrong)
  }

  function switchTo(next: 'login' | 'signup') {
    setMode(next)
    setError(null)
    setSentTo(null)
  }

  if (sentTo) {
    return (
      <div className="login">
        <div className="card stack">
          <div className="logo"><Mascot size={52} />tally</div>
          <h2 className="login-title">{s.checkEmail}</h2>
          <p className="login-note">{s.sentTo} <b>{sentTo}</b>{s.sentToAfter}</p>
          <button className="btn btn-outline" onClick={() => switchTo('login')}>{s.backToLogin}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <div className="logo"><Mascot size={52} />tally</div>
        {signingUp && <h2 className="login-title">{s.createAccount}</h2>}
        {signingUp && (
          <div className="field">
            <label htmlFor="name">{s.name}</label>
            <input id="name" className="input" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{s.email}</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">{s.password}</label>
          <input
            id="password" className="input" type="password" minLength={signingUp ? 6 : undefined}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />
          {signingUp && <small className="muted">{s.passwordHint}</small>}
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>
          {signingUp ? (busy ? s.creating : s.createAccount) : (busy ? s.signingIn : s.signIn)}
        </button>
        <p className="login-switch">
          {signingUp ? s.haveAccount : s.noAccount}
          <button type="button" className="link" onClick={() => switchTo(signingUp ? 'login' : 'signup')}>
            {signingUp ? s.signIn : s.createAccount}
          </button>
        </p>
      </form>
    </div>
  )
}
