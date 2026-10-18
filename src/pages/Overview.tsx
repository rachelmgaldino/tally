import { AlertCircle, ArrowDown, Check, ChevronLeft, ChevronRight, ArrowLeftRight, ArrowUp, CircleMinus, CirclePlus, CreditCard, Eye, EyeOff, Landmark, Receipt, ThumbsDown } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountAvatar, CardArt, CategoryAvatar, pastel } from '../components/Avatars'
import { Mascot } from '../components/Sidebar'
import { TransactionPanel } from '../components/TransactionPanel'
import { useTxForm } from '../components/TxFormContext'
import { usePrefs } from '../lib/prefs'
import { accountBalance } from '../lib/balances'
import { availableLimit, cashFlow, dueDate, invoiceFor, invoiceOf, monthKey, toMonth } from '../lib/cards'
import { addDays, addMonths, currentMonth, monthEnd, monthLabel, monthStart, shortDate, today } from '../lib/dates'
import { formatBRL, formatCents } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useTransactionMutations, useTransactions } from '../lib/queries'
import type { Transaction } from '../lib/types'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia,'
  if (h < 18) return 'Boa tarde,'
  return 'Boa noite,'
}

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
/** "sábado, 18 de outubro" */
function todayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} de ${MONTHS[m - 1]}`
}

export default function Overview({ name }: { name: string }) {
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: txs = [] } = useTransactions()
  const { data: allCards = [] } = useCards()
  const cards = allCards.filter((c) => !c.archived)
  const { open } = useTxForm()
  const { update } = useTransactionMutations()
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
  const { prefs, setPrefs } = usePrefs()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = selectedId ? txs.find((tx) => tx.id === selectedId) : undefined
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

  const cardMap = byId(allCards)

  // Open invoices right now, one per card.
  // The open invoices this month, or for another month the invoices due in it.
  const currentInvoices = cards.map((c) => invoiceOf(c, txs, isCurrent ? invoiceFor(c, t) : monthKey(m)))
  const invoicesTotal = currentInvoices.reduce((s, inv) => s + inv.remaining, 0)
  const incomePending = inMonth.filter((tx) => tx.kind === 'income' && !tx.paid).reduce((s, tx) => s + tx.amount_cents, 0)
  const expensePending = toPay.reduce((s, tx) => s + tx.amount_cents, 0)
  const included = active.filter((a) => !a.exclude_from_total)

  // Próximos: unpaid bills and incomes in the next 7, 14 or 30 days (a saved choice); another month shows that month.
  const horizon = addDays(t, prefs.nextDays)
  const upcoming = ledger
    .filter((tx) => (tx.kind === 'expense' || tx.kind === 'income') && !tx.paid && (isCurrent ? tx.date >= t && tx.date <= horizon : tx.date >= from && tx.date < to))
    .sort((a, b) => a.date.localeCompare(b.date))
  const nextHead = (
    <div className="section-title next-head">
      <h3>Próximos</h3>
      {isCurrent && (
        <div className="segmented days-pick" role="group" aria-label="Período de Próximos">
          {([7, 14, 30] as const).map((n) => (
            <button key={n} className={prefs.nextDays === n ? 'on' : ''} aria-pressed={prefs.nextDays === n} onClick={() => setPrefs({ nextDays: n }).catch(() => {})}>{n} dias</button>
          ))}
        </div>
      )}
      <Link to="/lancamentos" className="link">Ver tudo</Link>
    </div>
  )
  const nothingNext = isCurrent
    ? `Nada para pagar ou receber nos próximos ${prefs.nextDays} dias.`
    : 'Nada pendente neste mês.'
  const kept = active.filter((a) => a.exclude_from_total)
  const keptTotal = kept.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0)
  const entryName = (tx: Transaction) => {
    const card = tx.virtual && tx.card_id ? cardMap.get(tx.card_id) : undefined
    if (card) return `Fatura ${card.name} ${monthLabel(toMonth(tx.invoice_month!)).split(' ')[0].toLowerCase()}`
    return tx.description || (tx.category_id ? categoryMap.get(tx.category_id)?.name : '') || 'Sem descrição'
  }
  const settle = (tx: Transaction) => {
    if (tx.virtual && tx.card_id) open({ kind: 'payment', cardId: tx.card_id, invoiceMonth: tx.invoice_month! })
    else update.mutate({ id: tx.id, patch: { paid: true } })
  }
  // A card bill opens its invoice; anything else opens the entry's details.
  const show = (tx: Transaction) => {
    if (tx.virtual && tx.card_id) navigate(`/cartoes/${tx.card_id}?fatura=${tx.invoice_month!.slice(0, 7)}`)
    else setSelectedId(tx.id)
  }
  const nextRow = (tx: Transaction, late = false) => {
    const c = tx.category_id ? categoryMap.get(tx.category_id) : undefined
    const parent = c?.parent_id ? categoryMap.get(c.parent_id) : undefined
    const card = tx.virtual && tx.card_id ? cardMap.get(tx.card_id) : undefined
    const when = tx.date === t ? 'hoje' : late ? `venceu ${shortDate(tx.date).slice(0, 5)}` : card ? `vence ${shortDate(tx.date).slice(0, 5)}` : shortDate(tx.date).slice(0, 5)
    const where = card ? '' : tx.account_id ? accountMap.get(tx.account_id)?.name : ''
    return (
      <div key={tx.id} className={`ph-next-row ${tx.id === selectedId ? 'selected' : ''}`} role="button" tabIndex={0}
        onClick={() => show(tx)} onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) show(tx) }}>
        {card ? (
          <span className="avatar cat" style={{ width: 40, height: 40, background: 'var(--invoice)' }}><Receipt size={18} /></span>
        ) : (
          <CategoryAvatar category={parent ?? c} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{entryName(tx)}</b>
          <small className={late ? 'expense' : ''}>{when}{where ? ` · ${where}` : ''}</small>
        </div>
        <span className={`money ${tx.kind === 'income' ? 'income' : 'expense'}`}>
          {hidden ? '•••••' : `${tx.kind === 'income' ? '+' : '−'}${formatCents(tx.amount_cents)}`}
        </span>
        <button className="paid-btn pending" onClick={(e) => { e.stopPropagation(); settle(tx) }} aria-label={card ? 'Pagar fatura' : 'Marcar como pago'} title={card ? 'Pagar fatura' : 'Marcar como pago'}>
          <ThumbsDown size={18} style={{ transform: 'scaleX(-1)' }} />
        </button>
      </div>
    )
  }

  return (
    <main className="page ov-page">
      <header className="ph-head phone-only">
        <Mascot size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1>{greeting()} {name}!</h1>
          <small>{todayLabel(t)}</small>
        </div>
        <button className="icon-btn" onClick={toggleHidden} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'}>
          {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </header>
      <div className="ph-month phone-only">
        <div className="month-nav">
          <button onClick={() => setM(addMonths(m, -1))} aria-label="Mês anterior"><ChevronLeft size={20} /></button>
          <span>{monthLabel(m).toLowerCase()}</span>
          <button onClick={() => setM(addMonths(m, 1))} aria-label="Próximo mês"><ChevronRight size={20} /></button>
        </div>
        {!isCurrent && <button className="btn" onClick={() => setM(currentMonth())}>Hoje</button>}
      </div>

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

      <section className="stats-grid stats" aria-label="Resumo do mês">
        <div className="card stat hero" style={{ background: 'var(--yellow)' }}>
          <div className="hero-in">
            <div className="k">Saldo geral</div>
            <div className={`v ${!hidden && total < 0 ? 'expense' : ''}`} style={{ fontSize: 34 }}>{money(total)}</div>
            <div className="s">{!included.length ? 'Nenhuma conta ainda' : isCurrent ? included.map((a) => a.name).join(' + ') : `no fim de ${monthLabel(m).split(' ')[0].toLowerCase()}`}</div>
            <div className="hero-pills">
              <span><ArrowUp size={14} className="income" /><b className="money income">{hidden ? '•••••' : `+${formatCents(income)}`}</b></span>
              <span><ArrowDown size={14} className="expense" /><b className="money expense">{hidden ? '•••••' : `−${formatCents(expense)}`}</b></span>
            </div>
          </div>
          <span className="mascot"><Mascot size={72} plain /></span>
        </div>
        <div className="stats-rest">
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
        </div>
      </section>

      {(active.length === 0 || txs.length === 0) && <Welcome hasAccount={active.length > 0} hasCard={cards.length > 0} hasEntry={txs.length > 0} />}

      <div className="ph-home phone-only">
        <section className="ph-tiles" aria-label="Resumo">
          <button className="ph-tile" style={{ background: 'var(--lavender)' }} onClick={() => navigate(cards[0] ? `/cartoes/${cards[0].id}` : '/configuracoes/cartoes?novo=1')}>
            <span>Faturas</span><b>{money(invoicesTotal)}</b>
            <small>{cards.length === 0 ? 'adicionar cartão' : cards.length === 1 ? `vence ${shortDate(currentInvoices[0].due).slice(0, 5)}` : `${cards.length} cartões`}</small>
          </button>
          <Link className="ph-tile" to="/lancamentos" style={{ background: 'var(--pink)' }}>
            <span>A pagar</span><b>{money(expensePending)}</b>
            <small>{toPay.length === 0 ? 'nada pendente' : toPay.length === 1 ? '1 despesa' : `${toPay.length} despesas`}</small>
          </Link>
          <Link className="ph-tile" to="/lancamentos" style={{ background: 'var(--green)' }}>
            <span>A receber</span><b>{money(incomePending)}</b>
            <small>{incomePending ? 'ainda neste mês' : income ? 'tudo recebido' : 'nada lançado'}</small>
          </Link>
          {kept.length > 0 && (
            <Link className="ph-tile" to="/configuracoes/contas" style={{ background: 'var(--sand)' }}>
              <span>{kept.length === 1 ? kept[0].name : 'Guardado'}</span><b>{money(keptTotal)}</b>
              <small>fora do saldo geral</small>
            </Link>
          )}
        </section>

        {overdue.length > 0 && (
          <div className="ph-alert" role="alert">
            <AlertCircle size={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{overdue.length === 1 ? entryName(overdue[0]) : `${overdue.length} contas atrasadas`}</b>
              <small>{overdue.length === 1 ? `atrasada · venceu ${shortDate(overdue[0].date).slice(0, 5)} · ` : ''}{money(overdue.reduce((s, tx) => s + tx.amount_cents, 0))}</small>
            </div>
            {overdue.length === 1
              ? <button className="btn" onClick={() => settle(overdue[0])}>Pagar</button>
              : <Link className="btn" to="/lancamentos">Ver</Link>}
          </div>
        )}

        <section className="card card-pad" aria-label="Próximos">
          {nextHead}
          {upcoming.length === 0 ? <AllClear text={nothingNext} /> : upcoming.map((tx) => nextRow(tx))}
        </section>

        <section className="card card-pad" aria-label="Minhas contas">
          <div className="section-title"><h3>Minhas contas</h3><Link to="/configuracoes/contas" className="link">{active.length ? 'Gerenciar' : 'Adicionar'}</Link></div>
          {active.length === 0 ? <p className="muted small" style={{ margin: 0 }}>Nenhuma conta ainda.</p> : active.map((a) => (
            <div key={a.id} className="account-line" style={{ background: pastel(a.color, 0.82) }}>
              <AccountAvatar account={a} />
              <b style={{ flex: 1, minWidth: 0 }}>{a.name}</b>
              <span className={`money ${!hidden && (balances.get(a.id) ?? 0) < 0 ? 'expense' : ''}`}>{money(balances.get(a.id) ?? 0)}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="quick" aria-label="Ações rápidas">
        <button className="btn btn-pink" onClick={() => open({ kind: 'expense' })}><CircleMinus size={18} /> Despesa <span className="kbd">D</span></button>
        <button className="btn" style={{ background: 'var(--green)' }} onClick={() => open({ kind: 'income' })}><CirclePlus size={18} /> Receita <span className="kbd">R</span></button>
        <button className="btn btn-blue" onClick={() => open({ kind: 'transfer' })}><ArrowLeftRight size={18} /> Transferência <span className="kbd">T</span></button>
      </section>

      <div className="ov-grid">
          <section className="card card-pad" aria-label="Próximos">
            {nextHead}
            {overdue.length > 0 && <div className="overdue"><AlertCircle size={18} /> {overdue.length === 1 ? '1 atrasada' : `${overdue.length} atrasadas`}</div>}
            {overdue.map((tx) => nextRow(tx, true))}
            {upcoming.length === 0 && overdue.length === 0 ? <AllClear text={nothingNext} /> : upcoming.map((tx) => nextRow(tx))}
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
          <section className="card card-pad ov-wide">
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
            ) : <div className="acc-tiles">{active.map((a) => (
              <div key={a.id} className="account-line" style={{ background: pastel(a.color, 0.82) }}>
                <AccountAvatar account={a} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{a.name}</b>
                  <div className="muted small">{a.exclude_from_total ? 'fora do saldo geral' : 'conta manual'}</div>
                </div>
                <span className={`money ${!hidden && (balances.get(a.id) ?? 0) < 0 ? 'expense' : ''}`}>{money(balances.get(a.id) ?? 0)}</span>
              </div>
            ))}</div>}
          </section>
      </div>
      {selected && <TransactionPanel tx={selected} onClose={() => setSelectedId(null)} onNavigate={setSelectedId} />}
    </main>
  )
}

/** Nothing waiting to be paid or received: the coin says so. */
function AllClear({ text }: { text: string }) {
  return (
    <div className="all-clear">
      <Mascot size={52} />
      <div><b>Tudo em dia!</b><small>{text}</small></div>
    </div>
  )
}

/** First login: three steps to get going, ticked off as they're done. */
function Welcome({ hasAccount, hasCard, hasEntry }: { hasAccount: boolean; hasCard: boolean; hasEntry: boolean }) {
  const navigate = useNavigate()
  const { open } = useTxForm()
  const steps = [
    { done: hasAccount, title: 'Crie sua primeira conta', text: 'O banco onde seu dinheiro fica, com o saldo de hoje.', action: () => navigate('/configuracoes/contas?nova=1'), label: 'Criar conta' },
    { done: hasCard, title: 'Adicione um cartão', text: 'Se você usa cartão de crédito. Dá pra pular.', action: () => navigate('/configuracoes/cartoes?novo=1'), label: 'Adicionar cartão' },
    { done: hasEntry, title: 'Lance o primeiro gasto', text: 'Pode ser o café de hoje.', action: () => open({ kind: 'expense' }), label: 'Novo lançamento', locked: !hasAccount },
  ]
  return (
    <section className="card welcome" aria-label="Primeiros passos">
      <div className="welcome-head">
        <Mascot size={64} />
        <div><h2>Que bom ter você aqui!</h2><p>Três passos e o Tally já começa a contar pra você.</p></div>
      </div>
      <ol className="welcome-steps">
        {steps.map((st, i) => (
          <li key={st.title} className={st.done ? 'done' : ''}>
            <span className="num">{st.done ? <Check size={18} strokeWidth={3} /> : i + 1}</span>
            <div><b>{st.title}</b><small>{st.text}</small></div>
            {!st.done && <button className={`btn ${i === steps.findIndex((x) => !x.done) ? 'btn-primary' : ''}`} onClick={st.action} disabled={st.locked}>{st.label}</button>}
          </li>
        ))}
      </ol>
    </section>
  )
}
