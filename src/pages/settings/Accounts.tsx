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
import { formatBRL } from '../../lib/money'
import { useAccountMutations, useAccounts, useTransactions } from '../../lib/queries'
import type { Account } from '../../lib/types'
import { tone } from '../../lib/theme'

export default function Accounts() {
  const { data: accounts = [] } = useAccounts()
  const { data: txs = [] } = useTransactions()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Account | 'new' | null>(params.get('nova') ? 'new' : null)

  function close() {
    setEditing(null)
    if (params.has('nova')) setParams({}, { replace: true })
  }

  const sorted = [...accounts].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <>
      <div className="settings-head">
        <h2>Contas</h2>
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
                ? <small className="neg-note"><AlertTriangle size={13} /> Saldo negativo</small>
                : <small>{a.archived ? 'Arquivada' : a.exclude_from_total ? 'Fora do saldo geral' : 'Conta manual'}</small>}
            </div>
          </button>
          )
        })}
        <button className="acc-new" onClick={() => setEditing('new')}><CirclePlus size={18} /> Nova conta</button>
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
      toast(account ? 'Conta atualizada.' : 'Conta criada.')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function archive() {
    if (!account) return
    await update.mutateAsync({ id: account.id, patch: { archived: !account.archived } })
    toast(account.archived ? 'Conta reativada.' : 'Conta arquivada.')
    onClose()
  }

  async function del() {
    if (!account) return
    if (!confirm(`Excluir "${account.name}" e todos os lançamentos dela? Isso não pode ser desfeito. Para só esconder a conta, use Arquivar.`)) return
    await remove.mutateAsync(account.id)
    toast('Conta excluída.')
    onClose()
  }

  return (
    <Modal
      title={account ? 'Editar conta' : 'Nova conta manual'}
      subtitle={account ? undefined : 'Preencha os dados da conta que você deseja criar'}
      onClose={onClose}
    >
      <div className="stack">
        <button className="row" style={{ flexDirection: 'column', gap: 8, margin: '0 auto' }} onClick={() => setPicking(true)}>
          {icon ? (
            <AccountIcon icon={icon.icon} color={icon.color} size={46} />
          ) : (
            <span className="avatar" style={{ width: 46, height: 46, background: 'var(--field)', border: '1px solid var(--line)' }}><Image size={18} /></span>
          )}
          <span className="muted small">{icon ? iconLabel(icon.icon) : 'Selecione um ícone'}</span>
        </button>
        <div className="field">
          <label className="required" htmlFor="acc-name">Nome da conta</label>
          <input id="acc-name" className="input" placeholder="Insira um nome para identificar esta conta" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!account} />
        </div>
        <div className="field">
          <label>{account ? 'Saldo inicial' : 'Saldo da conta'}</label>
          <MoneyInput value={balance} onChange={setBalance} />
        </div>
        <div className="row">
          <Toggle checked={exclude} onChange={setExclude} label="Não somar no Saldo Geral" />
          <span title="Marque esta opção para que o saldo desta conta não seja somado no seu Saldo Geral. O saldo continua sendo contabilizado na tela de lançamentos. Use para contas que representem seu dinheiro guardado, como Conta Poupança ou Conta Investimento." className="muted" style={{ display: 'flex' }}>
            <Info size={14} />
          </span>
        </div>
        {account && (
          <div className="row" style={{ gap: 18 }}>
            <button className="link" onClick={archive} disabled={busy}>{account.archived ? 'Reativar conta' : 'Arquivar conta'}</button>
            <button className="link" style={{ color: 'var(--expense)' }} onClick={del} disabled={busy}>Excluir conta</button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>{account ? 'Salvar' : 'Criar nova conta'}</button>
      </div>
    </Modal>
  )
}
