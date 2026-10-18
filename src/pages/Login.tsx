import { useState } from 'react'
import { Mascot } from '../components/Sidebar'
import { supabase } from '../lib/supabase'

/** Turns Supabase's sign-up errors into something a person can act on. */
function signUpError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered') || m.includes('already been registered')) return 'Já existe uma conta com esse e-mail. Tente entrar.'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'Novos cadastros estão fechados no momento.'
  if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.'
  if (m.includes('rate limit')) return 'Muitas tentativas. Espere um pouco e tente de novo.'
  return 'Não deu para criar a conta. Tente de novo.'
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

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (signingUp) {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { name: name.trim() }, emailRedirectTo: window.location.origin },
      })
      setBusy(false)
      if (error) setError(signUpError(error.message))
      // No session means the project asks people to confirm their e-mail first.
      else if (!data.session) setSentTo(email.trim())
      return
    }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) setError(error.message.toLowerCase().includes('not confirmed') ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : 'E-mail ou senha incorretos.')
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
          <h2 className="login-title">Confira seu e-mail</h2>
          <p className="login-note">Enviamos um link de confirmação para <b>{sentTo}</b>. Abra o e-mail e toque no link para ativar sua conta.</p>
          <button className="btn btn-outline" onClick={() => switchTo('login')}>Voltar para o login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="login">
      <form className="card stack" onSubmit={submit}>
        <div className="logo"><Mascot size={52} />tally</div>
        {signingUp && <h2 className="login-title">Criar conta</h2>}
        {signingUp && (
          <div className="field">
            <label htmlFor="name">Nome</label>
            <input id="name" className="input" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password" className="input" type="password" minLength={signingUp ? 6 : undefined}
            autoComplete={signingUp ? 'new-password' : 'current-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />
          {signingUp && <small className="muted">Pelo menos 6 caracteres.</small>}
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" disabled={busy}>
          {signingUp ? (busy ? 'Criando…' : 'Criar conta') : (busy ? 'Entrando…' : 'Entrar')}
        </button>
        <p className="login-switch">
          {signingUp ? 'Já tem conta? ' : 'Ainda não tem conta? '}
          <button type="button" className="link" onClick={() => switchTo(signingUp ? 'login' : 'signup')}>
            {signingUp ? 'Entrar' : 'Criar conta'}
          </button>
        </p>
      </form>
    </div>
  )
}
