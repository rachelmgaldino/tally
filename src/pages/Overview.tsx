import { AlertCircle, ArrowDown, ChevronLeft, ChevronRight, ArrowLeftRight, ArrowUp, CircleMinus, CirclePlus, CreditCard, Eye, EyeOff, Landmark, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountAvatar, CardArt, CategoryAvatar, pastel } from '../components/Avatars'
import { Mascot } from '../components/Sidebar'
import { useTxForm } from '../components/TxFormContext'
import { accountBalance } from '../lib/balances'
import { availableLimit, cashFlow, dueDate, invoiceFor, invoiceOf, monthKey } from '../lib/cards'
import { addMonths, currentMonth, monthEnd, monthLabel, monthStart, shortDate, today } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useTransactions } from '../lib/queries'
import type { Transaction } from '../lib/types'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia,'
  if (h < 18) return 'Boa tarde,'
  return 'Boa noite,'
}

export default function Overview({ name }: { name: string }) {
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: txs = [] } = useTransactions()
  const { data: allCards = [] } = useCards()
  const cards = allCards.filter((c) => !c.archived)
  const { open } = useTxForm()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('tally-hide-balance') === '1' } catch { return false }
  })

  function toggleHidden() {
    setHidden((h) => {
      try { localStorage.setItem('tally-hide-balance', h ? '0' : '1') } catch { /* ignore */ }
      return !h
    })
  }

  const money = (cents: number) => (hidden ? 'R$ •••••' : formatBRL(cents))
  const [m, setM] = useState(currentMonth)
  const isCurrent = monthKey(m) === monthKey(currentMonth())
  const from = monthStart(m)
  const to = monthEnd(m)
  const t = today()
  const inMonth = txs.filter((tx) => tx.date >= from && tx.date < to)
  const income = inMonth.filter((tx) => tx.kind === 'income').reduce((s, tx) => s + tx.amount_cents, 0)
  const expense = inMonth.filter((tx) => tx.kind === 'expense').reduce((s, tx) => s + tx.amount_cents, 0)

  const active = accounts.filter((a) => !a.archived)
  // Account-side money: open invoices stand in for the card purchases.
  const ledger = cashFlow(allCards, txs)
  // Today's balance; looking at another month, what the accounts hold (or should hold) when it ends.
  const balances = new Map(active.map((a) => [a.id, isCurrent ? accountBalance(a, ledger).current : accountBalance(a, ledger, to).forecast]))
  const total = active.filter((a) => !a.exclude_from_total).reduce((s, a) => s + (balances.get(a.id) ?? 0), 0)

  const categoryMap = byId(categories)
  const accountMap = byId(accounts)
  const toPay = ledger.filter((tx) => tx.kind === 'expense' && !tx.paid && tx.date < to && (tx.date >= from || tx.date < t)).sort((a, b) => a.date.localeCompare(b.date))
  const overdue = toPay.filter((tx) => tx.date < t)
  const upcomingPay = toPay.filter((tx) => tx.date >= t)
  const toReceive = ledger.filter((tx) => tx.kind === 'income' && !tx.paid && tx.date < to && (tx.date >= from || tx.date < t)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)

  const cardMap = byId(allCards)
  const billRow = (tx: Transaction, late: boolean) => {
    const c = tx.category_id ? categoryMap.get(tx.category_id) : undefined
    const parent = c?.parent_id ? categoryMap.get(c.parent_id) : undefined
    const card = tx.virtual && tx.card_id ? cardMap.get(tx.card_id) : undefined
    const where = card?.name ?? (tx.account_id ? accountMap.get(tx.account_id)?.name : '')
    const when = tx.date === t ? 'hoje' : late ? `venceu ${shortDate(tx.date).slice(0, 5)}` : shortDate(tx.date).slice(0, 5)
    return (
      <div
        key={tx.id}
        className={`bill-line ${card ? 'click' : ''}`}
        onClick={card ? () => navigate(`/cartoes/${card.id}?fatura=${tx.invoice_month!.slice(0, 7)}`) : undefined}
      >
        {card ? (
          <span className="avatar cat" style={{ width: 40, height: 40, background: 'var(--invoice)' }}><Receipt size={18} /></span>
        ) : (
          <CategoryAvatar category={parent ?? c} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800 }}>{tx.description || c?.name}</div>
          <div className={late ? 'expense small' : 'muted small'} style={{ fontWeight: 700 }}>{when}{where ? ` · ${where}` : ''}</div>
        </div>
        <span className={`money ${tx.kind === 'income' ? 'income' : late ? 'expense' : ''}`}>
          {hidden ? 'R$ •••••' : `${tx.kind === 'income' ? '+' : '−'}${formatBRL(tx.amount_cents)}`}
        </span>
      </div>
    )
  }

  // Open invoices right now, one per card.
  // The open invoices this month, or for another month the invoices due in it.
  const currentInvoices = cards.map((c) => invoiceOf(c, txs, isCurrent ? invoiceFor(c, t) : monthKey(m)))
  const invoicesTotal = currentInvoices.reduce((s, inv) => s + inv.remaining, 0)
  const incomePending = inMonth.filter((tx) => tx.kind === 'income' && !tx.paid).reduce((s, tx) => s + tx.amount_cents, 0)
  const expensePending = toPay.reduce((s, tx) => s + tx.amount_cents, 0)
  const included = active.filter((a) => !a.exclude_from_total)

  return (
    <main className="page">
      <header className="page-head">
        <div>
          <h1>{greeting()} {name}!</h1>
          <p>Seu mês até agora, num olhar só.</p>
        </div>
        <div className="head-actions">
          <div className="month-nav">
            <button onClick={() => setM(addMonths(m, -1))} aria-label="Mês anterior"><ChevronLeft size={20} /></button>
            <span>{monthLabel(m).toLowerCase()}</span>
            <button onClick={() => setM(addMonths(m, 1))} aria-label="Próximo mês"><ChevronRight size={20} /></button>
          </div>
          {!isCurrent && <button className="btn" onClick={() => setM(currentMonth())}>Hoje</button>}
          <button className="icon-btn" onClick={toggleHidden} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'} title={hidden ? 'Mostrar valores' : 'Esconder valores'}>
            {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </header>

      <section className="stats-grid" aria-label="Resumo do mês">
        <div className="card stat" style={{ background: 'var(--yellow)' }}>
          <div className="k">Saldo geral</div>
          <div className="v" style={{ fontSize: 34 }}>{money(total)}</div>
          <div className="s">{!included.length ? 'Nenhuma conta ainda' : isCurrent ? included.map((a) => a.name).join(' + ') : `no fim de ${monthLabel(m).split(' ')[0].toLowerCase()}`}</div>
          <span className="mascot"><Mascot size={72} plain /></span>
        </div>
        <div className="card stat" style={{ background: 'var(--green)' }}>
          <div className="k">Receitas do mês <span className="ico"><ArrowUp size={16} /></span></div>
          <div className="v">{money(income)}</div>
          <div className="s">{incomePending ? `${money(incomePending)} a receber` : income ? 'tudo recebido' : 'nada lançado ainda'}</div>
        </div>
        <div className="card stat" style={{ background: 'var(--pink)' }}>
          <div className="k">Despesas do mês <span className="ico"><ArrowDown size={16} /></span></div>
          <div className="v">{money(expense)}</div>
          <div className="s">{expensePending ? `${money(expensePending)} ainda a pagar` : expense ? 'tudo pago' : 'nada lançado ainda'}</div>
        </div>
        <button className="card stat" style={{ background: 'var(--lavender)' }} onClick={() => navigate(cards[0] ? `/cartoes/${cards[0].id}` : '/configuracoes/cartoes?novo=1')}>
          <div className="k">{isCurrent ? 'Faturas atuais' : `Faturas de ${monthLabel(m).split(' ')[0].toLowerCase()}`} <span className="ico"><CreditCard size={16} /></span></div>
          <div className="v">{money(invoicesTotal)}</div>
          <div className="s">
            {cards.length === 0 ? 'Adicionar cartão' : cards.length === 1 ? `vence ${shortDate(currentInvoices[0].due).slice(0, 5)}` : `${cards.length} cartões`}
          </div>
        </button>
      </section>

      <section className="quick" aria-label="Ações rápidas">
        <button className="btn btn-pink" onClick={() => open({ kind: 'expense' })}><CircleMinus size={18} /> Despesa <span className="kbd">D</span></button>
        <button className="btn" style={{ background: 'var(--green)' }} onClick={() => open({ kind: 'income' })}><CirclePlus size={18} /> Receita <span className="kbd">R</span></button>
        <button className="btn btn-blue" onClick={() => open({ kind: 'transfer' })}><ArrowLeftRight size={18} /> Transferência <span className="kbd">T</span></button>
      </section>

      <div className="ov-grid">
        <div className="stack" style={{ gap: 20 }}>
          <section className="card card-pad">
            <div className="section-title"><h3>Minhas contas</h3>{active.length > 0 && <Link to="/configuracoes/contas" className="link">Gerenciar</Link>}</div>
            {active.length === 0 ? (
              <div className="placeholder">
                <span className="ico"><Landmark size={20} /></span>
                <h3>Nenhuma conta ainda</h3>
                <p>Aqui você poderá ver todos os saldos das suas contas.</p>
                <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => navigate('/configuracoes/contas?nova=1')}>
                  <CirclePlus size={16} /> Adicionar conta
                </button>
              </div>
            ) : active.map((a) => (
              <div key={a.id} className="account-line" style={{ background: pastel(a.color, 0.82) }}>
                <AccountAvatar account={a} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{a.name}</b>
                  <div className="muted small">{a.exclude_from_total ? 'fora do saldo geral' : 'conta manual'}</div>
                </div>
                <span className="money">{money(balances.get(a.id) ?? 0)}</span>
              </div>
            ))}
          </section>

          <section className="card card-pad">
            <div className="section-title"><h3>Meus cartões</h3>{cards.length > 0 && <Link to="/configuracoes/contas#cartoes" className="link">Gerenciar</Link>}</div>
            {cards.length === 0 ? (
              <div className="placeholder">
                <span className="ico"><CreditCard size={20} /></span>
                <h3>Nenhum cartão ainda</h3>
                <p>Aqui você poderá ver as faturas dos seus cartões.</p>
                <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => navigate('/configuracoes/cartoes?novo=1')}>
                  <CirclePlus size={16} /> Adicionar cartão
                </button>
              </div>
            ) : cards.map((c) => {
              const current = invoiceFor(c, t)
              const inv = invoiceOf(c, txs, current)
              const due = dueDate(c, current)
              const avail = availableLimit(c, txs)
              const used = c.limit_cents > 0 ? Math.min(100, Math.max(0, ((c.limit_cents - avail) / c.limit_cents) * 100)) : 0
              return (
                <div key={c.id} className="card-line" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
                  <CardArt card={c} style={{ width: 180 }} />
                  <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small" style={{ fontWeight: 700 }}>Limite disponível</span><span className="money">{money(avail)}</span></div>
                    <div className="limit-bar"><div style={{ width: `${used}%`, background: pastel(c.color, 0.4) }} /></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted small" style={{ fontWeight: 700 }}>Fatura atual · vence {shortDate(due).slice(0, 5)}</span>
                      <span className="money expense">{money(inv.total)}</span>
                    </div>
                    <button className="btn" style={{ alignSelf: 'flex-start', minHeight: 38, fontSize: 14 }} onClick={() => navigate(`/cartoes/${c.id}`)}>Ver fatura</button>
                  </div>
                </div>
              )
            })}
          </section>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <section className="card card-pad">
            <div className="section-title"><h3>Contas a pagar</h3></div>
            {toPay.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nenhuma despesa pendente este mês.</p>}
            {overdue.length > 0 && <div className="overdue"><AlertCircle size={18} /> {overdue.length === 1 ? '1 atrasada' : `${overdue.length} atrasadas`}</div>}
            {overdue.map((tx) => billRow(tx, true))}
            {upcomingPay.map((tx) => billRow(tx, false))}
          </section>

          <section className="card card-pad">
            <div className="section-title"><h3>Contas a receber</h3></div>
            {toReceive.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>Nenhuma receita pendente.</p>
            ) : toReceive.map((tx) => billRow(tx, false))}
          </section>
        </div>
      </div>
    </main>
  )
}
