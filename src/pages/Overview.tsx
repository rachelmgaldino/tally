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
import { addDays, addMonths, currentMonth, dayMonth, monthEnd, monthName, monthStart, monthTitle, today, weekdayDate } from '../lib/dates'
import { t as text } from '../lib/i18n'
import { formatBRL, formatCents } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useTransactionMutations, useTransactions } from '../lib/queries'
import type { Transaction } from '../lib/types'
import { tone } from '../lib/theme'

function greeting() {
  const s = text().overview
  const h = new Date().getHours()
  if (h < 12) return s.morning
  if (h < 18) return s.afternoon
  return s.evening
}

export default function Overview({ name }: { name: string }) {
  const s = text().overview
  const { data: accounts = [], isSuccess: accountsLoaded } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: txs = [], isSuccess: txsLoaded } = useTransactions()
  const { data: allCards = [], isSuccess: cardsLoaded } = useCards()
  // Until the data arrives the lists are empty, which would look like a brand-new user.
  const loaded = accountsLoaded && txsLoaded && cardsLoaded
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
      <h3>{s.next}</h3>
      {isCurrent && (
        <div className="segmented days-pick" role="group" aria-label={s.nextPeriod}>
          {([7, 14, 30] as const).map((n) => (
            <button key={n} className={prefs.nextDays === n ? 'on' : ''} aria-pressed={prefs.nextDays === n} onClick={() => setPrefs({ nextDays: n }).catch(() => {})}>{s.days(n)}</button>
          ))}
        </div>
      )}
      <Link to="/lancamentos" className="link">{s.seeAll}</Link>
    </div>
  )
  const nothingNext = isCurrent
    ? s.nothingNext(prefs.nextDays)
    : s.nothingThisMonth
  const kept = active.filter((a) => a.exclude_from_total)
  const keptTotal = kept.reduce((s, a) => s + (balances.get(a.id) ?? 0), 0)
  const entryName = (tx: Transaction) => {
    const card = tx.virtual && tx.card_id ? cardMap.get(tx.card_id) : undefined
    if (card) return s.cardInvoice(card.name, monthName(toMonth(tx.invoice_month!)))
    return tx.description || (tx.category_id ? categoryMap.get(tx.category_id)?.name : '') || text().common.noDescription
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
    const when = tx.date === t ? s.today : late ? s.wasDue(dayMonth(tx.date)) : card ? s.due(dayMonth(tx.date)) : dayMonth(tx.date)
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
        <button className="paid-btn pending" onClick={(e) => { e.stopPropagation(); settle(tx) }} aria-label={card ? s.payInvoice : s.markPaid} title={card ? s.payInvoice : s.markPaid}>
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
          <h1>{s.greeting(greeting(), name)}</h1>
          <small>{weekdayDate(t)}</small>
        </div>
        <button className="icon-btn" onClick={toggleHidden} aria-label={hidden ? s.showValues : s.hideValues}>
          {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      </header>
      <div className="ph-month phone-only">
        <div className="month-nav">
          <button onClick={() => setM(addMonths(m, -1))} aria-label={text().common.prevMonth}><ChevronLeft size={20} /></button>
          <span>{monthTitle(m)}</span>
          <button onClick={() => setM(addMonths(m, 1))} aria-label={text().common.nextMonth}><ChevronRight size={20} /></button>
        </div>
        {!isCurrent && <button className="btn" onClick={() => setM(currentMonth())}>{text().common.today}</button>}
      </div>

      <header className="page-head">
        <div>
          <h1>{s.greeting(greeting(), name)}</h1>
          <p>{s.subtitle}</p>
        </div>
        <div className="head-actions">
          <div className="month-nav">
            <button onClick={() => setM(addMonths(m, -1))} aria-label={text().common.prevMonth}><ChevronLeft size={20} /></button>
            <span>{monthTitle(m)}</span>
            <button onClick={() => setM(addMonths(m, 1))} aria-label={text().common.nextMonth}><ChevronRight size={20} /></button>
          </div>
          {!isCurrent && <button className="btn" onClick={() => setM(currentMonth())}>{text().common.today}</button>}
          <button className="icon-btn" onClick={toggleHidden} aria-label={hidden ? s.showValues : s.hideValues} title={hidden ? s.showValues : s.hideValues}>
            {hidden ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </header>

      <section className="stats-grid stats" aria-label={s.monthSummary}>
        <div className="card stat hero toned" style={tone('var(--yellow)')}>
          <div className="hero-in">
            <div className="k">{s.totalBalance}</div>
            <div className={`v ${!hidden && total < 0 ? 'expense' : ''}`} style={{ fontSize: 34 }}>{money(total)}</div>
            <div className="s">{!included.length ? s.noAccountYet : isCurrent ? included.map((a) => a.name).join(' + ') : s.atEndOf(monthName(m))}</div>
            <div className="hero-pills">
              <span><ArrowUp size={14} className="income" /><b className="money income">{hidden ? '•••••' : `+${formatCents(income)}`}</b></span>
              <span><ArrowDown size={14} className="expense" /><b className="money expense">{hidden ? '•••••' : `−${formatCents(expense)}`}</b></span>
            </div>
          </div>
          <span className="mascot"><Mascot size={72} plain /></span>
        </div>
        <div className="stats-rest">
        <div className="card stat toned" style={tone('var(--green)')}>
          <div className="k">{s.monthIncome} <span className="ico"><ArrowUp size={16} /></span></div>
          <div className="v">{money(income)}</div>
          <div className="s">{incomePending ? s.toReceive(money(incomePending)) : income ? s.allReceived : s.nothingYet}</div>
        </div>
        <div className="card stat toned" style={tone('var(--pink)')}>
          <div className="k">{s.monthExpense} <span className="ico"><ArrowDown size={16} /></span></div>
          <div className="v">{money(expense)}</div>
          <div className="s">{expensePending ? s.stillToPay(money(expensePending)) : expense ? s.allPaid : s.nothingYet}</div>
        </div>
        <button className="card stat toned" style={tone('var(--lavender)')} onClick={() => navigate(cards[0] ? `/cartoes/${cards[0].id}` : '/configuracoes/cartoes?novo=1')}>
          <div className="k">{isCurrent ? s.currentInvoices : s.invoicesOf(monthName(m))} <span className="ico"><CreditCard size={16} /></span></div>
          <div className="v">{money(invoicesTotal)}</div>
          <div className="s">
            {cards.length === 0 ? s.addCard : cards.length === 1 ? s.due(dayMonth(currentInvoices[0].due)) : s.cardsCount(cards.length)}
          </div>
        </button>
        </div>
      </section>

      {loaded && (active.length === 0 || txs.length === 0) && <Welcome hasAccount={active.length > 0} hasCard={cards.length > 0} hasEntry={txs.length > 0} />}

      <div className="ph-home phone-only">
        <section className="ph-tiles" aria-label={s.summary}>
          <button className="ph-tile toned" style={tone('var(--lavender)')} onClick={() => navigate(cards[0] ? `/cartoes/${cards[0].id}` : '/configuracoes/cartoes?novo=1')}>
            <span>{s.invoices}</span><b>{money(invoicesTotal)}</b>
            <small>{cards.length === 0 ? s.addCardLower : cards.length === 1 ? s.due(dayMonth(currentInvoices[0].due)) : s.cardsCount(cards.length)}</small>
          </button>
          <Link className="ph-tile toned" to="/lancamentos" style={tone('var(--pink)')}>
            <span>{s.toPay}</span><b>{money(expensePending)}</b>
            <small>{toPay.length === 0 ? s.nothingPending : s.expensesCount(toPay.length)}</small>
          </Link>
          <Link className="ph-tile toned" to="/lancamentos" style={tone('var(--green)')}>
            <span>{s.toReceiveTile}</span><b>{money(incomePending)}</b>
            <small>{incomePending ? s.stillThisMonth : income ? s.allReceived : s.nothingEntered}</small>
          </Link>
          {kept.length > 0 && (
            <Link className="ph-tile toned" to="/configuracoes/contas" style={tone('var(--sand)')}>
              <span>{kept.length === 1 ? kept[0].name : s.keptAside}</span><b>{money(keptTotal)}</b>
              <small>{s.outsideTotal}</small>
            </Link>
          )}
        </section>

        {overdue.length > 0 && (
          <div className="ph-alert" role="alert">
            <AlertCircle size={20} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{overdue.length === 1 ? entryName(overdue[0]) : s.lateCount(overdue.length)}</b>
              <small>{overdue.length === 1 ? s.lateOne(dayMonth(overdue[0].date)) : ''}{money(overdue.reduce((s, tx) => s + tx.amount_cents, 0))}</small>
            </div>
            {overdue.length === 1
              ? <button className="btn" onClick={() => settle(overdue[0])}>{s.pay}</button>
              : <Link className="btn" to="/lancamentos">{s.see}</Link>}
          </div>
        )}

        <section className="card card-pad" aria-label={s.next}>
          {nextHead}
          {upcoming.length === 0 ? <AllClear message={nothingNext} /> : upcoming.map((tx) => nextRow(tx))}
        </section>

        <section className="card card-pad" aria-label={s.myAccounts}>
          <div className="section-title"><h3>{s.myAccounts}</h3><Link to="/configuracoes/contas" className="link">{active.length ? s.manage : s.add}</Link></div>
          {active.length === 0 ? <p className="muted small" style={{ margin: 0 }}>{s.noAccountYetDot}</p> : active.map((a) => (
            <div key={a.id} className="account-line toned" style={tone(pastel(a.color, 0.82))}>
              <AccountAvatar account={a} />
              <b style={{ flex: 1, minWidth: 0 }}>{a.name}</b>
              <span className={`money ${!hidden && (balances.get(a.id) ?? 0) < 0 ? 'expense' : ''}`}>{money(balances.get(a.id) ?? 0)}</span>
            </div>
          ))}
        </section>
      </div>

      <section className="quick" aria-label={s.quickActions}>
        <button className="btn btn-pink" onClick={() => open({ kind: 'expense' })}><CircleMinus size={18} /> {s.expense} <span className="kbd">D</span></button>
        <button className="btn toned" style={tone('var(--green)')} onClick={() => open({ kind: 'income' })}><CirclePlus size={18} /> {s.income} <span className="kbd">R</span></button>
        <button className="btn btn-blue" onClick={() => open({ kind: 'transfer' })}><ArrowLeftRight size={18} /> {s.transfer} <span className="kbd">T</span></button>
      </section>

      <div className="ov-grid">
          <section className="card card-pad" aria-label={s.next}>
            {nextHead}
            {overdue.length > 0 && <div className="overdue"><AlertCircle size={18} /> {s.overdue(overdue.length)}</div>}
            {overdue.map((tx) => nextRow(tx, true))}
            {upcoming.length === 0 && overdue.length === 0 ? <AllClear message={nothingNext} /> : upcoming.map((tx) => nextRow(tx))}
          </section>

          <section className="card card-pad">
            <div className="section-title"><h3>{s.myCards}</h3>{cards.length > 0 && <Link to="/configuracoes/contas#cartoes" className="link">{s.manage}</Link>}</div>
            {cards.length === 0 ? (
              <div className="placeholder">
                <span className="ico"><CreditCard size={20} /></span>
                <h3>{s.noCardYet}</h3>
                <p>{s.noCardText}</p>
                <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => navigate('/configuracoes/cartoes?novo=1')}>
                  <CirclePlus size={16} /> {s.addCard}
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
                  <CardArt card={c} style={{ width: 'clamp(140px, 12vw, 180px)' }} />
                  <div style={{ flex: 1, minWidth: 180, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="row" style={{ justifyContent: 'space-between' }}><span className="muted small" style={{ fontWeight: 700 }}>{s.availableLimit}</span><span className="money">{money(avail)}</span></div>
                    <div className="limit-bar"><div style={{ width: `${used}%`, background: pastel(c.color, 0.4) }} /></div>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="muted small" style={{ fontWeight: 700 }}>{s.currentInvoiceDue(dayMonth(due))}</span>
                      <span className="money expense">{money(inv.total)}</span>
                    </div>
                    <button className="btn" style={{ alignSelf: 'flex-start', minHeight: 38, fontSize: 14 }} onClick={() => navigate(`/cartoes/${c.id}`)}>{s.seeInvoice}</button>
                  </div>
                </div>
              )
            })}
          </section>
          <section className="card card-pad ov-wide">
            <div className="section-title"><h3>{s.myAccounts}</h3>{active.length > 0 && <Link to="/configuracoes/contas" className="link">{s.manage}</Link>}</div>
            {active.length === 0 ? (
              <div className="placeholder">
                <span className="ico"><Landmark size={20} /></span>
                <h3>{s.noAccountYet}</h3>
                <p>{s.noAccountText}</p>
                <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => navigate('/configuracoes/contas?nova=1')}>
                  <CirclePlus size={16} /> {s.addAccount}
                </button>
              </div>
            ) : <div className="acc-tiles">{active.map((a) => (
              <div key={a.id} className="account-line toned" style={tone(pastel(a.color, 0.82))}>
                <AccountAvatar account={a} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <b>{a.name}</b>
                  <div className="muted small">{a.exclude_from_total ? s.outsideTotal : s.manualAccount}</div>
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
function AllClear({ message }: { message: string }) {
  return (
    <div className="all-clear">
      <Mascot size={52} />
      <div><b>{text().overview.allClear}</b><small>{message}</small></div>
    </div>
  )
}

/** First login: three steps to get going, ticked off as they're done. */
function Welcome({ hasAccount, hasCard, hasEntry }: { hasAccount: boolean; hasCard: boolean; hasEntry: boolean }) {
  const navigate = useNavigate()
  const { open } = useTxForm()
  const s = text().overview
  const steps = [
    { done: hasAccount, title: s.step1, text: s.step1Text, action: () => navigate('/configuracoes/contas?nova=1'), label: s.step1Button },
    { done: hasCard, title: s.step2, text: s.step2Text, action: () => navigate('/configuracoes/cartoes?novo=1'), label: s.addCard },
    { done: hasEntry, title: s.step3, text: s.step3Text, action: () => open({ kind: 'expense' }), label: s.step3Button, locked: !hasAccount },
  ]
  return (
    <section className="card welcome" aria-label={s.firstSteps}>
      <div className="welcome-head">
        <Mascot size={64} />
        <div><h2>{s.welcome}</h2><p>{s.welcomeText}</p></div>
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
