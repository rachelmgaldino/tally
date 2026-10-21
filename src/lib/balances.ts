import { today } from './dates'
import type { Account, Transaction } from './types'

/**
 * How a transaction changes one account's balance, in centavos.
 * Transfers take money out of account_id and put it into to_account_id
 * (to_amount_cents of it when the two accounts are in different currencies).
 * Card purchases have no account, so they change no account balance; the
 * invoice payment ("payment") is what takes the money out.
 */
export function effectOn(tx: Transaction, accountId: string): number {
  if (tx.kind === 'income') return tx.account_id === accountId ? tx.amount_cents : 0
  if (tx.kind === 'expense' || tx.kind === 'payment') return tx.account_id === accountId ? -tx.amount_cents : 0
  let delta = 0
  if (tx.account_id === accountId) delta -= tx.amount_cents
  if (tx.to_account_id === accountId) delta += tx.to_amount_cents ?? tx.amount_cents
  return delta
}

/** Net effect on a set of accounts. A transfer between two of them nets to zero. */
export function effectOnSet(tx: Transaction, accountIds: Set<string>): number {
  let delta = 0
  for (const id of accountIds) delta += effectOn(tx, id)
  return delta
}

export interface AccountBalance {
  /** Paid transactions dated up to today. */
  current: number
  /** Paid and pending. */
  forecast: number
}

/**
 * Something marked done can still be dated later (older fixed transfers were
 * saved as done a year ahead), so the current balance also leaves out anything
 * dated after `on`. A pending transfer only counts in the forecast.
 */
export function accountBalance(account: Account, txs: Transaction[], until?: string, on = today()): AccountBalance {
  let current = account.initial_balance_cents
  let forecast = account.initial_balance_cents
  for (const tx of txs) {
    if (until && tx.date >= until) continue
    const d = effectOn(tx, account.id)
    if (d === 0) continue
    forecast += d
    if (tx.paid && tx.date <= on) current += d
  }
  return { current, forecast }
}

export interface PeriodSummary {
  /** Where the period starts: the previous period's Previsto, so unpaid bills already count. */
  previous: number
  incomePaid: number
  incomeAll: number
  expensePaid: number
  expenseAll: number
  balance: number
  forecast: number
  /** Net moved into the kept accounts (left out of the Saldo geral) this period. */
  saved: number
  /** Net sent to accounts in other currencies (`abroadIds`) this period, in the selection's currency. */
  sent: number
}

/**
 * The same summary with the Saldo anterior left out, for when the forecast
 * should only count the period's own money. Saldo atual drops it too, so it
 * reads as "this period so far".
 */
export function withoutPrevious(summary: PeriodSummary): PeriodSummary {
  return { ...summary, previous: 0, balance: summary.balance - summary.previous, forecast: summary.forecast - summary.previous }
}

/**
 * The footer of the Lançamentos screen for one period [from, to).
 * Transfers between the selected accounts cancel out; a transfer into or out of
 * the selection counts as income or expense for it, except one into or out of
 * a kept account (`keptIds`), which goes to `saved`, or one to or from an account
 * in another currency (`abroadIds`), which goes to `sent`.
 */
export function periodSummary(
  accounts: Account[],
  txs: Transaction[],
  from: string,
  to: string,
  keptIds: Set<string> = new Set(),
  abroadIds: Set<string> = new Set(),
): PeriodSummary {
  const ids = new Set(accounts.map((a) => a.id))
  let saved = 0, savedPaid = 0
  let sent = 0, sentPaid = 0
  let previous = 0
  for (const a of accounts) previous += a.initial_balance_cents
  let incomePaid = 0, incomeAll = 0, expensePaid = 0, expenseAll = 0
  for (const tx of txs) {
    if (tx.date >= to) continue
    const d = effectOnSet(tx, ids)
    if (d === 0) continue
    if (tx.date < from) {
      previous += d
      continue
    }
    // Money moved into or out of a kept account is "guardado", not spending.
    if (tx.kind === 'transfer' && (keptIds.has(tx.to_account_id ?? '') || keptIds.has(tx.account_id ?? ''))) {
      saved -= d
      if (tx.paid) savedPaid -= d
      continue
    }
    // Money changed into another currency left this one without being spent.
    if (tx.kind === 'transfer' && (abroadIds.has(tx.to_account_id ?? '') || abroadIds.has(tx.account_id ?? ''))) {
      sent -= d
      if (tx.paid) sentPaid -= d
      continue
    }
    if (d > 0) {
      incomeAll += d
      if (tx.paid) incomePaid += d
    } else {
      expenseAll += -d
      if (tx.paid) expensePaid += -d
    }
  }
  return {
    previous,
    incomePaid,
    incomeAll,
    expensePaid,
    expenseAll,
    // A transfer still pending (not done yet) waits for the forecast, like an unpaid bill.
    balance: previous + incomePaid - expensePaid - savedPaid - sentPaid,
    forecast: previous + incomeAll - expenseAll - saved - sent,
    saved,
    sent,
  }
}
