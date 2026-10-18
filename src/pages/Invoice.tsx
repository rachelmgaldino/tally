import { AlertCircle, ChevronLeft, ChevronRight, EllipsisVertical, Plus, Search, Settings, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AccountAvatar, CardArt, CategoryAvatar, pastel } from '../components/Avatars'
import { FilterMenu } from '../components/FilterMenu'
import { Mascot } from '../components/Sidebar'
import { Popover } from '../components/Picker'
import { orderedCategories } from '../components/Selects'
import { TransactionPanel } from '../components/TransactionPanel'
import { useTxForm } from '../components/TxFormContext'
import { availableLimit, invoiceFor, invoiceOf, shiftInvoice, statusLabel, toMonth } from '../lib/cards'
import { dayMonth, monthName, monthTitle, shortDate, today } from '../lib/dates'
import { t } from '../lib/i18n'
import { currencyOf, formatMoney as formatIn, formatCents, formatSigned } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useSeries, useTransactions } from '../lib/queries'
import type { TxKind } from '../lib/types'
import { tone } from '../lib/theme'

export default function Invoice() {
  const s = t().invoice
  const cm = t().common
  const KIND_FILTERS: [TxKind, string][] = [['expense', s.kindFilters.expense], ['income', s.kindFilters.income]]
  const { id } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { data: cards, isLoading } = useCards()
  const { data: txs = [] } = useTransactions()
  const { data: categories = [] } = useCategories()
  const accounts = byId(useAccounts().data)
  const seriesMap = byId(useSeries().data)
  const { open } = useTxForm()
  const [kindFilter, setKindFilter] = useState<TxKind | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const card = cards?.find((c) => c.id === id)
  // The invoice is in the card's currency.
  const formatMoney = (cents: number) => formatIn(cents, currencyOf(card))
  const categoryMap = byId(categories)
  const param = params.get('fatura')
  const month = param && /^\d{4}-\d{2}$/.test(param) ? `${param}-01` : card ? invoiceFor(card, today()) : ''
  const invoice = card && month ? invoiceOf(card, txs, month) : undefined

  const rows = useMemo(() => {
    if (!invoice) return []
    const needle = search.trim().toLowerCase()
    return invoice.purchases
      .filter((tx) => !kindFilter || tx.kind === kindFilter)
      .filter((tx) => {
        if (!categoryFilter) return true
        const c = tx.category_id ? categoryMap.get(tx.category_id) : undefined
        return !!c && (c.id === categoryFilter || c.parent_id === categoryFilter)
      })
      .filter((tx) => !needle || tx.description.toLowerCase().includes(needle))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
  }, [invoice, kindFilter, categoryFilter, search, categoryMap])

  if (isLoading) return null
  if (!card || !invoice) return <Navigate to="/configuracoes/contas#cartoes" replace />

  const go = (n: number) => setParams({ fatura: shiftInvoice(month, n).slice(0, 7) }, { replace: true })
  const selected = selectedId ? txs.find((tx) => tx.id === selectedId) : undefined
  const partial = invoice.paid > 0
  const m = toMonth(month)
  const label = monthTitle(m)

  // Spending per top-level category, for the "Categorias" tile.
  const byCategory = new Map<string, number>()
  for (const tx of invoice.purchases) {
    if (tx.kind !== 'expense') continue
    const c = tx.category_id ? categoryMap.get(tx.category_id) : undefined
    const key = c?.parent_id ?? c?.id ?? ''
    byCategory.set(key, (byCategory.get(key) ?? 0) + tx.amount_cents)
  }
  const breakdown = [...byCategory.entries()].sort((a, b) => b[1] - a[1])
  const spent = breakdown.reduce((s, [, v]) => s + v, 0)

  const paidPct = invoice.total > 0 ? Math.min(100, (invoice.paid / invoice.total) * 100) : 0
  const previous = invoiceOf(card, txs, shiftInvoice(month, -1))
  const sorted = [...invoice.payments].sort((a, b) => a.date.localeCompare(b.date))
  const activeCards = (cards ?? []).filter((c) => !c.archived || c.id === card.id)
  const avail = availableLimit(card, txs)
  const usedPct = card.limit_cents > 0 ? Math.min(100, Math.max(0, ((card.limit_cents - avail) / card.limit_cents) * 100)) : 0
  const pay = () => open({ kind: 'payment', cardId: card.id, invoiceMonth: month })

  return (
    <main className="page inv-page">
      <header className="page-head desk-only">
        <h1>{s.title}</h1>
        <button className="link" onClick={() => navigate('/configuracoes/contas#cartoes')}>{s.manageCards}</button>
      </header>
      <header className="ph-inv-head phone-only">
        <h1>{s.title}</h1>
        <Popover
          className="more-menu"
          trigger={(_, toggle) => <button className="icon-btn" onClick={toggle} aria-label={s.moreOptions}><EllipsisVertical size={20} /></button>}
        >
          {(close) => <button className="picker-item" onClick={() => { close(); navigate('/configuracoes/contas#cartoes') }}><Settings size={18} /> {s.manageCards}</button>}
        </Popover>
      </header>
      {activeCards.length > 1 && (
        <div className="ph-card-pick" role="group" aria-label={cm.card}>
          {activeCards.map((c) => (
            <button key={c.id} className={c.id === card.id ? 'on' : ''} aria-pressed={c.id === card.id} onClick={() => navigate(`/cartoes/${c.id}`)}>
              <i style={{ background: pastel(c.color, 0.35) }} />{c.name}
            </button>
          ))}
        </div>
      )}
      <section className="ph-inv-hero phone-only toned" style={tone(pastel(card.color, 0.5))} aria-label={s.invoiceOf(label)}>
        <div className="ph-inv-nav">
          <button onClick={() => go(-1)} aria-label={s.prevInvoice}><ChevronLeft size={20} /></button>
          <span>{label}</span>
          <button onClick={() => go(1)} aria-label={s.nextInvoice}><ChevronRight size={20} /></button>
        </div>
        <div className="ph-inv-mid">
          <span className={`status status-${invoice.status}`}>{s.heroStatus[invoice.status]}</span>
          <b>{formatMoney(invoice.total)}</b>
          <small>{s.dueCloses(dayMonth(invoice.due), dayMonth(invoice.closing))}</small>
        </div>
        {card.limit_cents > 0 && (
          <>
            <div className="ph-inv-limit"><div style={{ width: `${usedPct}%` }} /></div>
            <div className="ph-inv-limit-legend"><span>{s.limitUsed(formatMoney(card.limit_cents - avail))}</span><span>{s.available(formatMoney(avail))}</span></div>
          </>
        )}
      </section>
      <div className="ph-inv-actions phone-only">
        {invoice.remaining > 0
          ? <button className="btn btn-primary" onClick={pay}>{partial ? s.payRemaining : s.payInvoice}</button>
          : <span className="btn ph-inv-done">{invoice.total > 0 ? s.invoicePaid : s.nothingToPay}</span>}
        <button className="btn" onClick={() => open({ kind: 'expense', accountId: card.id })}>{s.newPurchase}</button>
      </div>
      {previous.remaining > 0 && (
        <div className="ph-alert phone-only">
          <AlertCircle size={20} />
          <b style={{ flex: 1, fontSize: 13, whiteSpace: 'normal' }}>{s.previousLeft(formatMoney(previous.remaining), monthName(shiftInvoice(month, -1)))}</b>
        </div>
      )}

      <section className="card invoice-head">
        <CardArt card={card} tilt />
        <div className="title">
          <span className={`status status-${invoice.status}`}>{statusLabel(invoice.status)}</span>
          <h1>
            <button onClick={() => go(-1)} aria-label={s.prevInvoice}><ChevronLeft size={20} /></button>
            <span>{s.heading(monthName(m))}</span>
            <button onClick={() => go(1)} aria-label={s.nextInvoice}><ChevronRight size={20} /></button>
          </h1>
          <span className="muted" style={{ fontWeight: 700 }}>{card.name} · {s.dueCloses(dayMonth(invoice.due), dayMonth(invoice.closing))}</span>
          {card.limit_cents > 0 && (
            <div className="inv-limit">
              <div className="limit-bar"><div style={{ width: `${usedPct}%`, background: pastel(card.color, 0.4) }} /></div>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span>{s.limitUsed(formatMoney(card.limit_cents - avail))}</span><span>{s.available(formatMoney(avail))}</span>
              </div>
            </div>
          )}
        </div>
        <div className="invoice-totals">
          <span className="k">{s.total}</span>
          <span className="v">{formatMoney(invoice.total)}</span>
          {invoice.paid > 0 && <span className="paid-note">{s.paidLeft(formatMoney(invoice.paid), formatMoney(invoice.remaining))}</span>}
          {previous.remaining > 0 && <span className="paid-note expense">{s.previousShort(formatMoney(previous.remaining))}</span>}
          {invoice.remaining === 0 && invoice.total > 0 && <span className="inv-paid"><Mascot size={30} /> {s.invoicePaidCheer}</span>}
          {invoice.remaining > 0 && (
            <button className="btn btn-primary" onClick={() => open({ kind: 'payment', cardId: card.id, invoiceMonth: month })}>
              {partial ? s.payRemaining : s.payInvoice}
            </button>
          )}
        </div>
      </section>

      {breakdown.length > 0 && (
        <section className="card card-pad inv-cats desk-only" aria-label={s.byCategory}>
          <div className="stack-bar">
            {breakdown.map(([cid, v]) => {
              const cat = categoryMap.get(cid)
              return <div key={cid || 'none'} style={{ width: `${(v / spent) * 100}%`, background: cat ? pastel(cat.color) : 'var(--field)' }} />
            })}
          </div>
          <div className="inv-cats-legend">
            {breakdown.map(([cid, v]) => {
              const cat = categoryMap.get(cid)
              return (
                <span key={cid || 'none'}>
                  <i style={{ background: cat ? pastel(cat.color) : 'var(--field)' }} />{cat?.name ?? cm.noCategory} <b className="money">{formatCents(v)}</b>
                </span>
              )
            })}
          </div>
        </section>
      )}

      {invoice.payments.length > 0 && (
        <section className={`card card-pad payments ${sorted.length ? 'has-pay' : ''}`}>
          <div className="section-title">
            <h3>{s.payment}</h3>
            {partial && invoice.remaining > 0 && (
              <button className="btn btn-primary" onClick={() => open({ kind: 'payment', cardId: card.id, invoiceMonth: month })}>{s.payRemaining}</button>
            )}
          </div>
          <div className="progress"><div style={{ width: `${paidPct}%` }} /></div>
          <div className="progress-legend">
            <span className="income">{s.paid(formatMoney(invoice.paid))}</span>
            <span className={invoice.remaining > 0 ? 'expense' : 'muted'}>{s.left(formatMoney(invoice.remaining))}</span>
          </div>
          {sorted.length > 0 && (
            <table>
              <thead><tr><th>{s.colDate}</th><th>{s.colPaid}</th><th>{s.colAccount}</th><th></th></tr></thead>
              <tbody>
                {sorted.map((p) => {
                  const a = p.account_id ? accounts.get(p.account_id) : undefined
                  return (
                    <tr key={p.id}>
                      <td>{shortDate(p.date)}</td>
                      <td className="money">{formatMoney(p.amount_cents)}</td>
                      <td><span className="row"><AccountAvatar account={a} size={22} />{a?.name}</span></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="act" onClick={() => open({ kind: 'payment', editing: p })}>{s.edit}</button>
                        <button className="act" style={{ marginLeft: 6 }} onClick={() => setSelectedId(p.id)}>{s.details}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      <div className="filters">
        <button className="btn btn-dark" style={{ minHeight: 40 }} onClick={() => open({ kind: 'expense', accountId: card.id })}><Plus size={18} /> {s.newEntry}</button>
        <div className="filter-bar">
          <FilterMenu
            label={KIND_FILTERS.find(([k]) => k === kindFilter)?.[1] ?? s.kind}
            on={!!kindFilter}
            items={[{ id: null, label: s.allKinds }, ...KIND_FILTERS.map(([kid, l]) => ({ id: kid, label: l }))]}
            value={kindFilter}
            onChange={(v) => setKindFilter(v as TxKind | null)}
          />
          <FilterMenu
            label={categoryFilter ? categoryMap.get(categoryFilter)?.name ?? s.categories : s.categories}
            on={!!categoryFilter}
            items={[
              { id: null, label: s.allCategories },
              ...orderedCategories(categories).map(({ category, depth }) => ({ id: category.id, label: category.name, sub: depth > 0 })),
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </div>
        <label className="search-pill">
          <Search size={18} />
          <input placeholder={s.searchPurchase} aria-label={s.searchPurchase} value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} aria-label={s.clearSearch}><X size={16} /></button>}
        </label>
      </div>

      <section className="card list-card" aria-label={s.purchases}>
        {rows.length === 0 ? (
          <div className="empty">
            <h3>{s.emptyTitle}</h3>
            <p>{s.emptyText}</p>
          </div>
        ) : (
          <div className="tx-list">
            {rows.map((tx) => {
              const category = tx.category_id ? categoryMap.get(tx.category_id) : undefined
              const parent = category?.parent_id ? categoryMap.get(category.parent_id) : undefined
              const series = tx.series_id ? seriesMap.get(tx.series_id) : undefined
              return (
                <div key={tx.id} className={`tx-row invoice-row ${tx.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(tx.id)}>
                  <CategoryAvatar category={parent ?? category} />
                  <div className="tx-desc">
                    {tx.description || category?.name || cm.noDescription}
                    {series?.installments && <span className="part">{tx.series_index}/{series.installments}</span>}
                    <span className="sub">{dayMonth(tx.date)} · {category ? (parent ? `${parent.name} › ${category.name}` : category.name) : cm.noCategory}</span>
                  </div>
                  <div className={`tx-amount ${tx.kind === 'income' ? 'income' : ''}`}>{formatSigned(tx.kind === 'income' ? tx.amount_cents : -tx.amount_cents, currencyOf(card))}</div>
                </div>
              )
            })}
          </div>
        )}
      </section>
      {selected && <TransactionPanel tx={selected} onClose={() => setSelectedId(null)} onNavigate={(nid) => {
        const t = txs.find((x) => x.id === nid)
        if (t?.invoice_month && t.card_id === card.id) setParams({ fatura: t.invoice_month.slice(0, 7) }, { replace: true })
        setSelectedId(nid)
      }} />}
    </main>
  )
}
