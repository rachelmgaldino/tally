import {
  ArrowLeftRight, ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, Search, ThumbsDown, ThumbsUp, X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AccountAvatar, CategoryAvatar } from '../components/Avatars'
import { Popover } from '../components/Picker'
import { orderedCategories } from '../components/Selects'
import { TransactionPanel } from '../components/TransactionPanel'
import { useTxForm } from '../components/TxFormContext'
import { periodSummary } from '../lib/balances'
import { addMonths, currentMonth, monthEnd, monthLabel, monthStart, shortDate, today } from '../lib/dates'
import { formatCents, formatSigned } from '../lib/money'
import { byId, useAccounts, useCategories, useTransactionMutations, useTransactions } from '../lib/queries'
import type { Transaction, TxKind } from '../lib/types'

const KIND_FILTERS: [TxKind, string][] = [['expense', 'Despesas'], ['income', 'Receitas'], ['transfer', 'Transferências']]

export default function Transactions() {
  const { data: accounts = [], isLoading: loadingAccounts } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: txs = [], isLoading } = useTransactions()
  const { update } = useTransactionMutations()
  const { open } = useTxForm()

  const [month, setMonth] = useState(currentMonth)
  const [accountFilter, setAccountFilter] = useState<string | null>(null)
  const [kindFilter, setKindFilter] = useState<TxKind | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const accountMap = byId(accounts)
  const categoryMap = byId(categories)
  const from = monthStart(month)
  const to = monthEnd(month)
  const t = today()

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return txs
      .filter((tx) => tx.date >= from && tx.date < to)
      .filter((tx) => !accountFilter || tx.account_id === accountFilter || tx.to_account_id === accountFilter)
      .filter((tx) => !kindFilter || tx.kind === kindFilter)
      .filter((tx) => {
        if (!categoryFilter) return true
        const c = tx.category_id ? categoryMap.get(tx.category_id) : undefined
        return !!c && (c.id === categoryFilter || c.parent_id === categoryFilter)
      })
      .filter((tx) => !needle || tx.description.toLowerCase().includes(needle))
      .sort((a, b) => (a.date === b.date ? b.created_at.localeCompare(a.created_at) : b.date.localeCompare(a.date)))
  }, [txs, from, to, accountFilter, kindFilter, categoryFilter, search, categoryMap])

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
  const summary = periodSummary(summaryAccounts, txs, from, to)
  const filteredAccount = accountFilter ? accountMap.get(accountFilter) : undefined
  const selected = selectedId ? txs.find((tx) => tx.id === selectedId) : undefined
  const hasFilters = accountFilter || kindFilter || categoryFilter || search

  function clearFilters() {
    setAccountFilter(null)
    setKindFilter(null)
    setCategoryFilter(null)
    setSearch('')
    setSearching(false)
  }

  function signedAmount(tx: Transaction): number {
    if (tx.kind === 'income') return tx.amount_cents
    if (tx.kind === 'expense') return -tx.amount_cents
    if (accountFilter === tx.to_account_id) return tx.amount_cents
    if (accountFilter === tx.account_id) return -tx.amount_cents
    return tx.amount_cents
  }

  if (!loadingAccounts && accounts.length === 0) {
    return (
      <main className="page page-narrow">
        <div className="card">
          <div className="tx-toolbar"><MonthNav month={month} setMonth={setMonth} /></div>
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
      <div className="card">
        <div className="tx-toolbar">
          <Popover
            popClassName="menu-dark"
            trigger={(_, toggle) => (
              <button className="btn btn-dark" onClick={toggle}><Plus size={16} /> Lançamento</button>
            )}
          >
            {(close) => (
              <>
                {([['expense', 'Nova Despesa', 'D'], ['income', 'Nova Receita', 'R'], ['transfer', 'Nova Transferência', 'T']] as const).map(([kind, label, key]) => (
                  <button key={kind} onClick={() => { close(); open({ kind, accountId: accountFilter ?? undefined }) }}>
                    {label} <span className="kbd">letra {key}</span>
                  </button>
                ))}
              </>
            )}
          </Popover>
          <MonthNav month={month} setMonth={setMonth} />
        </div>

        <div className="filters">
          <div className="filter-bar">
            <FilterMenu
              label={filteredAccount?.name ?? 'Origem'}
              on={!!accountFilter}
              items={[
                { id: null, label: 'Todas as contas' },
                ...accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, label: a.name })),
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
            {searching ? (
              <input autoFocus placeholder="Buscar pela descrição" value={search} onChange={(e) => setSearch(e.target.value)} />
            ) : (
              <span className="spacer" />
            )}
            {hasFilters && <button className="muted small" onClick={clearFilters}>Limpar</button>}
          </div>
          <button className="round-btn" onClick={() => setSearching((s) => !s)} aria-label="Buscar">
            {searching ? <X size={16} /> : <Search size={16} />}
          </button>
        </div>

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
                <div className={`day-head ${g.date === t ? 'today' : ''}`}>{g.date === t ? 'Hoje' : shortDate(g.date)}</div>
                {g.items.map((tx) => {
                  const category = tx.category_id ? categoryMap.get(tx.category_id) : undefined
                  const parent = category?.parent_id ? categoryMap.get(category.parent_id) : undefined
                  const account = accountMap.get(tx.account_id)
                  const amount = signedAmount(tx)
                  return (
                    <div key={tx.id} className={`tx-row ${tx.id === selectedId ? 'selected' : ''}`} onClick={() => setSelectedId(tx.id)}>
                      {tx.kind === 'transfer' ? (
                        <span className="avatar" style={{ width: 32, height: 32, background: 'var(--green-dark)', color: '#fff' }}><ArrowLeftRight size={15} /></span>
                      ) : (
                        <CategoryAvatar category={parent ?? category} />
                      )}
                      <div className="tx-desc">
                        {tx.description || (tx.kind === 'transfer' ? 'Transferência' : category?.name ?? 'Sem descrição')}
                        {category && parent && <span className="sub">{category.name}</span>}
                      </div>
                      <div className="tx-where">
                        {tx.kind === 'transfer' ? (
                          <>
                            <AccountAvatar account={account} size={18} />
                            <ChevronRight size={12} />
                            <AccountAvatar account={tx.to_account_id ? accountMap.get(tx.to_account_id) : undefined} size={18} />
                          </>
                        ) : (
                          <><AccountAvatar account={account} size={18} /> {account?.name}</>
                        )}
                      </div>
                      <div className={`tx-amount ${tx.kind === 'income' ? 'income' : ''}`}>
                        {tx.kind === 'transfer' && !accountFilter ? formatCents(amount) : formatSigned(amount)}
                      </div>
                      <button
                        className={`paid-btn ${tx.paid ? '' : 'pending'}`}
                        title={tx.paid ? 'Pago — clique para marcar como pendente' : 'Pendente — clique para marcar como pago'}
                        onClick={(e) => { e.stopPropagation(); update.mutate({ id: tx.id, patch: { paid: !tx.paid } }) }}
                        disabled={tx.kind === 'transfer'}
                      >
                        {tx.paid ? <ThumbsUp size={15} fill="currentColor" /> : <ThumbsDown size={15} fill="currentColor" />}
                      </button>
                    </div>
                  )
                })}
              </section>
            ))}
          </div>
        )}

        <footer className="tx-footer">
          <div className="summary">
            {filteredAccount && (
              <>
                <div className="line"><span>Conta</span><b className="row" style={{ gap: 6, color: 'var(--text)' }}><AccountAvatar account={filteredAccount} size={16} />{filteredAccount.name}</b></div>
                <hr />
              </>
            )}
            {expanded && (
              <>
                <div className="line"><span>saldo anterior</span><b style={{ color: 'var(--text)' }}>{formatCents(summary.previous)}</b></div>
                <hr />
                <div className="line"><span>receita realizada</span><b className="income">{formatCents(summary.incomePaid)}</b></div>
                <div className="line"><span>receita prevista</span><b>{formatCents(summary.incomeAll)}</b></div>
                <div className="line"><span>despesa realizada</span><b className="expense">{formatCents(-summary.expensePaid)}</b></div>
                <div className="line"><span>despesa prevista</span><b>{formatCents(-summary.expenseAll)}</b></div>
                <hr />
              </>
            )}
            <div className="line"><span>saldo</span><b className="big balance">{formatCents(summary.balance)}</b></div>
            <div className="line"><span>previsto</span><b className="big">{formatCents(summary.forecast)}</b></div>
          </div>
          <button className="icon-btn" style={{ border: 0, background: expanded ? '#e7e8e4' : 'transparent' }} onClick={() => setExpanded((e) => !e)} aria-label={expanded ? 'Recolher resumo' : 'Expandir resumo'}>
            {expanded ? <Minus size={16} /> : <Plus size={16} />}
          </button>
        </footer>
      </div>
      {selected && <TransactionPanel tx={selected} onClose={() => setSelectedId(null)} />}
    </main>
  )
}

function MonthNav({ month, setMonth }: { month: ReturnType<typeof currentMonth>; setMonth: (m: ReturnType<typeof currentMonth>) => void }) {
  return (
    <div className="month-nav">
      <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
      <span>{monthLabel(month)}</span>
      <button onClick={() => setMonth(addMonths(month, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
    </div>
  )
}

function FilterMenu<T extends string | null>({
  label, on, items, value, onChange,
}: {
  label: string
  on: boolean
  items: { id: T | null; label: string; sub?: boolean }[]
  value: T | null
  onChange: (v: T | null) => void
}) {
  return (
    <Popover
      trigger={(_, toggle) => (
        <button className={on ? 'on' : ''} onClick={toggle}>{label} <ChevronDown size={13} /></button>
      )}
    >
      {(close) =>
        items.map((item) => (
          <button
            key={item.id ?? 'all'}
            className={`picker-item ${item.sub ? 'sub' : ''} ${item.id === value ? 'on' : ''}`}
            onClick={() => { onChange(item.id); close() }}
          >
            {item.label}
          </button>
        ))
      }
    </Popover>
  )
}

