import { Minus, Plus, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PeriodSummary } from '../lib/balances'
import { formatBRL, formatCents } from '../lib/money'

/**
 * The card at the end of Lançamentos. With balances: the forecast for the end
 * of the period, and one bar for all the period's money (what was already there
 * plus what comes in) split into paid, still to pay and what's left. With the
 * button pressed: just the money in and out.
 */
export function SummaryCard({
  summary, totals, totalsOnly, onToggle, title, isMonth, filter,
}: {
  summary: PeriodSummary
  totals: { income: number; expense: number }
  totalsOnly: boolean
  /** Left out when only totals make sense (a card is filtered). */
  onToggle?: () => void
  /** "Resumo de outubro", shown on the phone. */
  title: string
  isMonth: boolean
  /** The filtered account or card, if any. */
  filter?: ReactNode
}) {
  const word = isMonth ? 'mês' : 'período'
  const toggle = onToggle && (
    <button className="summary-toggle" onClick={onToggle} aria-pressed={totalsOnly}
      aria-label={totalsOnly ? 'Mostrar saldos' : 'Mostrar só entradas e saídas'} title={totalsOnly ? 'Mostrar saldos' : 'Mostrar só entradas e saídas'}>
      {totalsOnly ? <Plus size={16} /> : <Minus size={16} />}
    </button>
  )
  const head = <div className="sum-head"><span>{title}</span>{filter && <span className="sum-head-filter">{filter}</span>}{toggle}</div>
  const heroFilter = filter && <div className="sum-hero-filter">{filter}</div>

  if (totalsOnly) {
    const { income, expense } = totals
    return (
      <section className="card summary-card" aria-label="Resumo">
        {head}
        <div className="sum-body">
          <div className="sum-hero">
            {heroFilter}
            <div className="k">Saldo do período</div>
            <div className="sum-big">{formatBRL(income - expense)}</div>
          </div>
          <div className="sum-side">
            <div className="sum-split">
              {income + expense === 0 ? <i style={{ flex: 1 }} /> : (
                <>
                  {income > 0 && <i className="in" style={{ flex: income }}><span><em>Entradas </em>{formatCents(income)}</span></i>}
                  {expense > 0 && <i className="out" style={{ flex: expense }}><span><em>Saídas </em>{formatCents(expense)}</span></i>}
                </>
              )}
            </div>
            {income + expense > 0 && <div className="sum-split-legend"><small>entradas</small><small>saídas</small></div>}
          </div>
        </div>
      </section>
    )
  }

  const { previous, incomeAll, expensePaid, expenseAll, balance, forecast } = summary
  const toPay = expenseAll - expensePaid
  const left = Math.max(forecast, 0)
  const short = Math.max(-forecast, 0)
  const whole = expensePaid + toPay + left
  return (
    <section className="card summary-card" aria-label="Resumo">
      {head}
      <div className="sum-body">
        <div className="sum-hero">
          {heroFilter}
          <div className="k">Previsto pro fim do {word}</div>
          <div className={`sum-big${forecast < 0 ? ' expense' : ''}`}>{formatBRL(forecast)}</div>
          <div className="sum-minis">
            <div><span>Saldo anterior</span><b>{formatBRL(previous)}</b></div>
            <div><span>Saldo atual</span><b>{formatBRL(balance)}</b></div>
          </div>
        </div>
        <div className="sum-side">
          <div className="sum-side-head">
            <span className="k">Dinheiro do {word}</span>
            <small className="sum-sum">{formatBRL(previous)} que já tinha + {formatBRL(incomeAll)} de receitas = <b>{formatBRL(previous + incomeAll)}</b></small>
            <b className="sum-sum-short">{formatBRL(previous + incomeAll)}</b>
          </div>
          <div className="sum-bar" role="img" aria-label={`Já pago ${formatBRL(expensePaid)}, a pagar ${formatBRL(toPay)}, ${short ? `${formatBRL(short)} negativo` : `sobra ${formatBRL(left)}`}`}>
            {whole === 0 ? <i style={{ flex: 1 }} /> : (
              <>
                {expensePaid > 0 && <i className="paid" style={{ flex: expensePaid }} />}
                {toPay > 0 && <i className="topay" style={{ flex: toPay }} />}
                {left > 0 && <i className="left" style={{ flex: left }} />}
              </>
            )}
          </div>
          <div className="sum-legend">
            <span><b className="sw paid" /><span className="lbl">já pago</span> <b className="v">{formatCents(expensePaid)}</b><span className="lbl-after">pago</span></span>
            <span><b className="sw topay" /><span className="lbl">a pagar</span> <b className="v">{formatCents(toPay)}</b><span className="lbl-after">a pagar</span></span>
            {short > 0
              ? <span className="sum-neg"><TriangleAlert size={14} strokeWidth={2.5} aria-hidden="true" /><b className="v">{formatCents(short)}</b> negativo</span>
              : <span><b className="sw left" /><span className="lbl">sobra</span> <b className="v">{formatCents(left)}</b><span className="lbl-after">sobra</span></span>}
          </div>
        </div>
      </div>
    </section>
  )
}
