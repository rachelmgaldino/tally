import type { Account, Transaction } from './types'

/**
 * How a transaction changes one account's balance, in centavos.
 * Transfers take money out of account_id and put it into to_account_id.
 * Card purchases have no account, so they change no account balance; the
 * invoice payment ("payment") is what takes the money out.
 */
export function effectOn(tx: Transaction, accountId: string): number {
  if (tx.kind === 'income') return tx.account_id === accountId ? tx.amount_cents : 0
  if (tx.kind === 'expense' || tx.kind === 'payment') return tx.account_id === accountId ? -tx.amount_cents : 0
  let delta = 0
  if (tx.account_id === accountId) delta -= tx.amount_cents
  if (tx.to_account_id === accountId) delta += tx.amount_cents
  return delta
}

/** Net effect on a set of accounts. A transfer between two of them nets to zero. */
export function effectOnSet(tx: Transaction, accountIds: Set<string>): number {
  let delta = 0
  for (const id of accountIds) delta += effectOn(tx, id)
  return delta
}

export interface AccountBalance {
  /** Paid transactions only. */
  current: number
  /** Paid and pending. */
  forecast: number
}

export function accountBalance(account: Account, txs: Transaction[], until?: string): AccountBalance {
  let current = account.initial_balance_cents
  let forecast = account.initial_balance_cents
  for (const tx of txs) {
    if (until && tx.date >= until) continue
    const d = effectOn(tx, account.id)
    if (d === 0) continue
    forecast += d
    if (tx.paid) current += d
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
}

/**
 * The footer of the Lançamentos screen for one period [from, to).
 * Transfers between the selected accounts cancel out; a transfer into or out of
 * the selection counts as income or expense for it.
 */
export function periodSummary(
  accounts: Account[],
  txs: Transaction[],
  from: string,
  to: string,
): PeriodSummary {
  const ids = new Set(accounts.map((a) => a.id))
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
    balance: previous + incomePaid - expensePaid,
    forecast: previous + incomeAll - expenseAll,
  }
}
