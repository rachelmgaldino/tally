import { AlertTriangle, CirclePlus, Image, Info, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AccountIconPicker, type IconChoice } from '../../components/AccountIconPicker'
import { AccountAvatar, AccountIcon, pastel } from '../../components/Avatars'
import { useToast } from '../../components/Toast'
import { Modal, MoneyInput, Toggle } from '../../components/ui'
import { accountBalance } from '../../lib/balances'
import { findBank } from '../../lib/banks'
import { ACCOUNT_ICONS } from '../../lib/icons'
import { t, locale } from '../../lib/i18n'
import { formatBRL } from '../../lib/money'
import { useAccountMutations, useAccounts, useTransactions } from '../../lib/queries'
import type { Account } from '../../lib/types'
import { tone } from '../../lib/theme'

export default function Accounts() {
  const s = t().settings.accounts
  const { data: accounts = [] } = useAccounts()
  const { data: txs = [] } = useTransactions()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Account | 'new' | null>(params.get('nova') ? 'new' : null)

  function close() {
    setEditing(null)
    if (params.has('nova')) setParams({}, { replace: true })
  }

  const sorted = [...accounts].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, locale()))

  return (
    <>
      <div className="settings-head">
        <h2>{s.title}</h2>
      </div>
      <div className="acc-grid">
        {sorted.map((a) => {
          const balance = accountBalance(a, txs).current
          return (
          <button key={a.id} className={`acc toned ${a.archived ? 'archived' : ''}`} style={tone(pastel(a.color, 0.7))} onClick={() => setEditing(a)}>
            <div className="top">
              <AccountAvatar account={a} />
              <b>{a.name}</b>
              <span className="icon-btn sm" aria-hidden="true"><Pencil size={15} /></span>
            </div>
            <div>
              <div className={`v ${balance < 0 ? 'expense' : ''}`}>{formatBRL(balance)}</div>
              {balance < 0 && !a.archived
                ? <small className="neg-note"><AlertTriangle size={13} /> {s.negative}</small>
                : <small>{a.archived ? s.archived : a.exclude_from_total ? s.excluded : s.manual}</small>}
            </div>
          </button>
          )
        })}
        <button className="acc-new" onClick={() => setEditing('new')}><CirclePlus size={18} /> {s.add}</button>
      </div>
      {editing && <AccountModal account={editing === 'new' ? undefined : editing} onClose={close} />}
    </>
  )
}

function iconLabel(icon: string): string {
  const [type, key] = icon.split(':')
  if (type === 'bank') return findBank(key)?.name ?? ''
  return ACCOUNT_ICONS[key]?.label ?? ''
}

function AccountModal({ account, onClose }: { account?: Account; onClose: () => void }) {
  const s = t().settings.accounts
  const cm = t().common
  const { insert, update, remove } = useAccountMutations()
  const toast = useToast()
  const [icon, setIcon] = useState<IconChoice | null>(account ? { icon: account.icon, color: account.color } : null)
  const [picking, setPicking] = useState(false)
  const [name, setName] = useState(account?.name ?? '')
  const [balance, setBalance] = useState(account?.initial_balance_cents ?? 0)
  const [exclude, setExclude] = useState(account?.exclude_from_total ?? false)
  const [error, setError] = useState<string | null>(null)
  const busy = insert.isPending || update.isPending || remove.isPending

  if (picking) {
    return (
      <AccountIconPicker
        initial={icon}
        onBack={() => setPicking(false)}
        onPick={(c) => {
          setIcon(c)
          if (!name.trim() && c.icon.startsWith('bank:')) setName(findBank(c.icon.slice(5))?.name ?? '')
          setPicking(false)
        }}
      />
    )
  }

  async function save() {
    const row = {
      name: name.trim(),
      icon: icon?.icon ?? 'icon:bank',
      color: icon?.color ?? '#d4d4d4',
      initial_balance_cents: balance,
      exclude_from_total: exclude,
    }
    try {
      if (account) await update.mutateAsync({ id: account.id, patch: row })
      else await insert.mutateAsync([{ ...row, archived: false }])
      toast(account ? s.updated : s.created)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function archive() {
    if (!account) return
    await update.mutateAsync({ id: account.id, patch: { archived: !account.archived } })
    toast(account.archived ? s.reactivated : s.archivedToast)
    onClose()
  }

  async function del() {
    if (!account) return
    if (!confirm(s.deleteConfirm(account.name))) return
    await remove.mutateAsync(account.id)
    toast(s.deleted)
    onClose()
  }

  return (
    <Modal
      title={account ? s.editTitle : s.newTitle}
      subtitle={account ? undefined : s.newSubtitle}
      onClose={onClose}
    >
      <div className="stack">
        <button className="row" style={{ flexDirection: 'column', gap: 8, margin: '0 auto' }} onClick={() => setPicking(true)}>
          {icon ? (
            <AccountIcon icon={icon.icon} color={icon.color} size={46} />
          ) : (
            <span className="avatar" style={{ width: 46, height: 46, background: 'var(--field)', border: '1px solid var(--line)' }}><Image size={18} /></span>
          )}
          <span className="muted small">{icon ? iconLabel(icon.icon) : s.pickIcon}</span>
        </button>
        <div className="field">
          <label className="required" htmlFor="acc-name">{s.name}</label>
          <input id="acc-name" className="input" placeholder={s.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!account} />
        </div>
        <div className="field">
          <label>{account ? s.initialBalance : s.balance}</label>
          <MoneyInput value={balance} onChange={setBalance} />
        </div>
        <div className="row">
          <Toggle checked={exclude} onChange={setExclude} label={s.exclude} />
          <span title={s.excludeHelp} className="muted" style={{ display: 'flex' }}>
            <Info size={14} />
          </span>
        </div>
        {account && (
          <div className="row" style={{ gap: 18 }}>
            <button className="link" onClick={archive} disabled={busy}>{account.archived ? s.reactivate : s.archive}</button>
            <button className="link" style={{ color: 'var(--expense)' }} onClick={del} disabled={busy}>{s.delete}</button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>{cm.cancel}</button>
        <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>{account ? cm.save : s.create}</button>
      </div>
    </Modal>
  )
}
