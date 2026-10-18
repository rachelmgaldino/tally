import { describe, expect, it } from 'vitest'
import { accountBalance, periodSummary } from './balances'
import { addMonths, monthEnd, monthLabel, shortDate } from './dates'
import { centsFromTyping, formatCents, formatSigned } from './money'
import type { Account, Transaction } from './types'

describe('money', () => {
  it('formats pt-BR', () => {
    expect(formatCents(123456)).toBe('1.234,56')
    expect(formatCents(-4450)).toBe('-44,50')
    expect(formatSigned(180000)).toBe('+1.800,00')
  })
  it('reads typing from the right like a bank app', () => {
    expect(centsFromTyping('0,001')).toBe(1)
    expect(centsFromTyping('1.234,567')).toBe(1234567)
    expect(centsFromTyping('')).toBe(0)
  })
})

describe('dates', () => {
  it('moves across years', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(monthEnd({ year: 2026, month: 12 })).toBe('2027-01-01')
    expect(monthLabel({ year: 2026, month: 10 })).toBe('Outubro 2026')
    expect(shortDate('2026-10-01')).toBe('01/10/26')
  })
})

const acc = (id: string, initial = 0): Account => ({
  id, name: id, icon: 'icon:bank', color: '#000', initial_balance_cents: initial,
  exclude_from_total: false, archived: false, created_at: '',
})
let n = 0
const tx = (o: Partial<Transaction>): Transaction => ({
  id: String(n++), kind: 'expense', description: '', amount_cents: 0, date: '2026-10-01', paid: true,
  account_id: 'nu', to_account_id: null, category_id: null, notes: null, created_at: '', ...o,
})

// Mirrors Rachel's Organizze screenshots for October 2026.
const accounts = [acc('nu'), acc('inter'), acc('poupanca', 60000)]
const txs = [
  tx({ kind: 'income', amount_cents: 180000, date: '2026-10-01' }),
  tx({ kind: 'expense', amount_cents: 12400, date: '2026-10-02' }),
  tx({ kind: 'expense', amount_cents: 4450, date: '2026-10-17' }),
  tx({ kind: 'income', amount_cents: 20000, date: '2026-10-18' }),
  tx({ kind: 'transfer', amount_cents: 20000, date: '2026-10-18', account_id: 'inter', to_account_id: 'nu' }),
  tx({ kind: 'income', amount_cents: 180000, date: '2026-11-01', paid: false }),
]

describe('balances', () => {
  it('matches the Organizze October footer for all accounts', () => {
    const s = periodSummary(accounts, txs, '2026-10-01', '2026-11-01')
    expect(s.previous).toBe(60000)
    expect(s.incomePaid).toBe(200000)
    expect(s.expensePaid).toBe(16850)
    expect(s.balance).toBe(243150)
    expect(s.forecast).toBe(243150)
  })
  it('counts a transfer into the filtered account', () => {
    const s = periodSummary([accounts[0]], txs, '2026-10-01', '2026-11-01')
    expect(s.balance).toBe(180000 - 12400 - 4450 + 20000 + 20000)
  })
  it('separates paid from forecast', () => {
    const s = periodSummary([accounts[0]], txs, '2026-11-01', '2026-12-01')
    expect(s.previous).toBe(203150)
    expect(s.incomePaid).toBe(0)
    expect(s.incomeAll).toBe(180000)
    expect(s.forecast).toBe(383150)
  })
  it('computes account balances', () => {
    expect(accountBalance(accounts[1], txs)).toEqual({ current: -20000, forecast: -20000 })
    expect(accountBalance(accounts[0], txs).forecast).toBe(383150)
  })
})
