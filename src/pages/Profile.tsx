import { Camera } from 'lucide-react'
import { useRef, useState } from 'react'
import { UserAvatar } from '../components/Avatars'
import { useToast } from '../components/Toast'
import { Modal } from '../components/ui'
import { DEMO } from '../lib/config'
import { removeAvatar, uploadAvatar, useProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'

export default function Profile({ name, email }: { name: string; email: string }) {
  const [editing, setEditing] = useState<'name' | 'password' | null>(null)
  return (
    <main className="page page-narrow">
      <header className="page-head"><h1>Meu perfil</h1></header>
      <div className="card card-pad" style={{ textAlign: 'center', padding: '40px 24px', maxWidth: 520 }}>
        <AvatarPicker />
        <h2 style={{ fontSize: 28, marginTop: 18 }}>{name}</h2>
        <div className="muted" style={{ marginTop: 4 }}>{email}</div>
        <div className="row" style={{ justifyContent: 'center', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => setEditing('name')}>Editar perfil</button>
          <button className="btn" onClick={() => setEditing('password')}>Alterar senha</button>
        </div>
      </div>
      {editing === 'name' && <NameModal current={name} onClose={() => setEditing(null)} />}
      {editing === 'password' && <PasswordModal onClose={() => setEditing(null)} />}
    </main>
  )
}

function AvatarPicker() {
  const { avatarPath, setAvatarPath } = useProfile()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      setAvatarPath(await uploadAvatar(file, avatarPath))
      toast('Foto atualizada.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para salvar a foto.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    if (!avatarPath) return
    setBusy(true)
    try {
      await removeAvatar(avatarPath)
      setAvatarPath(null)
      toast('Foto removida.')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Não deu para remover a foto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="avatar-picker">
      <button className="avatar-edit" onClick={() => input.current?.click()} disabled={busy} aria-label={avatarPath ? 'Trocar foto' : 'Adicionar foto'} title={avatarPath ? 'Trocar foto' : 'Adicionar foto'}>
        <UserAvatar size={96} fontSize={44} />
        <span className="cam"><Camera size={16} /></span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {avatarPath && <button className="link" onClick={remove} disabled={busy}>Remover foto</button>}
    </div>
  )
}

function NameModal({ current, onClose }: { current: string; onClose: () => void }) {
  const toast = useToast()
  const [name, setName] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const { error } = DEMO ? { error: null } : await supabase.auth.updateUser({ data: { name: name.trim() } })
    setBusy(false)
    if (error) return setError(error.message)
    toast('Perfil atualizado.')
    onClose()
  }

  return (
    <Modal title="Editar perfil" onClose={onClose}>
      <div className="field">
        <label htmlFor="profile-name">Nome</label>
        <input id="profile-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>Salvar</button>
      </div>
    </Modal>
  )
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não conferem.')
    setBusy(true)
    const { error } = DEMO ? { error: null } : await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    toast('Senha alterada.')
    onClose()
  }

  return (
    <Modal title="Alterar senha" onClose={onClose}>
      <div className="stack">
        <div className="field">
          <label htmlFor="new-password">Nova senha</label>
          <input id="new-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirme a nova senha</label>
          <input id="confirm-password" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!password || busy} onClick={save}>Alterar senha</button>
      </div>
    </Modal>
  )
}
