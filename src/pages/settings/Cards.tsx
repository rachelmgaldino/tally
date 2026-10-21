import { CirclePlus, CreditCard, Image, Info, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AccountIconPicker, type IconChoice } from '../../components/AccountIconPicker'
import { AccountIcon, CardArt, pastel } from '../../components/Avatars'
import { AccountSelect } from '../../components/Selects'
import { useToast } from '../../components/Toast'
import { Modal, MoneyInput, Segmented } from '../../components/ui'
import { findBank } from '../../lib/banks'
import { availableLimit, daysFor, invoiceFor, shiftInvoice, toMonth } from '../../lib/cards'
import { monthName, today } from '../../lib/dates'
import { ACCOUNT_ICONS } from '../../lib/icons'
import { t, locale } from '../../lib/i18n'
import { currencyOf, formatMoney, homeCurrency, isForeign, symbol } from '../../lib/money'
import { byId, useAccounts, useCardMutations, useCards, useTransactions } from '../../lib/queries'
import type { Card } from '../../lib/types'

export default function Cards() {
  const s = t().settings.cards
  const { data: cards = [] } = useCards()
  const { data: txs = [] } = useTransactions()
  const accounts = byId(useAccounts().data)
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Card | 'new' | null>(params.get('novo') ? 'new' : null)

  function close() {
    setEditing(null)
    if (params.has('novo')) setParams({}, { replace: true })
  }

  const sorted = [...cards].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, locale()))

  return (
    <>
      <div className="settings-head">
        <h2>{s.title}</h2>
        <button className="btn btn-soft" onClick={() => setEditing('new')}><CirclePlus size={16} /> {s.add}</button>
      </div>
      {sorted.length === 0 ? (
        <div className="placeholder">
          <span className="ico"><CreditCard size={20} /></span>
          <h3>{s.emptyTitle}</h3>
          <p>{s.emptyText}</p>
        </div>
      ) : sorted.map((c) => {
        const payer = c.payment_account_id ? accounts.get(c.payment_account_id) : undefined
        const avail = availableLimit(c, txs)
        const used = c.limit_cents > 0 ? Math.min(100, Math.max(0, ((c.limit_cents - avail) / c.limit_cents) * 100)) : 0
        return (
          <div key={c.id} className="card-block" style={{ opacity: c.archived ? 0.5 : 1 }}>
            <button onClick={() => setEditing(c)} aria-label={s.edit(c.name)} style={{ display: 'block' }}>
              <CardArt card={c} sub={c.archived ? s.archived : s.closesDue(c.closing_day, c.due_day)} />
            </button>
            <div className="stack" style={{ gap: 12 }}>
              <div className="card-limit">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <span className="muted small" style={{ fontWeight: 800 }}>{s.available}</span>
                  <b className="money">{formatMoney(avail, currencyOf(c))} <span className="muted small">{s.of(formatMoney(c.limit_cents, currencyOf(c)))}</span></b>
                </div>
                <div className="limit-bar"><div style={{ width: `${used}%`, background: pastel(c.color, 0.4) }} /></div>
                <span className="muted small" style={{ fontWeight: 700 }}>{s.paidWith(payer?.name ?? '--')}</span>
              </div>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                {!c.archived && <Link to={`/cartoes/${c.id}`} className="btn btn-primary">{s.seeInvoice}</Link>}
                <button className="btn" onClick={() => setEditing(c)}><Pencil size={16} /> {s.editBtn}</button>
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
  const s = t().settings.cards
  const cm = t().common
  const { data: accounts = [] } = useAccounts()
  const { insert, update, remove } = useCardMutations()
  const toast = useToast()
  const { data: txs = [] } = useTransactions()
  // A card's bill is in the currency of the account that pays it. Once it has entries, only accounts in that currency can.
  const used = !!card && txs.some((tx) => tx.card_id === card.id)
  const active = accounts.filter((a) => (!a.archived || a.id === card?.payment_account_id) && (!used || currencyOf(a) === currencyOf(card)))
  const [icon, setIcon] = useState<IconChoice | null>(card ? { icon: card.icon, color: card.color } : null)
  const [picking, setPicking] = useState(false)
  const [name, setName] = useState(card?.name ?? '')
  const [limit, setLimit] = useState(card?.limit_cents ?? 0)
  const [closing, setClosing] = useState(card?.closing_day ?? 1)
  const [due, setDue] = useState(card?.due_day ?? 1)
  // Changing the days of an existing card: right away (default) or only from the next bill.
  const current = card ? invoiceFor(card, today()) : null
  const nowDays = card && current ? daysFor(card, current) : null
  const daysChanged = !!card && (closing !== card.closing_day || due !== card.due_day)
  const [when, setWhen] = useState<'now' | 'next'>('now')
  const scheduled = card?.days_from && current && card.days_from > current ? card.days_from : null
  const [accountId, setAccountId] = useState<string | null>(card?.payment_account_id ?? active[0]?.id ?? null)
  const [error, setError] = useState<string | null>(null)
  const payer = accounts.find((a) => a.id === accountId)
  const currency = payer ? currencyOf(payer) : card ? currencyOf(card) : homeCurrency()
  const busy = insert.isPending || update.isPending || remove.isPending

  if (picking) {
    return (
      <AccountIconPicker
        initial={icon}
        card
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
    if (!accountId) return setError(s.chooseAccount)
    const row = {
      name: name.trim(),
      icon: icon?.icon ?? 'icon:bank',
      color: icon?.color ?? '#d4d4d4',
      limit_cents: limit,
      closing_day: closing,
      due_day: due,
      payment_account_id: accountId,
      currency,
      // The old days stay on the open bill; only sent when there is a change to keep or clear,
      // so cards keep saving on a database without these columns.
      ...(daysChanged && when === 'next' && nowDays && current
        ? { old_closing_day: nowDays.closing_day, old_due_day: nowDays.due_day, days_from: shiftInvoice(current, 1) }
        : daysChanged && card?.days_from
          ? { old_closing_day: null, old_due_day: null, days_from: null }
          : {}),
    }
    try {
      if (card) await update.mutateAsync({ id: card.id, patch: row })
      else await insert.mutateAsync([{ ...row, archived: false }])
      toast(card ? s.updated : s.created)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function archive() {
    if (!card) return
    await update.mutateAsync({ id: card.id, patch: { archived: !card.archived } })
    toast(card.archived ? s.reactivated : s.archivedToast)
    onClose()
  }

  async function del() {
    if (!card) return
    if (!confirm(s.deleteConfirm(card.name))) return
    await remove.mutateAsync(card.id)
    toast(s.deleted)
    onClose()
  }

  return (
    <Modal
      title={card ? s.editTitle : s.newTitle}
      subtitle={card ? undefined : s.newSubtitle}
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
          <label className="required" htmlFor="card-name">{s.name}</label>
          <input id="card-name" className="input" placeholder={s.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!card} />
        </div>
        <div className="field">
          <label>{s.limit}</label>
          <MoneyInput value={limit} onChange={setLimit} prefix={symbol(currency)} />
        </div>
        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label htmlFor="card-closing">{s.closingDay}</label>
            <select id="card-closing" className="input" value={closing} onChange={(e) => setClosing(Number(e.target.value))}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="card-due">{s.dueDay}</label>
            <select id="card-due" className="input" value={due} onChange={(e) => setDue(Number(e.target.value))}>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
        {daysChanged && current && nowDays ? (
          <div className="field days-when">
            <label>{s.daysWhen}</label>
            <Segmented value={when} onChange={setWhen} options={[['now', s.daysNow], ['next', s.daysNext]]} />
            <p className="muted small" style={{ margin: 0 }}>
              {when === 'now' ? s.daysNowNote(monthName(toMonth(current))) : s.daysNextNote(monthName(toMonth(current)), nowDays.closing_day, nowDays.due_day)}
            </p>
          </div>
        ) : scheduled && (
          <p className="muted small" style={{ margin: 0 }}><Info size={14} style={{ verticalAlign: '-2px' }} /> {s.daysScheduled(monthName(toMonth(scheduled)))}</p>
        )}
        <div className="field">
          <label className="row" style={{ gap: 6 }}>
            {s.paymentAccount}
            <span title={s.paymentAccountHelp} className="muted" style={{ display: 'flex' }}>
              <Info size={14} />
            </span>
          </label>
          <AccountSelect accounts={active} value={accountId} onChange={setAccountId} />
          {isForeign({ currency }) && <p className="field-hint"><Info size={14} />{s.cardCurrency(symbol(currency))}</p>}
        </div>
        {card && (
          <div className="row" style={{ gap: 18 }}>
            <button className="link" onClick={archive} disabled={busy}>{card.archived ? s.reactivate : s.archive}</button>
            <button className="link" style={{ color: 'var(--expense)' }} onClick={del} disabled={busy}>{s.delete}</button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>{cm.cancel}</button>
        <button className="btn btn-primary" disabled={!name.trim() || busy} onClick={save}>{card ? cm.save : s.create}</button>
      </div>
    </Modal>
  )
}
