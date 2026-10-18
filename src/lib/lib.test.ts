import { describe, expect, it } from 'vitest'
import { accountBalance, periodSummary } from './balances'
import { addDays, addMonths, monthEnd, monthLabel, shortDate } from './dates'
import { centsFromTyping, formatMoney, formatCents, formatSigned } from './money'
import type { Account, Transaction } from './types'

describe('money', () => {
  it('formats pt-BR', () => {
    expect(formatCents(123456)).toBe('1.234,56')
    expect(formatCents(-4450)).toBe('-44,50')
    expect(formatSigned(180000)).toBe('+1.800,00')
    expect(formatSigned(-4450)).toBe('\u221244,50')
    expect(formatMoney(-23900)).toBe('\u2212R$ 239,00')
  })
  it('puts the symbol of another currency in front', () => {
    expect(formatMoney(49730, 'CAD')).toBe('C$ 497,30')
    expect(formatSigned(-8420, 'CAD')).toBe('\u2212C$ 84,20')
    expect(formatSigned(-8420, 'BRL')).toBe('\u221284,20')
  })
  it('reads typing from the right like a bank app', () => {
    expect(centsFromTyping('0,001')).toBe(1)
    expect(centsFromTyping('1.234,567')).toBe(1234567)
    expect(centsFromTyping('')).toBe(0)
  })
})

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-10-28', 7)).toBe('2026-11-04')
    expect(addDays('2026-12-25', 14)).toBe('2027-01-08')
  })

  it('moves across years', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(monthEnd({ year: 2026, month: 12 })).toBe('2027-01-01')
    expect(monthLabel({ year: 2026, month: 10 })).toBe('Outubro 2026')
    expect(shortDate('2026-10-01')).toBe('01/10/26')
  })
})

const acc = (id: string, initial = 0, currency = 'BRL'): Account => ({
  id, name: id, icon: 'icon:bank', color: '#000', initial_balance_cents: initial,
  exclude_from_total: false, currency, archived: false, created_at: '',
})
let n = 0
const tx = (o: Partial<Transaction>): Transaction => ({
  id: String(n++), kind: 'expense', description: '', amount_cents: 0, date: '2026-10-01', paid: true,
  account_id: 'nu', to_account_id: null, category_id: null, notes: null, created_at: '',
  series_id: null, series_index: null, tag_ids: [], attachments: [], card_id: null, invoice_month: null, ...o,
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
    expect(s.balance).toBe(203150)
    expect(s.incomeAll).toBe(180000)
    expect(s.forecast).toBe(383150)
  })
  it('starts a month from the last one\'s Previsto, unpaid bills included', () => {
    const late = [...txs, tx({ kind: 'expense', amount_cents: 35792, date: '2026-10-05', paid: false })]
    const oct = periodSummary([accounts[0]], late, '2026-10-01', '2026-11-01')
    const nov = periodSummary([accounts[0]], late, '2026-11-01', '2026-12-01')
    expect(nov.previous).toBe(oct.forecast)
    expect(nov.balance).toBe(oct.forecast)
    expect(nov.forecast).toBe(oct.forecast + 180000)
  })
  it('computes account balances', () => {
    expect(accountBalance(accounts[1], txs, undefined, '2026-10-18')).toEqual({ current: -20000, forecast: -20000 })
    expect(accountBalance(accounts[0], txs, undefined, '2026-10-18').forecast).toBe(383150)
  })
  it('leaves transfers dated later out of the current balance', () => {
    const later = [...txs, tx({ kind: 'transfer', amount_cents: 50000, date: '2026-11-06', account_id: 'nu', to_account_id: 'inter' })]
    expect(accountBalance(accounts[1], later, undefined, '2026-10-18')).toEqual({ current: -20000, forecast: 30000 })
    expect(accountBalance(accounts[1], later, undefined, '2026-11-06').current).toBe(30000)
  })
  it('shows money moved into a kept account as saved, not spent', () => {
    const saving = [...txs,
      tx({ kind: 'transfer', amount_cents: 50000, date: '2026-10-06', account_id: 'nu', to_account_id: 'poupanca' }),
      tx({ kind: 'transfer', amount_cents: 10000, date: '2026-10-20', account_id: 'poupanca', to_account_id: 'nu' }),
    ]
    const plain = periodSummary(accounts.slice(0, 2), txs, '2026-10-01', '2026-11-01')
    const s = periodSummary(accounts.slice(0, 2), saving, '2026-10-01', '2026-11-01', new Set(['poupanca']))
    expect(s.saved).toBe(40000)
    expect(s.expenseAll).toBe(plain.expenseAll)
    expect(s.incomeAll).toBe(plain.incomeAll)
    expect(s.forecast).toBe(plain.forecast - 40000)
  })
  it('lands a transfer between currencies with the amount that arrived', () => {
    const wise = acc('wise', 10000, 'CAD')
    const sent = [tx({ kind: 'transfer', amount_cents: 200000, to_amount_cents: 49730, date: '2026-10-08', account_id: 'nu', to_account_id: 'wise' })]
    expect(accountBalance(wise, sent, undefined, '2026-10-31').current).toBe(59730)
    expect(accountBalance(acc('nu'), sent, undefined, '2026-10-31').current).toBe(-200000)
  })
  it('keeps money changed into another currency apart from spending', () => {
    const abroad = [...txs, tx({ kind: 'transfer', amount_cents: 200000, to_amount_cents: 49730, date: '2026-10-08', account_id: 'nu', to_account_id: 'wise' })]
    const plain = periodSummary(accounts.slice(0, 2), txs, '2026-10-01', '2026-11-01')
    const s = periodSummary(accounts.slice(0, 2), abroad, '2026-10-01', '2026-11-01', new Set(), new Set(['wise']))
    expect(s.sent).toBe(200000)
    expect(s.expenseAll).toBe(plain.expenseAll)
    expect(s.forecast).toBe(plain.forecast - 200000)
  })
})
