import { CirclePlus, CreditCard, Image, Info, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AccountIconPicker, type IconChoice } from '../../components/AccountIconPicker'
import { AccountIcon, CardArt, pastel } from '../../components/Avatars'
import { AccountSelect } from '../../components/Selects'
import { useToast } from '../../components/Toast'
import { Modal, MoneyInput } from '../../components/ui'
import { findBank } from '../../lib/banks'
import { availableLimit } from '../../lib/cards'
import { ACCOUNT_ICONS } from '../../lib/icons'
import { formatBRL } from '../../lib/money'
import { byId, useAccounts, useCardMutations, useCards, useTransactions } from '../../lib/queries'
import type { Card } from '../../lib/types'

export default function Cards() {
  const { data: cards = [] } = useCards()
  const { data: txs = [] } = useTransactions()
  const accounts = byId(useAccounts().data)
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Card | 'new' | null>(params.get('novo') ? 'new' : null)

  function close() {
    setEditing(null)
    if (params.has('novo')) setParams({}, { replace: true })
  }

  const sorted = [...cards].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <>
      <div className="settings-head">
        <h2>Cartões de crédito</h2>
        <button className="btn btn-soft" onClick={() => setEditing('new')}><CirclePlus size={16} /> Adicionar cartão</button>
      </div>
      {sorted.length === 0 ? (
        <div className="placeholder">
          <span className="ico"><CreditCard size={20} /></span>
          <h3>Nenhum cartão ainda</h3>
          <p>Adicione um cartão para lançar compras e acompanhar as faturas.</p>
        </div>
      ) : sorted.map((c) => {
        const payer = c.payment_account_id ? accounts.get(c.payment_account_id) : undefined
        const avail = availableLimit(c, txs)
        const used = c.limit_cents > 0 ? Math.min(100, Math.max(0, ((c.limit_cents - avail) / c.limit_cents) * 100)) : 0
        return (
          <div key={c.id} className="card-block" style={{ opacity: c.archived ? 0.5 : 1 }}>
            <button onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`} style={{ display: 'block' }}>
              <CardArt card={c} sub={c.archived ? 'Arquivado' : `Fecha dia ${c.closing_day} · vence dia ${c.due_day}`} />
            </button>
            <div className="stack" style={{ gap: 12 }}>
              <div className="card-limit">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted small" style={{ fontWeight: 800 }}>Limite disponível</span>
                  <b className="money">{formatBRL(avail)} <span className="muted small">de {formatBRL(c.limit_cents)}</span></b>
                </div>
                <div className="limit-bar"><div style={{ width: `${used}%`, background: pastel(c.color, 0.4) }} /></div>
                <span className="muted small" style={{ fontWeight: 700 }}>Paga com {payer?.name ?? '--'}</span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {!c.archived && <Link to={`/cartoes/${c.id}`} className="btn btn-primary">Ver fatura</Link>}
                <button className="btn" onClick={() => setEditing(c)}><Pencil size={16} /> Editar</button>
              </div>
            </div>
          </div>
        )
      })}
      {editing && <CardModal card={editing === 'new' ? undefined : editing} onClose={close} />}
    </>
  )
}

function iconLabel(icon: string): string {
  const [type, key] = icon.split(':')
  if (type === 'bank') return findBank(key)?.name ?? ''
  return ACCOUNT_ICONS[key]?.label ?? ''
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

function CardModal({ card, onClose }: { card?: Card; onClose: () => void }) {
  const { data: accounts = [] } = useAccounts()
  const { insert, update, remove } = useCardMutations()
  const toast = useToast()
  const active = accounts.filter((a) => !a.archived || a.id === card?.payment_account_id)
  const [icon, setIcon] = useState<IconChoice | null>(card ? { icon: card.icon, color: card.color } : null)
  const [picking, setPicking] = useState(false)
  const [name, setName] = useState(card?.name ?? '')
  const [limit, setLimit] = useState(card?.limit_cents ?? 0)
  const [closing, setClosing] = useState(card?.closing_day ?? 1)
  const [due, setDue] = useState(card?.due_day ?? 1)
  const [accountId, setAccountId] = useState<string | null>(card?.payment_account_id ?? active[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const busy = insert.isPending || update.isPending || remove.isPending

  if (picking) {
    return (
      <AccountIconPicker
        initial={icon}
        noun="cartão"
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
    if (!accountId) return setError('Escolha a conta de pagamento padrão.')
    const row = {
      name: name.trim(),
      icon: icon?.icon ?? 'icon:bank',
      color: icon?.color ?? '#d4d4d4',
      limit_cents: limit,
      closing_day: closing,
      due_day: due,
      payment_account_id: accountId,
    }
    try {
      if (card) await update.mutateAsync({ id: card.id, patch: row })
      else await insert.mutateAsync([{ ...row, archived: false }])
      toast(card ? 'Cartão atualizado.' : 'Cartão criado.')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function archive() {
    if (!card) return
    await update.mutateAsync({ id: card.id, patch: { archived: !card.archived } })
    toast(card.archived ? 'Cartão reativado.' : 'Cartão arquivado.')
    onClose()
  }

  async function del() {
    if (!card) return
    if (!confirm(`Excluir "${card.name}" com todas as compras e pagamentos de fatura dele? Isso não pode ser desfeito. Para só esconder o cartão, use Arquivar.`)) return
    await remove.mutateAsync(card.id)
    toast('Cartão excluído.')
    onClose()
  }

  return (
    <Modal
      title={card ? 'Editar cartão' : 'Novo cartão manual'}
      subtitle={card ? undefined : 'Preencha os dados do cartão que você deseja criar'}
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
          <label className="required" htmlFor="card-name">Nome do cartão</label>
          <input id="card-name" className="input" placeholder="Insira um nome para identificar este cartão" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!card} />
        </div>
        <div className="field">
          <label>Limite</label>
          <MoneyInput value={limit} onChange={setLimit} />
        </div>
        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label htmlFor="card-closing">Fecha dia</label>
            <select id="card-closing" className="input" value={closing} onChange={(e) => setClosing(Number(e.target.value))}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="card-due">Vence dia</label>
            <select id="card-due" className="input" value={due} onChange={(e) => setDue(Number(e.target.value))}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="row" style={{ gap: 6 }}>
            Conta de pagamento padrão
            <span title="Ao definir uma conta padrão, o valor da fatura irá contar na previsão de saldo desta conta, antes mesmo do pagamento dela. Sempre que você for efetuar um novo pagamento de fatura, é possível trocar a conta de pagamento normalmente." className="muted" style={{ display: 'flex' }}>
              <Info size={14} />
            </span>
          </label>
          <AccountSelect accounts={active} value={accountId} onChange={setAccountId} />
        </div>
        {card && (
          <div className="row" style={{ gap: 18 }}>
            <button className="link" onClick={archive} disabled={busy}>{card.archived ? 'Reativar cartão' : 'Arquivar cartão'}</button>
            <button className="link" style={{ color: 'var(--expense)' }} onClick={del} disabled={busy}>Excluir cartão</button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>{card ? 'Salvar' : 'Criar novo cartão'}</button>
      </div>
    </Modal>
  )
}
