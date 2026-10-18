import { AlertCircle, CalendarCheck, CalendarClock, ChevronLeft, ChevronRight, EllipsisVertical, PieChart, Plus, Receipt, Search, Settings, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AccountAvatar, CardArt, CategoryAvatar, pastel } from '../components/Avatars'
import { FilterMenu } from '../components/FilterMenu'
import { Popover } from '../components/Picker'
import { orderedCategories } from '../components/Selects'
import { TransactionPanel } from '../components/TransactionPanel'
import { useTxForm } from '../components/TxFormContext'
import { availableLimit, invoiceFor, invoiceOf, shiftInvoice, STATUS_LABEL, toMonth } from '../lib/cards'
import { monthLabel, shortDate, today } from '../lib/dates'
import { formatBRL, formatSigned } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useSeries, useTransactions } from '../lib/queries'
import type { TxKind } from '../lib/types'

const KIND_FILTERS: [TxKind, string][] = [['expense', 'Despesas'], ['income', 'Receitas']]

export default function Invoice() {
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
  const label = monthLabel(m).replace(/^\w/, (c) => c.toLowerCase())

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
    <main className="page page-narrow inv-page">
      <header className="ph-inv-head phone-only">
        <h1>Faturas</h1>
        <Popover
          className="more-menu"
          trigger={(_, toggle) => <button className="icon-btn" onClick={toggle} aria-label="Mais opções"><EllipsisVertical size={20} /></button>}
        >
          {(close) => <button className="picker-item" onClick={() => { close(); navigate('/configuracoes/contas#cartoes') }}><Settings size={18} /> Gerenciar cartões</button>}
        </Popover>
      </header>
      {activeCards.length > 1 && (
        <div className="ph-card-pick phone-only" role="group" aria-label="Cartão">
          {activeCards.map((c) => (
            <button key={c.id} className={c.id === card.id ? 'on' : ''} aria-pressed={c.id === card.id} onClick={() => navigate(`/cartoes/${c.id}`)}>
              <i style={{ background: pastel(c.color, 0.35) }} />{c.name}
            </button>
          ))}
        </div>
      )}
      <section className="ph-inv-hero phone-only" style={{ background: pastel(card.color, 0.5) }} aria-label={`Fatura de ${label}`}>
        <div className="ph-inv-nav">
          <button onClick={() => go(-1)} aria-label="Fatura anterior"><ChevronLeft size={20} /></button>
          <span>{label}</span>
          <button onClick={() => go(1)} aria-label="Próxima fatura"><ChevronRight size={20} /></button>
        </div>
        <div className="ph-inv-mid">
          <span className={`status status-${invoice.status}`}>{STATUS_LABEL[invoice.status].replace(/^Fatura /, '')}</span>
          <b>{formatBRL(invoice.total)}</b>
          <small>vence {shortDate(invoice.due).slice(0, 5)} · fecha {shortDate(invoice.closing).slice(0, 5)}</small>
        </div>
        {card.limit_cents > 0 && (
          <>
            <div className="ph-inv-limit"><div style={{ width: `${usedPct}%` }} /></div>
            <div className="ph-inv-limit-legend"><span>Limite usado {formatBRL(card.limit_cents - avail)}</span><span>Disponível {formatBRL(avail)}</span></div>
          </>
        )}
      </section>
      <div className="ph-inv-actions phone-only">
        {invoice.remaining > 0
          ? <button className="btn btn-primary" onClick={pay}>{partial ? 'Pagar restante' : 'Pagar fatura'}</button>
          : <span className="btn ph-inv-done">{invoice.total > 0 ? 'Fatura paga' : 'Nada a pagar'}</span>}
        <button className="btn" onClick={() => open({ kind: 'expense', accountId: card.id })}>Nova compra</button>
      </div>
      {previous.remaining > 0 && (
        <div className="ph-alert phone-only">
          <AlertCircle size={20} />
          <b style={{ flex: 1, fontSize: 13, whiteSpace: 'normal' }}>Ainda faltam {formatBRL(previous.remaining)} da fatura de {monthLabel(toMonth(shiftInvoice(month, -1))).split(' ')[0].toLowerCase()}.</b>
        </div>
      )}

      <section className="card invoice-head">
        <CardArt card={card} tilt />
        <div className="title">
          <span className={`status status-${invoice.status}`}>{STATUS_LABEL[invoice.status]}</span>
          <h1>
            <button onClick={() => go(-1)} aria-label="Fatura anterior"><ChevronLeft size={20} /></button>
            <span>Fatura {label.split(' ')[0]}</span>
            <button onClick={() => go(1)} aria-label="Próxima fatura"><ChevronRight size={20} /></button>
          </h1>
          <span className="muted" style={{ fontWeight: 700 }}>{card.name} · {m.year}</span>
        </div>
        <div className="invoice-totals">
          <span className="k">Fatura total</span>
          <span className="v">{formatBRL(invoice.total)}</span>
          {invoice.remaining > 0 && (
            <button className="btn btn-primary" onClick={() => open({ kind: 'payment', cardId: card.id, invoiceMonth: month })}>
              {partial ? 'Pagar restante' : 'Pagar fatura'}
            </button>
          )}
        </div>
      </section>

      <section className="tiles" aria-label="Resumo da fatura">
        <div className="tile"><span>Fatura anterior</span><b>{formatBRL(previous.total)}</b></div>
        <div className="tile pink"><span><Receipt size={15} /> Fatura atual</span><b>{formatBRL(invoice.total)}</b></div>
        <div className="tile"><span><CalendarClock size={15} /> Fechamento</span><b>{shortDate(invoice.closing).slice(0, 5)}</b></div>
        <div className="tile sand"><span><CalendarCheck size={15} /> Vencimento</span><b>{shortDate(invoice.due).slice(0, 5)}</b></div>
        <Popover
          className="tile-pop"
          trigger={(_, toggle) => (
            <button className="tile tile-btn" onClick={toggle} aria-label="Gastos por categoria">
              <span><PieChart size={15} /> Categorias</span>
              <div className="stack-bar">
                {breakdown.length === 0 ? null : breakdown.map(([cid, v]) => {
                  const c = categoryMap.get(cid)
                  return <div key={cid || 'none'} style={{ width: `${(v / spent) * 100}%`, background: c ? pastel(c.color) : 'var(--field)' }} />
                })}
              </div>
            </button>
          )}
        >
          {() => breakdown.length === 0 ? <div className="picker-group">Nenhuma despesa nesta fatura.</div> : breakdown.map(([cid, v]) => {
            const c = categoryMap.get(cid)
            return (
              <div key={cid || 'none'} className="picker-item" style={{ cursor: 'default' }}>
                <CategoryAvatar category={c} size={28} />
                <span style={{ flex: 1 }}>{c?.name ?? 'Sem categoria'}</span>
                <span className="muted small">{Math.round((v / spent) * 100)}%</span>
                <b className="money">{formatBRL(v)}</b>
              </div>
            )
          })}
        </Popover>
      </section>

      {(invoice.payments.length > 0 || invoice.total > 0) && (
        <section className={`card card-pad payments ${sorted.length ? 'has-pay' : ''}`}>
          <div className="section-title">
            <h3>Pagamento</h3>
            {partial && invoice.remaining > 0 && (
              <button className="btn btn-primary" onClick={() => open({ kind: 'payment', cardId: card.id, invoiceMonth: month })}>Pagar restante</button>
            )}
          </div>
          <div className="progress"><div style={{ width: `${paidPct}%` }} /></div>
          <div className="progress-legend">
            <span className="income">Pago {formatBRL(invoice.paid)}</span>
            <span className={invoice.remaining > 0 ? 'expense' : 'muted'}>Falta {formatBRL(invoice.remaining)}</span>
          </div>
          {sorted.length > 0 && (
            <table>
              <thead><tr><th>Data</th><th>Valor pago</th><th>Conta</th><th></th></tr></thead>
              <tbody>
                {sorted.map((p) => {
                  const a = p.account_id ? accounts.get(p.account_id) : undefined
                  return (
                    <tr key={p.id}>
                      <td>{shortDate(p.date)}</td>
                      <td className="money">{formatBRL(p.amount_cents)}</td>
                      <td><span className="row"><AccountAvatar account={a} size={22} />{a?.name}</span></td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button className="act" onClick={() => open({ kind: 'payment', editing: p })}>Editar</button>
                        <button className="act" style={{ marginLeft: 6 }} onClick={() => setSelectedId(p.id)}>Detalhes</button>
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
        <button className="btn btn-dark" style={{ minHeight: 40 }} onClick={() => open({ kind: 'expense', accountId: card.id })}><Plus size={18} /> Lançamento</button>
        <div className="filter-bar">
          <FilterMenu
            label={KIND_FILTERS.find(([k]) => k === kindFilter)?.[1] ?? 'Tipo'}
            on={!!kindFilter}
            items={[{ id: null, label: 'Todos os tipos' }, ...KIND_FILTERS.map(([kid, l]) => ({ id: kid, label: l }))]}
            value={kindFilter}
            onChange={(v) => setKindFilter(v as TxKind | null)}
          />
          <FilterMenu
            label={categoryFilter ? categoryMap.get(categoryFilter)?.name ?? 'Categorias' : 'Categorias'}
            on={!!categoryFilter}
            items={[
              { id: null, label: 'Todas as categorias' },
              ...orderedCategories(categories).map(({ category, depth }) => ({ id: category.id, label: category.name, sub: depth > 0 })),
            ]}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
        </div>
        <label className="search-pill">
          <Search size={18} />
          <input placeholder="Buscar compra" aria-label="Buscar compra" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} aria-label="Limpar busca"><X size={16} /></button>}
        </label>
      </div>

      <section className="card list-card" aria-label="Compras da fatura">
        {rows.length === 0 ? (
          <div className="empty">
            <h3>Nenhuma compra nesta fatura</h3>
            <p>Compras feitas no cartão aparecem aqui, na fatura em que caírem.</p>
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
                    {tx.description || category?.name || 'Sem descrição'}
                    {series?.installments && <span className="part">{tx.series_index}/{series.installments}</span>}
                    <span className="sub">{shortDate(tx.date).slice(0, 5)} · {category ? (parent ? `${parent.name} › ${category.name}` : category.name) : 'Sem categoria'}</span>
                  </div>
                  <div className={`tx-amount ${tx.kind === 'income' ? 'income' : ''}`}>{formatSigned(tx.kind === 'income' ? tx.amount_cents : -tx.amount_cents)}</div>
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
      <div className="desk-only" style={{ textAlign: 'center' }}>
        <button className="link" onClick={() => navigate('/configuracoes/contas#cartoes')}>Gerenciar cartões</button>
      </div>
    </main>
  )
}
