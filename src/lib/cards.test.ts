import { describe, expect, it } from 'vitest'
import { availableLimit, cashFlow, closingDate, dueDate, invoiceFor, invoiceOf } from './cards'
import type { Card, Transaction } from './types'

const card: Card = {
  id: 'c1', name: 'Inter', icon: 'bank:inter', color: '#ff7a00', limit_cents: 100000,
  closing_day: 29, due_day: 5, payment_account_id: 'a1', currency: 'BRL', archived: false, created_at: '',
}

const tx = (o: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(), kind: 'expense', description: '', amount_cents: 0, date: '2026-10-10', paid: true,
  account_id: null, to_account_id: null, card_id: 'c1', invoice_month: '2026-11-01', category_id: null, notes: null,
  series_id: null, series_index: null, tag_ids: [], attachments: [], created_at: '', ...o,
})

describe('invoices', () => {
  it('names the invoice after its due month', () => {
    expect(invoiceFor(card, '2026-09-22')).toBe('2026-10-01')
    expect(invoiceFor(card, '2026-09-29')).toBe('2026-11-01') // closing day goes to the next one
    expect(closingDate(card, '2026-10-01')).toBe('2026-09-29')
    expect(dueDate(card, '2026-10-01')).toBe('2026-10-05')
  })

  it('keeps the same month when the due day comes after the closing day', () => {
    const c = { closing_day: 3, due_day: 10 }
    expect(invoiceFor(c, '2026-10-02')).toBe('2026-10-01')
    expect(invoiceFor(c, '2026-10-03')).toBe('2026-11-01')
  })

  it('clamps the closing day to short months', () => {
    expect(closingDate({ closing_day: 31, due_day: 8 }, '2026-03-01')).toBe('2026-02-28')
  })

  it('totals purchases, refunds and payments', () => {
    const txs = [
      tx({ amount_cents: 10000 }),
      tx({ kind: 'income', amount_cents: 2000 }),
      tx({ kind: 'payment', amount_cents: 3000, account_id: 'a1' }),
    ]
    const inv = invoiceOf(card, txs, '2026-11-01', '2026-10-18')
    expect([inv.total, inv.paid, inv.remaining, inv.status]).toEqual([8000, 3000, 5000, 'current'])
    expect(invoiceOf(card, txs, '2026-11-01', '2026-11-06').status).toBe('late')
    expect(availableLimit(card, txs)).toBe(100000 - 8000 + 3000)
  })

  it('swaps card purchases for the open invoice in the cash flow', () => {
    const flow = cashFlow([card], [tx({ amount_cents: 10000 }), tx({ kind: 'payment', amount_cents: 4000, account_id: 'a1' })])
    const invoice = flow.find((t) => t.virtual)!
    expect(flow.some((t) => t.kind === 'expense' && !t.virtual)).toBe(false)
    expect([invoice.amount_cents, invoice.date, invoice.account_id]).toEqual([6000, '2026-11-05', 'a1'])
  })
})
