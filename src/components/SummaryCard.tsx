import { Minus, Plus, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { PeriodSummary } from '../lib/balances'
import { t } from '../lib/i18n'
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
  /** Paid in and out, plus what is still pending (shown when nothing is paid yet). */
  totals: { income: number; expense: number; pendingIncome: number; pendingExpense: number }
  totalsOnly: boolean
  /** Left out when only totals make sense (a card is filtered). */
  onToggle?: () => void
  /** "Resumo de outubro", shown on the phone. */
  title: string
  isMonth: boolean
  /** The filtered account or card, if any. */
  filter?: ReactNode
}) {
  const s = t().entries.card
  const toggle = onToggle && (
    <button className="summary-toggle" onClick={onToggle} aria-pressed={totalsOnly}
      aria-label={totalsOnly ? s.showBalances : s.showTotals} title={totalsOnly ? s.showBalances : s.showTotals}>
      {totalsOnly ? <Plus size={16} /> : <Minus size={16} />}
    </button>
  )
  const head = <div className="sum-head"><span>{title}</span>{filter && <span className="sum-head-filter">{filter}</span>}{toggle}</div>
  const heroFilter = filter && <div className="sum-hero-filter">{filter}</div>

  if (totalsOnly) {
    const { income, expense, pendingIncome, pendingExpense } = totals
    return (
      <section className="card summary-card" aria-label={s.summary}>
        {head}
        <div className="sum-body">
          <div className="sum-hero">
            {heroFilter}
            <div className="k">{s.periodBalance}</div>
            <div className="sum-big">{formatBRL(income - expense)}</div>
          </div>
          <div className="sum-side">
            {income + expense === 0 ? (
              <p className="sum-pending">
                {pendingIncome + pendingExpense === 0 ? s.nothing(isMonth) : (
                  <>
                    <span>{s.stillToCome}</span>{' '}
                    {pendingIncome > 0 && <b className="in">{s.comingIn(formatCents(pendingIncome))}</b>}
                    {pendingIncome > 0 && pendingExpense > 0 && ' · '}
                    {pendingExpense > 0 && <b className="out">{s.goingOut(formatCents(pendingExpense))}</b>}
                  </>
                )}
              </p>
            ) : (
              <>
                <div className="sum-split">
                  {income > 0 && <i className="in" style={{ flex: income }}><span><em>{s.incomeIn}</em>{formatCents(income)}</span></i>}
                  {expense > 0 && <i className="out" style={{ flex: expense }}><span><em>{s.expenseIn}</em>{formatCents(expense)}</span></i>}
                </div>
                <div className="sum-split-legend"><small>{s.incomeLegend}</small><small>{s.expenseLegend}</small></div>
              </>
            )}
          </div>
        </div>
      </section>
    )
  }

  const { previous, incomeAll, expensePaid, expenseAll, balance, forecast, saved } = summary
  const toPay = expenseAll - expensePaid
  const left = Math.max(forecast, 0)
  const short = Math.max(-forecast, 0)
  const kept = Math.max(saved, 0)
  const whole = expensePaid + toPay + kept + left
  return (
    <section className="card summary-card" aria-label={s.summary}>
      {head}
      <div className="sum-body">
        <div className="sum-hero">
          {heroFilter}
          <div className="k">{s.forecastEnd(isMonth)}</div>
          <div className={`sum-big${forecast < 0 ? ' expense' : ''}`}>{formatBRL(forecast)}</div>
          <div className="sum-minis">
            <div><span>{s.previousBalance}</span><b>{formatBRL(previous)}</b></div>
            <div><span>{s.currentBalance}</span><b>{formatBRL(balance)}</b></div>
          </div>
        </div>
        <div className="sum-side">
          <div className="sum-side-head">
            <span className="k">{s.money(isMonth)}</span>
            <small className="sum-sum">{s.moneySum(formatBRL(previous), formatBRL(incomeAll))}<b>{formatBRL(previous + incomeAll)}</b></small>
            <b className="sum-sum-short">{formatBRL(previous + incomeAll)}</b>
          </div>
          <div className="sum-bar" role="img" aria-label={s.barAria(formatBRL(expensePaid), formatBRL(toPay), short ? formatBRL(short) : null, formatBRL(left))}>
            {whole === 0 ? <i style={{ flex: 1 }} /> : (
              <>
                {expensePaid > 0 && <i className="paid" style={{ flex: expensePaid }} />}
                {toPay > 0 && <i className="topay" style={{ flex: toPay }} />}
                {kept > 0 && <i className="kept" style={{ flex: kept }} />}
                {left > 0 && <i className="left" style={{ flex: left }} />}
              </>
            )}
          </div>
          <div className="sum-legend">
            <span><b className="sw paid" /><span className="lbl">{s.alreadyPaid}</span> <b className="v">{formatCents(expensePaid)}</b><span className="lbl-after">{s.paidAfter}</span></span>
            <span><b className="sw topay" /><span className="lbl">{s.toPay}</span> <b className="v">{formatCents(toPay)}</b><span className="lbl-after">{s.toPay}</span></span>
            {kept > 0 && <span><b className="sw kept" /><span className="lbl">{s.kept}</span> <b className="v">{formatCents(kept)}</b><span className="lbl-after">{s.kept}</span></span>}
            {short > 0
              ? <span className="sum-neg"><TriangleAlert size={14} strokeWidth={2.5} aria-hidden="true" /><b className="v">{formatCents(short)}</b>{s.negative}</span>
              : <span><b className="sw left" /><span className="lbl">{s.left}</span> <b className="v">{formatCents(left)}</b><span className="lbl-after">{s.left}</span></span>}
          </div>
        </div>
      </div>
    </section>
  )
}
