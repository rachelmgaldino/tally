import {
  ArrowLeftRight, ArrowRight, ChevronLeft, ChevronRight, CreditCard, Info, Paperclip, Plus, Receipt, Repeat2, Search, ThumbsUp, X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccountAvatar, AccountIcon, CategoryAvatar } from '../components/Avatars'
import { FilterMenu } from '../components/FilterMenu'
import { Popover } from '../components/Picker'
import { orderedCategories } from '../components/Selects'
import { TransactionPanel } from '../components/TransactionPanel'
import { useTxForm } from '../components/TxFormContext'
import { Modal, Segmented } from '../components/ui'
import { periodSummary } from '../lib/balances'
import { cashFlow, isCardPurchase, toMonth } from '../lib/cards'
import { useSeriesUpkeep } from '../lib/entries'
import { addMonths, currentMonth, monthEnd, monthLabel, monthStart, shortDate, today } from '../lib/dates'

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
/** "sábado, 18/10" */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${shortDate(iso).slice(0, 5)}`
}
import { formatBRL, formatCents, formatSigned } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useSeries, useTags, useTransactionMutations, useTransactions } from '../lib/queries'
import type { Transaction, TxKind } from '../lib/types'

const KIND_FILTERS: [TxKind, string][] = [['expense', 'Despesas'], ['income', 'Receitas'], ['transfer', 'Transferências'], ['payment', 'Pagamentos de fatura']]

/** "Fluxo de caixa" shows money moving in accounts; "Todos os lançamentos" every entry, card purchases included. */
type ViewMode = 'cash' | 'all'
const MODE_KEY = 'tally-view-mode'

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

  const [month, setMonth] = useState(currentMonth)
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<TxKind | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setModeState] = useState<ViewMode>(() => {
    try { return localStorage.getItem(MODE_KEY) === 'all' ? 'all' : 'cash' } catch { return 'cash' }
  })
  const [choosingMode, setChoosingMode] = useState(false)
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
  const from = monthStart(month)
  const to = monthEnd(month)
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
      .sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)))
  }, [source, from, to, accountFilter, filteredCard, kindFilter, categoryFilter, tagFilter, search, categoryMap])

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
  // A plain total (income minus expenses, transfers left out) when the list isn't about account balances.
  const simpleTotal = mode === 'all' || !!filteredCard
  const total = rows.reduce((s, tx) => s + (tx.kind === 'income' ? tx.amount_cents : tx.kind === 'expense' ? -tx.amount_cents : 0), 0)
  const filteredAccount = accountFilter ? accountMap.get(accountFilter) : undefined
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
      <main className="page page-narrow">
        <header className="page-head"><h1>Lançamentos</h1><MonthNav month={month} setMonth={setMonth} /></header>
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
    <main className="page page-narrow">
      <header className="page-head">
        <h1>Lançamentos</h1>
        <div className="head-actions">
          <MonthNav month={month} setMonth={setMonth} />
          <div className="segmented" role="group" aria-label="Modo de visualização">
            <button className={mode === 'cash' ? 'on' : ''} aria-pressed={mode === 'cash'} onClick={() => setMode('cash')}>Fluxo de caixa</button>
            <button className={mode === 'all' ? 'on' : ''} aria-pressed={mode === 'all'} onClick={() => setMode('all')}>Todos os lançamentos</button>
          </div>
          <button className="icon-btn" onClick={() => setChoosingMode(true)} aria-label="Sobre os modos de visualização" title="Sobre os modos de visualização"><Info size={20} /></button>
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
          <label className="search-pill">
            <Search size={18} />
            <input placeholder="Buscar lançamento" aria-label="Buscar lançamento" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} aria-label="Limpar busca"><X size={16} /></button>}
          </label>
          {hasFilters && <button className="fil" onClick={clearFilters}><X size={16} /> Limpar</button>}
        </div>

        <section className="card list-card" aria-label="Lista de lançamentos">

        {isLoading ? (
          <div className="empty"><p>Carregando…</p></div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <div className="empty-ghost"><div /><div /><div /></div>
            <h3>Nenhum lançamento no período</h3>
            <p>Adicione um lançamento ou escolha outro mês</p>
            <button className="btn btn-ghost-green" onClick={() => open({ kind: 'expense', accountId: accountFilter ?? undefined })}>Adicionar lançamento</button>
          </div>
        ) : (
          <div className="tx-list">
            {groups.map((g) => (
              <section key={g.date}>
                <div className={`day-head ${g.date === t ? 'today' : ''}`}>{g.date === t ? `Hoje · ${dayLabel(g.date)}` : dayLabel(g.date)}</div>
                {g.items.map((tx) => {
                  const category = tx.category_id ? categoryMap.get(tx.category_id) : undefined
                  const parent = category?.parent_id ? categoryMap.get(category.parent_id) : undefined
                  const account = tx.account_id ? accountMap.get(tx.account_id) : undefined
                  const card = tx.card_id ? cardMap.get(tx.card_id) : undefined
                  const amount = signedAmount(tx)
                  const series = tx.series_id ? seriesMap.get(tx.series_id) : undefined
                  const cardIcon = card && <AccountIcon icon={card.icon} color={card.color} size={22} />
                  const openRow = () => {
                    if (tx.virtual && tx.card_id && tx.invoice_month) navigate(`/cartoes/${tx.card_id}?fatura=${tx.invoice_month.slice(0, 7)}`)
                    else setSelectedId(tx.id)
                  }
                  const sub = tx.kind === 'transfer' ? 'Transferência'
                    : tx.kind === 'payment' || tx.virtual ? `${card?.name ?? 'Cartão'} · ${monthLabel(toMonth(tx.invoice_month!)).split(' ')[0].toLowerCase()}`
                    : category ? (parent ? `${parent.name} › ${category.name}` : category.name) : 'Sem categoria'
                  return (
                    <div key={tx.id} className={`tx-row ${tx.id === selectedId ? 'selected' : ''}`} onClick={openRow}>
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
                        <span className="sub">{sub}</span>
                      </div>
                      <div className="tx-where">
                        {tx.kind === 'transfer' ? (
                          <>
                            <AccountAvatar account={account} size={22} />
                            <ArrowRight size={14} />
                            <AccountAvatar account={tx.to_account_id ? accountMap.get(tx.to_account_id) : undefined} size={22} />
                          </>
                        ) : tx.kind === 'payment' || tx.virtual ? (
                          <><AccountAvatar account={account} size={22} /><ArrowRight size={14} />{cardIcon}</>
                        ) : card ? cardIcon : (
                          <AccountAvatar account={account} size={22} />
                        )}
                      </div>
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
                            if (tx.virtual) open({ kind: 'payment', cardId: tx.card_id!, invoiceMonth: tx.invoice_month! })
                            else update.mutate({ id: tx.id, patch: { paid: !tx.paid } })
                          }}
                          disabled={tx.kind === 'transfer' || tx.kind === 'payment'}
                        >
                          <ThumbsUp size={18} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        )}
        </section>

        <section className="card summary-card" aria-label="Resumo">
          {filteredAccount && <div><div className="k">Conta</div><div className="row" style={{ marginTop: 6, fontWeight: 800 }}><AccountAvatar account={filteredAccount} size={24} />{filteredAccount.name}</div></div>}
          {filteredCard && <div><div className="k">Cartão</div><div className="row" style={{ marginTop: 6, fontWeight: 800 }}><AccountIcon icon={filteredCard.icon} color={filteredCard.color} size={24} />{filteredCard.name}</div></div>}
          {simpleTotal ? (
            <>
              <div><div className="k">Entradas</div><div className="v income">{formatBRL(rows.filter((tx) => tx.kind === 'income').reduce((s, tx) => s + tx.amount_cents, 0))}</div></div>
              <div><div className="k">Saídas</div><div className="v expense">{formatBRL(rows.filter((tx) => tx.kind === 'expense').reduce((s, tx) => s + tx.amount_cents, 0))}</div></div>
              <div className="boxed"><div className="k">Total</div><div className="v">{formatCents(total)}</div></div>
            </>
          ) : (
            <>
              <div><div className="k">Saldo anterior</div><div className="v">{formatBRL(summary.previous)}</div></div>
              <div><div className="k">Receitas</div><div className="v income">{formatBRL(summary.incomePaid)}</div><small>previsto {formatBRL(summary.incomeAll)}</small></div>
              <div><div className="k">Despesas</div><div className="v expense">{formatBRL(summary.expensePaid)}</div><small>previsto {formatBRL(summary.expenseAll)}</small></div>
              <div><div className="k">Saldo</div><div className="v">{formatBRL(summary.balance)}</div></div>
              <div className="boxed"><div className="k">Previsto</div><div className="v">{formatBRL(summary.forecast)}</div></div>
            </>
          )}
        </section>
      {choosingMode && <ModeModal mode={mode} onChange={setMode} onClose={() => setChoosingMode(false)} />}
      {selected && (
        <TransactionPanel
          tx={selected}
          onClose={() => setSelectedId(null)}
          onNavigate={(id) => {
            const target = txs.find((tx) => tx.id === id)
            if (target) setMonth({ year: Number(target.date.slice(0, 4)), month: Number(target.date.slice(5, 7)) })
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
    'Faturas e pagamentos de fatura aparecem normalmente;',
    'No resumo, você vê o saldo e a previsão de saldo do período.',
  ],
  all: [
    'Cada lançamento seu, um por um;',
    'Incluindo todas as compras no cartão de crédito;',
    'Faturas e pagamentos de fatura ficam de fora (pra não contar a mesma despesa duas vezes);',
    'No resumo, só as entradas e saídas do período.',
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

function MonthNav({ month, setMonth }: { month: ReturnType<typeof currentMonth>; setMonth: (m: ReturnType<typeof currentMonth>) => void }) {
  return (
    <div className="month-nav">
      <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior"><ChevronLeft size={20} /></button>
      <span>{monthLabel(month).toLowerCase()}</span>
      <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRight size={20} /></button>
    </div>
  )
}
