import { ChevronLeft, Eye, EyeOff, Lock, Mail, User } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Mascot } from '../components/Sidebar'
import { language, t, type Language } from '../lib/i18n'
import { formatCents } from '../lib/money'
import { supabase } from '../lib/supabase'
import { tone } from '../lib/theme'
import { DEMO_URL, LanguageSwitch, WavingMascot } from './Landing'

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

/** Sign in at /entrar and create an account at /criar-conta, one screen with two tabs. */
export default function Login({ onLanguage }: { onLanguage: (lang: Language) => void }) {
  const signingUp = useLocation().pathname === '/criar-conta'
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
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
    setError(null)
    setSentTo(null)
    navigate(next === 'signup' ? '/criar-conta' : '/entrar', { replace: true })
  }

  return (
    <div className="auth">
      <aside className="auth-side toned" style={tone('var(--lavender)')}>
        <Link to="/" className="auth-back"><ChevronLeft size={20} /><Mascot size={36} /><span>tally</span></Link>
        <div className="auth-art" aria-hidden="true">
          <div className="auth-art-balance toned" style={tone('var(--yellow)')}>
            <div className="lp-art-label">{t().landing.balance}</div>
            <div className="money lp-art-amount">R$ {formatCents(1248035)}</div>
          </div>
          <span className="lp-pill auth-art-salary toned" style={tone('var(--green)')}><span className="money income">+{formatCents(850000)}</span> {s.salaryChip}</span>
          <span className="lp-pill auth-art-bill toned" style={tone('var(--pink)')}>{s.billChip}</span>
          <div className="auth-art-hello">
            <WavingMascot size={116} />
            <div className="lp-bubble">{signingUp ? s.bubbleNew : s.bubbleBack}</div>
          </div>
        </div>
        <div className="auth-side-text">
          <h1>{signingUp ? s.headlineNew : s.headlineBack}</h1>
          <p>{signingUp ? s.sublineNew : s.sublineBack}</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-lang"><LanguageSwitch onChange={onLanguage} /></div>
        {sentTo ? (
          <div className="auth-form">
            <h2>{s.checkEmail}</h2>
            <p className="auth-sub">{s.sentTo} <b>{sentTo}</b>{s.sentToAfter}</p>
            <button className="btn" onClick={() => switchTo('login')}>{s.backToLogin}</button>
          </div>
        ) : (
          <form className="auth-form" onSubmit={submit}>
            <div className="auth-tabs" role="tablist" aria-label={`${s.signIn} / ${s.createAccount}`}>
              <button type="button" role="tab" aria-selected={!signingUp} className={signingUp ? '' : 'on'} onClick={() => switchTo('login')}>{s.signIn}</button>
              <button type="button" role="tab" aria-selected={signingUp} className={signingUp ? 'on' : ''} onClick={() => switchTo('signup')}>{s.createAccount}</button>
            </div>
            <div className="auth-title">
              <h2>{signingUp ? s.titleNew : s.titleBack}</h2>
              <p className="auth-sub">{signingUp ? s.subNew : s.subBack}</p>
            </div>
            {signingUp && (
              <div className="field">
                <label htmlFor="name">{s.nameQuestion}</label>
                <div className="input"><User size={18} className="auth-ico" />
                  <input id="name" autoComplete="given-name" placeholder={s.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor="email">{s.email}</label>
              <div className="input"><Mail size={18} className="auth-ico" />
                <input id="email" type="email" autoComplete="email" placeholder={s.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="field">
              <label htmlFor="password">{s.password}</label>
              <div className="input"><Lock size={18} className="auth-ico" />
                <input
                  id="password" type={showPassword ? 'text' : 'password'} minLength={signingUp ? 6 : undefined}
                  autoComplete={signingUp ? 'new-password' : 'current-password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                />
                <button type="button" className="auth-eye" aria-label={showPassword ? s.hidePassword : s.showPassword}
                  aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {signingUp && <small className="muted">{s.passwordHint}</small>}
            </div>
            {error && <div className="error">{error}</div>}
            <button className="btn btn-primary auth-submit" disabled={busy}>
              {signingUp ? (busy ? s.creating : s.createAccount) : (busy ? s.signingIn : s.signIn)}
            </button>
            <div className="auth-or"><span />{s.or}<span /></div>
            <a className="btn auth-demo toned" href={DEMO_URL}><Eye size={20} /> {s.seeDemo}</a>
          </form>
        )}
      </main>
    </div>
  )
}
