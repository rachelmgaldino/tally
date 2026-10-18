import { Camera } from 'lucide-react'
import { useRef, useState } from 'react'
import { UserAvatar } from '../components/Avatars'
import { BackToMore } from '../components/ui'
import { useToast } from '../components/Toast'
import { Modal } from '../components/ui'
import { DEMO } from '../lib/config'
import { t } from '../lib/i18n'
import { removeAvatar, uploadAvatar, useProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'

export default function Profile({ name, email }: { name: string; email: string }) {
  const [editing, setEditing] = useState<'name' | 'password' | null>(null)
  const s = t().settings.profile
  return (
    <main className="page">
      <BackToMore />
      <header className="page-head"><h1>{t().common.nav.myProfile}</h1></header>
      <div className="card card-pad profile-card">
        <AvatarPicker />
        <div className="profile-who">
          <h2>{name}</h2>
          <div className="muted">{email}</div>
        </div>
        <div className="row profile-acts">
          <button className="btn" onClick={() => setEditing('name')}>{s.editProfile}</button>
          <button className="btn" onClick={() => setEditing('password')}>{s.changePassword}</button>
        </div>
      </div>
      {editing === 'name' && <NameModal current={name} onClose={() => setEditing(null)} />}
      {editing === 'password' && <PasswordModal onClose={() => setEditing(null)} />}
    </main>
  )
}

function AvatarPicker() {
  const s = t().settings.profile
  const { avatarPath, setAvatarPath } = useProfile()
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      setAvatarPath(await uploadAvatar(file, avatarPath))
      toast(s.photoUpdated)
    } catch (e) {
      toast(e instanceof Error ? e.message : s.photoSaveFailed)
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
      toast(s.photoRemoved)
    } catch (e) {
      toast(e instanceof Error ? e.message : s.photoRemoveFailed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="avatar-picker">
      <button className="avatar-edit" onClick={() => input.current?.click()} disabled={busy} aria-label={avatarPath ? s.changePhoto : s.addPhoto} title={avatarPath ? s.changePhoto : s.addPhoto}>
        <UserAvatar size={96} fontSize={44} />
        <span className="cam"><Camera size={16} /></span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {avatarPath && <button className="link" onClick={remove} disabled={busy}>{s.removePhoto}</button>}
    </div>
  )
}

function NameModal({ current, onClose }: { current: string; onClose: () => void }) {
  const s = t().settings.profile
  const cm = t().common
  const toast = useToast()
  const [name, setName] = useState(current)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const { error } = DEMO ? { error: null } : await supabase.auth.updateUser({ data: { name: name.trim() } })
    setBusy(false)
    if (error) return setError(error.message)
    toast(s.profileUpdated)
    onClose()
  }

  return (
    <Modal title={s.editProfile} onClose={onClose}>
      <div className="field">
        <label htmlFor="profile-name">{s.name}</label>
        <input id="profile-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      {error && <div className="error" style={{ marginTop: 10 }}>{error}</div>}
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>{cm.cancel}</button>
        <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>{cm.save}</button>
      </div>
    </Modal>
  )
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const s = t().settings.profile
  const cm = t().common
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (password.length < 6) return setError(s.passwordTooShort)
    if (password !== confirm) return setError(s.passwordMismatch)
    setBusy(true)
    const { error } = DEMO ? { error: null } : await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return setError(error.message)
    toast(s.passwordChanged)
    onClose()
  }

  return (
    <Modal title={s.changePassword} onClose={onClose}>
      <div className="stack">
        <div className="field">
          <label htmlFor="new-password">{s.newPassword}</label>
          <input id="new-password" className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">{s.confirmPassword}</label>
          <input id="confirm-password" className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>{cm.cancel}</button>
        <button className="btn btn-primary" disabled={!password || busy} onClick={save}>{s.changePassword}</button>
      </div>
    </Modal>
  )
}
