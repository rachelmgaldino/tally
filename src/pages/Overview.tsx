import { ArrowLeftRight, CircleMinus, CirclePlus, CreditCard, Eye, EyeOff, Landmark } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AccountAvatar, CategoryAvatar } from '../components/Avatars'
import { useTxForm } from '../components/TxFormContext'
import { accountBalance, effectOn } from '../lib/balances'
import { currentMonth, monthEnd, monthStart, shortDate, today } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { byId, useAccounts, useCategories, useTransactions } from '../lib/queries'
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
  const m = currentMonth()
  const from = monthStart(m)
  const to = monthEnd(m)
  const t = today()
  const inMonth = txs.filter((tx) => tx.date >= from && tx.date < to)
  const income = inMonth.filter((tx) => tx.kind === 'income').reduce((s, tx) => s + tx.amount_cents, 0)
  const expense = inMonth.filter((tx) => tx.kind === 'expense').reduce((s, tx) => s + tx.amount_cents, 0)

  const active = accounts.filter((a) => !a.archived)
  const balances = new Map(active.map((a) => [a.id, accountBalance(a, txs).current]))
  const total = active.filter((a) => !a.exclude_from_total).reduce((s, a) => s + (balances.get(a.id) ?? 0), 0)

  const categoryMap = byId(categories)
  const accountMap = byId(accounts)
  const toPay = txs.filter((tx) => tx.kind === 'expense' && !tx.paid && tx.date < to).sort((a, b) => a.date.localeCompare(b.date))
  const overdue = toPay.filter((tx) => tx.date < t)
  const upcomingPay = toPay.filter((tx) => tx.date >= t)
  const toReceive = txs.filter((tx) => tx.kind === 'income' && !tx.paid).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)

  const billRow = (tx: Transaction, cls: string) => {
    const c = tx.category_id ? categoryMap.get(tx.category_id) : undefined
    const parent = c?.parent_id ? categoryMap.get(c.parent_id) : undefined
    return (
      <div key={tx.id} className="account-line" style={{ padding: '10px 0' }}>
        <CategoryAvatar category={parent ?? c} size={26} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13 }}>{tx.description || c?.name}</div>
          <div className="muted small">{shortDate(tx.date)} · {accountMap.get(tx.account_id)?.name}</div>
        </div>
        <b className={cls} style={{ fontSize: 13, fontWeight: 500 }}>{money(Math.abs(effectOn(tx, tx.account_id)))}</b>
      </div>
    )
  }

  return (
    <main className="page">
      <div className="stack">
        <section className="card card-pad hello">
          <div style={{ flex: 1 }}>
            <div className="muted">{greeting()}</div>
            <h1 style={{ fontSize: 16, marginTop: 4 }}>{name}!</h1>
            <div className="stats">
              <div><div className="k">Receita mensal</div><div className="v income">{money(income)}</div></div>
              <div><div className="k">Despesa mensal</div><div className="v expense">{money(expense)}</div></div>
            </div>
          </div>
          <div className="quick">
            <button onClick={() => open({ kind: 'expense' })}><CircleMinus size={16} className="expense" /> Despesa</button>
            <button onClick={() => open({ kind: 'income' })}><CirclePlus size={16} className="income" /> Entrada</button>
            <button onClick={() => open({ kind: 'transfer' })}><ArrowLeftRight size={16} /> Transferência</button>
          </div>
        </section>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="stack">
            <section className="card card-pad">
              {active.length === 0 ? (
                <div className="placeholder">
                  <span className="ico"><Landmark size={18} /></span>
                  <h3>Lista de contas</h3>
                  <p>Aqui você poderá ver todos os saldos das suas contas.</p>
                  <button className="btn btn-soft" style={{ marginTop: 14 }} onClick={() => navigate('/configuracoes/contas?nova=1')}>
                    <CirclePlus size={15} /> Adicionar conta
                  </button>
                </div>
              ) : (
                <>
                  <div className="total-head">
                    <div className="k">Saldo geral</div>
                    <div className="v">
                      {money(total)}
                      <button onClick={toggleHidden} aria-label={hidden ? 'Mostrar valores' : 'Esconder valores'} className="muted" style={{ display: 'flex' }}>
                        {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <h3 style={{ fontSize: 15, margin: '22px 0 4px' }}>Minhas contas</h3>
                  {active.map((a) => (
                    <div key={a.id} className="account-line">
                      <AccountAvatar account={a} size={32} />
                      <div style={{ flex: 1 }}>
                        <div>{a.name}</div>
                        <div className="muted small">{a.exclude_from_total ? 'Fora do saldo geral' : 'Conta manual'}</div>
                      </div>
                      <b className="balance" style={{ fontWeight: 600 }}>{money(balances.get(a.id) ?? 0)}</b>
                    </div>
                  ))}
                  <button className="manage-btn" onClick={() => navigate('/configuracoes/contas')}>Gerenciar contas</button>
                </>
              )}
            </section>

            <section className="card card-pad">
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>Contas a pagar</h3>
              {toPay.length === 0 && <p className="muted small" style={{ margin: 0 }}>Nenhuma despesa pendente este mês.</p>}
              {overdue.length > 0 && (
                <>
                  <div className="badge" style={{ display: 'block', textAlign: 'center', background: '#fde4e6', color: 'var(--expense)', padding: 6 }}>Contas a pagar atrasadas</div>
                  {overdue.map((tx) => billRow(tx, 'expense'))}
                </>
              )}
              {upcomingPay.length > 0 && (
                <>
                  <div className="badge" style={{ display: 'block', textAlign: 'center', padding: 6, marginTop: overdue.length ? 10 : 0 }}>Próximas</div>
                  {upcomingPay.map((tx) => billRow(tx, ''))}
                </>
              )}
            </section>

            <section className="card card-pad">
              <h3 style={{ fontSize: 15, marginBottom: 10 }}>Contas a receber</h3>
              {toReceive.length === 0 ? (
                <p className="muted small" style={{ margin: 0 }}>Nenhuma receita pendente.</p>
              ) : (
                <>
                  <div className="badge" style={{ display: 'block', textAlign: 'center', padding: 6 }}>Próximas</div>
                  {toReceive.map((tx) => billRow(tx, ''))}
                </>
              )}
            </section>
          </div>

          <section className="card card-pad">
            <div className="placeholder">
              <span className="ico"><CreditCard size={18} /></span>
              <h3>Lista de cartões de crédito</h3>
              <p>Cartões e faturas chegam na próxima etapa.</p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
