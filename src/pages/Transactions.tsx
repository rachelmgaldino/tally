import {
  ArrowLeftRight, ArrowRight, Check, ChevronLeft, ChevronRight, ChevronUp, CircleCheck, CreditCard, Download, EllipsisVertical, Info, Paperclip, Plus, Printer, Receipt,
  Repeat2, Search, Tag, ThumbsDown, ThumbsUp, Trash2, Undo2, X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountAvatar, AccountIcon, CategoryAvatar } from '../components/Avatars'
import { FilterMenu } from '../components/FilterMenu'
import { Mascot } from '../components/Sidebar'
import { SummaryCard } from '../components/SummaryCard'
import { Popover } from '../components/Picker'
import { orderedCategories } from '../components/Selects'
import { TransactionPanel } from '../components/TransactionPanel'
import { useTxForm } from '../components/TxFormContext'
import { Modal, Segmented } from '../components/ui'
import { effectOnSet, periodSummary } from '../lib/balances'
import { transactionsTable } from '../lib/api'
import { cashFlow, isCardPurchase, toMonth } from '../lib/cards'
import { deleteEntries, useRefresh, useSeriesUpkeep } from '../lib/entries'
import { useToast } from '../components/Toast'
import { useConfirm } from '../components/Confirm'
import { monthLabel, shortDate, today } from '../lib/dates'
import { shiftSpan, spanAt, spanLabel, spanRange, type Span } from '../lib/periods'
import { usePrefs } from '../lib/prefs'

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
/** "sábado, 18/10" */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${shortDate(iso).slice(0, 5)}`
}
import { formatBRL, formatCents, formatSigned } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useSeries, useTags, useTransactionMutations, useTransactions } from '../lib/queries'
import type { CategoryKind, Transaction, TxKind } from '../lib/types'

const KIND_NAME: Record<TxKind, string> = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência', payment: 'Pagamento de fatura' }

const KIND_FILTERS: [TxKind, string][] = [['expense', 'Despesas'], ['income', 'Receitas'], ['transfer', 'Transferências'], ['payment', 'Pagamentos de fatura']]

/** "Fluxo de caixa" shows money moving in accounts; "Todos os lançamentos" every entry, card purchases included. */
type ViewMode = 'cash' | 'all'
const MODE_KEY = 'tally-view-mode'
/** The summary card shows either plain in/out totals of what's paid (the default) or the full balance breakdown, whatever the view mode. */
const SUMMARY_KEY = 'tally-summary-view'

export default function Transactions() {
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: txs = [], isLoading } = useTransactions()
  const { data: tags = [] } = useTags()
  const { data: cards = [] } = useCards()
  const navigate = useNavigate()
  const seriesMap = byId(useSeries().data)
  const { update } = useTransactionMutations()
  const { open } = useTxForm()
  const refresh = useRefresh()
  const toast = useToast()
  const confirmDelete = useConfirm()

  const { prefs } = usePrefs()
  const [spanState, setSpan] = useState<Span>(() => spanAt(prefs.period, today()))
  // A change of "Período padrão" keeps the same moment in view.
  const span = spanState.kind === prefs.period ? spanState : spanAt(prefs.period, spanState.start)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<TxKind | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  // On the phone the search field hides behind a button in the header.
  const [searchOpen, setSearchOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setModeState] = useState<ViewMode>(() => {
    try { return localStorage.getItem(MODE_KEY) === 'all' ? 'all' : 'cash' } catch { return 'cash' }
  })
  const [choosingMode, setChoosingMode] = useState(false)
  const [totalsOnly, setTotalsOnlyState] = useState(() => {
    try { return localStorage.getItem(SUMMARY_KEY) !== 'saldos' } catch { return true }
  })
  const setTotalsOnly = (v: boolean) => {
    setTotalsOnlyState(v)
    try { localStorage.setItem(SUMMARY_KEY, v ? 'periodo' : 'saldos') } catch { /* ignore */ }
  }
  const setMode = (m: ViewMode) => {
    setModeState(m)
    try { localStorage.setItem(MODE_KEY, m) } catch { /* ignore */ }
  }

  const accountMap = byId(accounts)
  const cardMap = byId(cards)
  const filteredCard = accountFilter ? cardMap.get(accountFilter) : undefined
  // Cash flow swaps card purchases for their invoices; the full list hides
  // invoices and their payments so nothing counts twice.
  const ledger = useMemo(() => cashFlow(cards, txs), [cards, txs])
  const source = useMemo(() => (mode === 'cash' ? ledger : txs.filter((tx) => tx.kind !== 'payment')), [mode, ledger, txs])
  const categoryMap = byId(categories)
  const { from, to } = spanRange(span)
  const t = today()
  useSeriesUpkeep(to)

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return source
      .filter((tx) => tx.date >= from && tx.date < to)
      .filter((tx) => !accountFilter || (filteredCard
        ? tx.card_id === accountFilter
        : (tx.account_id === accountFilter || tx.to_account_id === accountFilter)))
      .filter((tx) => !kindFilter || tx.kind === kindFilter)
      .filter((tx) => {
        if (!categoryFilter) return true
        const c = tx.category_id ? categoryMap.get(tx.category_id) : undefined
        return !!c && (c.id === categoryFilter || c.parent_id === categoryFilter)
      })
      .filter((tx) => !tagFilter || tx.tag_ids.includes(tagFilter))
      .filter((tx) => !needle || tx.description.toLowerCase().includes(needle))
      .sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)) * (prefs.order === 'asc' ? -1 : 1))
  }, [source, from, to, accountFilter, filteredCard, kindFilter, categoryFilter, tagFilter, search, categoryMap, prefs.order])

  const groups = useMemo(() => {
    const out: { date: string; items: Transaction[] }[] = []
    for (const tx of rows) {
      const last = out[out.length - 1]
      if (last && last.date === tx.date) last.items.push(tx)
      else out.push({ date: tx.date, items: [tx] })
    }
    return out
  }, [rows])

  const summaryAccounts = accountFilter ? accounts.filter((a) => a.id === accountFilter) : accounts
  const summary = periodSummary(summaryAccounts, ledger, from, to)
  // A plain total (income minus expenses, transfers left out) when asked for, or when a card is filtered,
  // since account balances say nothing about a card.
  const simpleTotal = totalsOnly || !!filteredCard
  const filteredAccount = accountFilter ? accountMap.get(accountFilter) : undefined

  // "Saldo no fim de cada dia": balance of the accounts in view after each day, pending entries included.
  const dayBalance = useMemo(() => {
    const out = new Map<string, number>()
    if (!prefs.dailyBalance || simpleTotal) return out
    const ids = new Set(summaryAccounts.map((a) => a.id))
    const base = summaryAccounts.reduce((s, a) => s + a.initial_balance_cents, 0)
    for (const g of groups) {
      out.set(g.date, ledger.reduce((s, tx) => (tx.date <= g.date ? s + effectOnSet(tx, ids) : s), base))
    }
    return out
  }, [prefs.dailyBalance, simpleTotal, summaryAccounts, groups, ledger])

  const pickedRows = rows.filter((tx) => picked.has(tx.id))
  const payable = pickedRows.filter((tx) => (tx.kind === 'expense' || tx.kind === 'income') && !tx.card_id)
  const pickedKinds = new Set(pickedRows.map((tx) => tx.kind))
  const categoryKind = pickedKinds.size === 1 && (pickedKinds.has('expense') || pickedKinds.has('income')) ? pickedRows[0].kind as CategoryKind : null

  function stopSelecting() {
    setSelecting(false)
    setPicked(new Set())
  }

  function togglePick(id: string) {
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function bulk(job: Promise<unknown>, message: string) {
    try {
      await refresh(job)
      toast(message)
      stopSelecting()
    } catch (e) {
      toast(`Não foi possível concluir: ${(e as Error).message}`)
    }
  }

  async function bulkDelete() {
    const n = pickedRows.length
    const ok = await confirmDelete({
      title: n === 1 ? 'Excluir 1 lançamento?' : `Excluir ${n} lançamentos?`,
      text: 'Eles saem da lista e dos saldos. Isso não pode ser desfeito.',
    })
    if (!ok) return
    bulk(deleteEntries(pickedRows), n === 1 ? 'Lançamento excluído.' : `${n} lançamentos excluídos.`)
  }

  function exportCsv() {
    const lines = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta/Cartão', 'Valor', 'Situação']]
    for (const tx of rows) {
      const c = tx.category_id ? categoryMap.get(tx.category_id) : undefined
      const parent = c?.parent_id ? categoryMap.get(c.parent_id) : undefined
      const where = tx.kind === 'transfer'
        ? `${accountMap.get(tx.account_id ?? '')?.name ?? ''} > ${accountMap.get(tx.to_account_id ?? '')?.name ?? ''}`
        : [tx.account_id && accountMap.get(tx.account_id)?.name, tx.card_id && cardMap.get(tx.card_id)?.name].filter(Boolean).join(' > ')
      lines.push([
        shortDate(tx.date).replace(/\/(\d\d)$/, `/${tx.date.slice(0, 4)}`),
        tx.description,
        KIND_NAME[tx.kind],
        c ? (parent ? `${parent.name} > ${c.name}` : c.name) : '',
        where,
        formatCents(signedAmount(tx)),
        tx.paid ? 'Pago' : 'Pendente',
      ])
    }
    const csv = lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `lancamentos-${from}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }
  const selected = selectedId ? txs.find((tx) => tx.id === selectedId) : undefined
  const hasFilters = accountFilter || kindFilter || categoryFilter || tagFilter || search

  function clearFilters() {
    setAccountFilter(null)
    setKindFilter(null)
    setCategoryFilter(null)
    setTagFilter(null)
    setSearch('')
  }

  function signedAmount(tx: Transaction): number {
    if (tx.kind === 'income') return tx.amount_cents
    if (tx.kind === 'expense' || tx.kind === 'payment') return -tx.amount_cents
    if (accountFilter === tx.to_account_id) return tx.amount_cents
    if (accountFilter === tx.account_id) return -tx.amount_cents
    return tx.amount_cents
  }

  if (!loadingAccounts && accounts.length === 0) {
    return (
      <main className="page">
        <header className="page-head"><h1>Lançamentos</h1><PeriodNav span={span} setSpan={setSpan} /></header>
        <div className="card">
          <div className="empty">
            <div className="empty-ghost"><div /><div /><div /></div>
            <h3>Crie sua primeira conta</h3>
            <p>Adicione uma conta para começar a registrar seus lançamentos</p>
            <Link to="/configuracoes/contas?nova=1" className="btn btn-ghost-green" style={{ textDecoration: 'none' }}>Adicionar conta</Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className={`page tx-page ${selected ? 'with-panel' : ''}`}>
      <header className="page-head">
        <h1>Lançamentos</h1>
        <div className="head-actions">
          <PeriodNav span={span} setSpan={setSpan} />
          <div className="segmented" role="group" aria-label="Modo de visualização">
            <button className={mode === 'cash' ? 'on' : ''} aria-pressed={mode === 'cash'} onClick={() => setMode('cash')}>Fluxo de caixa</button>
            <button className={mode === 'all' ? 'on' : ''} aria-pressed={mode === 'all'} onClick={() => setMode('all')}>Todos<span className="desk-only"> os lançamentos</span></button>
          </div>
          <button className="icon-btn desk-only" onClick={() => setChoosingMode(true)} aria-label="Sobre os modos de visualização" title="Sobre os modos de visualização"><Info size={20} /></button>
          <button className={`icon-btn phone-only ${searchOpen || search ? 'on' : ''}`} onClick={() => {
            if (searchOpen) setSearch('')
            else setTimeout(() => document.getElementById('tx-search')?.focus())
            setSearchOpen(!searchOpen)
          }} aria-label="Buscar" aria-pressed={searchOpen}><Search size={20} /></button>
          <Popover
            className="more-menu"
            trigger={(_, toggle) => <button className="icon-btn" onClick={toggle} aria-label="Mais opções" title="Imprimir ou exportar"><EllipsisVertical size={20} /></button>}
          >
            {(close) => (
              <>
                <button className="picker-item phone-only" onClick={() => { close(); setChoosingMode(true) }}><Info size={18} /> Sobre os modos de visualização</button>
                <button className="picker-item" onClick={() => { close(); window.print() }}><Printer size={18} /> Imprimir ou salvar em PDF</button>
                <button className="picker-item" onClick={() => { close(); exportCsv() }} disabled={rows.length === 0}><Download size={18} /> Exportar planilha (CSV)</button>
              </>
            )}
          </Popover>
          <Popover
            popClassName="menu-dark"
            className="new-menu"
            trigger={(_, toggle) => (
              <button className="icon-btn" style={{ background: 'var(--yellow)' }} onClick={toggle} aria-label="Novo lançamento" title="Novo lançamento"><Plus size={20} /></button>
            )}
          >
            {(close) => (
              <>
                {([['expense', 'Nova despesa', 'D'], ['income', 'Nova receita', 'R'], ['transfer', 'Nova transferência', 'T']] as const).map(([kind, label, key]) => (
                  <button key={kind} onClick={() => { close(); open({ kind, accountId: accountFilter ?? undefined }) }}>
                    {label} <span className="kbd">{key}</span>
                  </button>
                ))}
              </>
            )}
          </Popover>
        </div>
      </header>

        <div className="filters">
          <div className="filter-bar">
            {([[null, 'Tudo'], ['expense', 'Despesas'], ['income', 'Receitas'], ['transfer', 'Transferências']] as const).map(([k, label]) => (
              <button key={label} className={`fil kind-chip phone-only ${kindFilter === k ? 'on' : ''}`} onClick={() => setKindFilter(k)} aria-pressed={kindFilter === k}>
                {k && <i className={`dot ${k}`} />}{label}
              </button>
            ))}
            <FilterMenu
              label={filteredAccount?.name ?? filteredCard?.name ?? 'Origem'}
              on={!!accountFilter}
              items={[
                { id: null, label: cards.length ? 'Todas contas/cartões' : 'Todas as contas' },
                ...(cards.length ? [{ id: null, label: 'Contas', header: true }] : []),
                ...accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, label: a.name })),
                ...(cards.length ? [{ id: null, label: 'Cartões', header: true }] : []),
                ...cards.filter((c) => !c.archived).map((c) => ({ id: c.id, label: c.name })),
              ]}
              value={accountFilter}
              onChange={setAccountFilter}
            />
            <FilterMenu
              className="desk-only"
              label={KIND_FILTERS.find(([k]) => k === kindFilter)?.[1] ?? 'Tipo'}
              on={!!kindFilter}
              items={[{ id: null, label: 'Todos os tipos' }, ...KIND_FILTERS.map(([id, label]) => ({ id, label }))]}
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
            <FilterMenu
              label={tagFilter ? tags.find((tg) => tg.id === tagFilter)?.name ?? 'Tags' : 'Tags'}
              on={!!tagFilter}
              items={[{ id: null, label: 'Todas as tags' }, ...tags.map((tg) => ({ id: tg.id, label: tg.name }))]}
              value={tagFilter}
              onChange={setTagFilter}
            />
          </div>
          <label className={`search-pill ${searchOpen || search ? 'open' : ''}`}>
            <Search size={18} />
            <input id="tx-search" placeholder="Buscar lançamento" aria-label="Buscar lançamento" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} aria-label="Limpar busca"><X size={16} /></button>}
          </label>
          {hasFilters && <button className="fil" onClick={clearFilters}><X size={16} /> Limpar</button>}
          <button className={`fil ${selecting ? 'on' : ''}`} onClick={() => (selecting ? stopSelecting() : setSelecting(true))} aria-pressed={selecting}>
            <CircleCheck size={18} /> {selecting ? 'Cancelar seleção' : 'Selecionar'}
          </button>
        </div>

        <section className={`card list-card ${rows.length && !isLoading ? 'has-rows' : ''}`} aria-label="Lista de lançamentos">

        {isLoading ? (
          <div className="empty"><p>Carregando…</p></div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <div className="empty-mascot"><Mascot size={64} /></div>
            <h3>Nenhum lançamento no período</h3>
            <p>Adicione um lançamento ou escolha outro mês</p>
            <button className="btn btn-ghost-green" onClick={() => open({ kind: 'expense', accountId: accountFilter ?? undefined })}>Adicionar lançamento</button>
          </div>
        ) : (
          <div className="tx-list">
            {groups.map((g) => (
              <section key={g.date}>
                <div className={`day-head ${g.date === t ? 'today' : ''}`}>
                  {g.date === t ? `Hoje · ${dayLabel(g.date)}` : dayLabel(g.date)}
                  {dayBalance.has(g.date) && !selecting && (
                    <span className={`day-head-bal phone-only ${dayBalance.get(g.date)! < 0 ? 'expense' : ''}`}>saldo {formatBRL(dayBalance.get(g.date)!)}</span>
                  )}
                  {selecting && (
                    <button className="day-pick" onClick={() => {
                      const ids = g.items.filter((tx) => !tx.virtual).map((tx) => tx.id)
                      const all = ids.every((id) => picked.has(id))
                      setPicked((p) => { const next = new Set(p); for (const id of ids) { if (all) next.delete(id); else next.add(id) } return next })
                    }}>{g.items.filter((tx) => !tx.virtual).every((tx) => picked.has(tx.id)) ? 'desmarcar dia' : 'marcar dia'}</button>
                  )}
                </div>
                <div className="day-items">
                {g.items.map((tx) => {
                  const category = tx.category_id ? categoryMap.get(tx.category_id) : undefined
                  const parent = category?.parent_id ? categoryMap.get(category.parent_id) : undefined
                  const account = tx.account_id ? accountMap.get(tx.account_id) : undefined
                  const card = tx.card_id ? cardMap.get(tx.card_id) : undefined
                  const amount = signedAmount(tx)
                  const series = tx.series_id ? seriesMap.get(tx.series_id) : undefined
                  const cardIcon = card && <AccountIcon icon={card.icon} color={card.color} size={22} />
                  const isPicked = picked.has(tx.id)
                  const openRow = () => {
                    if (selecting) { if (!tx.virtual) togglePick(tx.id); return }
                    if (tx.virtual && tx.card_id && tx.invoice_month) navigate(`/cartoes/${tx.card_id}?fatura=${tx.invoice_month.slice(0, 7)}`)
                    else setSelectedId(tx.id)
                  }
                  const sub = tx.kind === 'transfer' ? 'Transferência'
                    : tx.kind === 'payment' || tx.virtual ? `${card?.name ?? 'Cartão'} · ${monthLabel(toMonth(tx.invoice_month!)).split(' ')[0].toLowerCase()}`
                    : category ? (parent ? `${parent.name} › ${category.name}` : category.name) : 'Sem categoria'
                  return (
                    <div key={tx.id} className={`tx-row ${tx.id === selectedId || isPicked ? 'selected' : ''} ${selecting && tx.virtual ? 'dim' : ''}`} onClick={openRow}>
                      {selecting && (
                        <span className={`pick ${isPicked ? 'on' : ''}`} role="checkbox" aria-checked={isPicked} aria-label={`Selecionar ${tx.description}`} aria-disabled={!!tx.virtual}>
                          {isPicked && <Check size={16} strokeWidth={3} />}
                        </span>
                      )}
                      {tx.kind === 'transfer' ? (
                        <span className="avatar cat" style={{ width: 40, height: 40, background: 'var(--blue)' }}><ArrowLeftRight size={18} /></span>
                      ) : tx.virtual || tx.kind === 'payment' ? (
                        <span className="avatar cat" style={{ width: 40, height: 40, background: tx.virtual ? 'var(--invoice)' : 'var(--peach)' }}>{tx.virtual ? <Receipt size={18} /> : <CreditCard size={18} />}</span>
                      ) : (
                        <CategoryAvatar category={parent ?? category} />
                      )}
                      <div className="tx-desc">
                        {tx.description || (tx.kind === 'transfer' ? 'Transferência' : category?.name ?? 'Sem descrição')}
                        {series?.kind === 'fixed' && <Repeat2 size={15} className="fixed" aria-label="Lançamento fixo" />}
                        {series?.installments && <span className="part">{tx.series_index}/{series.installments}</span>}
                        {tx.attachments.length > 0 && <Paperclip size={13} className="clip" aria-label="Com anexo" />}
                        <span className="sub">{sub}{(tx.kind === 'expense' || tx.kind === 'income') && !tx.virtual && (card ?? account) && <> · {(card ?? account)!.name}</>}</span>
                      </div>
                      {(tx.kind === 'transfer' || tx.kind === 'payment' || tx.virtual) && <div className="tx-where">
                        {tx.kind === 'transfer' ? (
                          <>
                            <AccountAvatar account={account} size={22} />
                            <ArrowRight size={14} />
                            <AccountAvatar account={tx.to_account_id ? accountMap.get(tx.to_account_id) : undefined} size={22} />
                          </>
                        ) : tx.kind === 'payment' || tx.virtual ? (
                          <><AccountAvatar account={account} size={22} /><ArrowRight size={14} />{cardIcon}</>
                        ) : null}
                      </div>}
                      <div className={`tx-amount ${tx.kind === 'income' ? 'income' : ''} ${tx.kind === 'transfer' && !accountFilter ? 'transfer' : ''}`}>
                        {tx.kind === 'transfer' && !accountFilter ? formatCents(amount) : formatSigned(amount)}
                      </div>
                      {isCardPurchase(tx) ? <span className="paid-spacer" /> : (
                        <button
                          className={`paid-btn ${tx.paid ? '' : 'pending'}`}
                          title={tx.virtual ? 'Pagar fatura' : tx.paid ? 'Pago. Clique para marcar como pendente' : 'Pendente. Clique para marcar como pago'}
                          aria-label={tx.virtual ? 'Pagar fatura' : tx.paid ? 'Pago. Desmarcar' : 'Marcar como pago'}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (selecting) return openRow()
                            if (tx.virtual) open({ kind: 'payment', cardId: tx.card_id!, invoiceMonth: tx.invoice_month! })
                            else update.mutate({ id: tx.id, patch: { paid: !tx.paid } })
                          }}
                          disabled={tx.kind === 'transfer' || tx.kind === 'payment'}
                        >
                          {tx.paid ? <ThumbsUp size={18} /> : <ThumbsDown size={18} style={{ transform: 'scaleX(-1)' }} />}
                        </button>
                      )}
                    </div>
                  )
                })}
                </div>
                {dayBalance.has(g.date) && (
                  <div className="day-balance desk-only">Saldo do dia <b className={dayBalance.get(g.date)! < 0 ? 'expense' : ''}>{formatBRL(dayBalance.get(g.date)!)}</b></div>
                )}
              </section>
            ))}
          </div>
        )}
        </section>

        <div id="tx-summary">
        <SummaryCard
          summary={summary}
          totals={{
            income: rows.filter((tx) => tx.kind === 'income' && tx.paid).reduce((s, tx) => s + tx.amount_cents, 0),
            expense: rows.filter((tx) => tx.kind === 'expense' && tx.paid).reduce((s, tx) => s + tx.amount_cents, 0),
            pendingIncome: rows.filter((tx) => tx.kind === 'income' && !tx.paid).reduce((s, tx) => s + tx.amount_cents, 0),
            pendingExpense: rows.filter((tx) => tx.kind === 'expense' && !tx.paid).reduce((s, tx) => s + tx.amount_cents, 0),
          }}
          totalsOnly={simpleTotal}
          onToggle={filteredCard ? undefined : () => setTotalsOnly(!totalsOnly)}
          title={span.kind === 'month' ? `Resumo de ${spanLabel(span)}` : `Resumo · ${spanLabel(span)}`}
          isMonth={span.kind === 'month'}
          filter={
            filteredAccount ? <span className="sum-filter"><AccountAvatar account={filteredAccount} size={20} />{filteredAccount.name}</span>
            : filteredCard ? <span className="sum-filter"><AccountIcon icon={filteredCard.icon} color={filteredCard.color} size={20} />{filteredCard.name}</span>
            : undefined
          }
        />
        </div>
        {rows.length > 0 && (
          <SummaryPill
            label={simpleTotal ? 'Saldo do período' : 'Previsto'}
            cents={simpleTotal ? rows.filter((tx) => tx.kind === 'income' && tx.paid).reduce((s, tx) => s + tx.amount_cents, 0) - rows.filter((tx) => tx.kind === 'expense' && tx.paid).reduce((s, tx) => s + tx.amount_cents, 0) : summary.forecast}
          />
        )}
      {selecting && (
        <div className="bulk-bar" role="toolbar" aria-label="Ações em lote">
          <b>{picked.size === 0 ? 'Toque nos lançamentos' : picked.size === 1 ? '1 selecionado' : `${picked.size} selecionados`}</b>
          <button className="btn" disabled={payable.length === 0} onClick={() => bulk(transactionsTable.updateMany(payable.map((tx) => tx.id), { paid: true }), 'Marcados como pagos.')}>
            <ThumbsUp size={18} /> Pago
          </button>
          <button className="btn" disabled={payable.length === 0} onClick={() => bulk(transactionsTable.updateMany(payable.map((tx) => tx.id), { paid: false }), 'Marcados como pendentes.')}>
            <Undo2 size={18} /> Pendente
          </button>
          <Popover
            trigger={(_, toggle) => (
              <button className="btn" disabled={!categoryKind} onClick={toggle} title={categoryKind ? undefined : 'Selecione só despesas ou só receitas'}><Tag size={18} /> Categoria</button>
            )}
          >
            {(close) => categoryKind && orderedCategories(categories, categoryKind).map(({ category, depth }) => (
              <button key={category.id} className={`picker-item ${depth ? 'sub' : ''}`} onClick={() => {
                close()
                bulk(transactionsTable.updateMany(pickedRows.map((tx) => tx.id), { category_id: category.id }), `Categoria trocada para ${category.name}.`)
              }}>
                {!depth && <CategoryAvatar category={category} size={26} />} {category.name}
              </button>
            ))}
          </Popover>
          <button className="btn btn-pink" disabled={picked.size === 0} onClick={bulkDelete}><Trash2 size={18} /> Excluir</button>
          <button className="icon-btn" onClick={stopSelecting} aria-label="Cancelar seleção"><X size={18} /></button>
        </div>
      )}
      {choosingMode && <ModeModal mode={mode} onChange={setMode} onClose={() => setChoosingMode(false)} />}
      {selected && (
        <TransactionPanel
          tx={selected}
          onClose={() => setSelectedId(null)}
          onNavigate={(id) => {
            const target = txs.find((tx) => tx.id === id)
            if (target) setSpan(spanAt(prefs.period, target.date))
            setSelectedId(id)
          }}
        />
      )}
    </main>
  )
}

const MODE_TEXT: Record<ViewMode, string[]> = {
  cash: [
    'Só o dinheiro que entra e sai das suas contas;',
    'As compras avulsas do cartão não aparecem;',
    'Faturas e pagamentos de fatura aparecem normalmente.',
  ],
  all: [
    'Cada lançamento seu, um por um;',
    'Incluindo todas as compras no cartão de crédito;',
    'Faturas e pagamentos de fatura ficam de fora (pra não contar a mesma despesa duas vezes).',
  ],
}

function ModeModal({ mode, onChange, onClose }: { mode: ViewMode; onChange: (m: ViewMode) => void; onClose: () => void }) {
  return (
    <Modal title="Modo de visualização" onClose={onClose}>
      <Segmented value={mode} onChange={onChange} options={[['cash', 'Fluxo de caixa'], ['all', 'Todos os lançamentos']]} />
      <p style={{ fontWeight: 600, fontSize: 13, margin: '18px 0 6px' }}>O que você vê neste modo:</p>
      <ul className="mode-list">{MODE_TEXT[mode].map((line) => <li key={line}>{line}</li>)}</ul>
      <button className="btn btn-primary" style={{ display: 'flex', margin: '18px auto 0', minWidth: 90 }} onClick={onClose}>OK</button>
    </Modal>
  )
}

function PeriodNav({ span, setSpan }: { span: Span; setSpan: (s: Span) => void }) {
  const [prev, next] = { day: ['Dia anterior', 'Próximo dia'], week: ['Semana anterior', 'Próxima semana'], month: ['Mês anterior', 'Próximo mês'] }[span.kind]
  return (
    <div className="month-nav">
      <button onClick={() => setSpan(shiftSpan(span, -1))} aria-label={prev}><ChevronLeft size={20} /></button>
      <span>{spanLabel(span)}</span>
      <button onClick={() => setSpan(shiftSpan(span, 1))} aria-label={next}><ChevronRight size={20} /></button>
    </div>
  )
}

/** Phone: the period's total floating above the tab bar until the summary card itself scrolls into view; a tap goes there. */
function SummaryPill({ label, cents }: { label: string; cents: number }) {
  const [cardVisible, setCardVisible] = useState(false)
  useEffect(() => {
    const el = document.getElementById('tx-summary')
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setCardVisible(e.isIntersecting), { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  if (cardVisible) return null
  return (
    <button className="sum-pill phone-only" onClick={() => document.getElementById('tx-summary')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
      <span>{label}</span>
      <b className={cents < 0 ? 'expense' : ''}>{formatBRL(cents)}</b>
      <ChevronUp size={18} />
    </button>
  )
}
