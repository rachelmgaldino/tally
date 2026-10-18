import { addMonths, monthLabel, today, type Month } from './dates'
import { t } from './i18n'
import type { Card, Transaction } from './types'

// Credit card invoices (faturas). An invoice is named after the month it is
// due: with "fecha dia 29, vence dia 5", a purchase on 22/09 closes on 29/09
// and is due on 05/10, so it belongs to "Fatura Outubro".

const pad = (n: number) => String(n).padStart(2, '0')

function lastDay(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

const dayIn = (m: Month, day: number) => `${m.year}-${pad(m.month)}-${pad(Math.min(day, lastDay(m.year, m.month)))}`

export const toMonth = (iso: string): Month => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) })
export const monthKey = (m: Month) => `${m.year}-${pad(m.month)}-01`

/** Moves an invoice month (YYYY-MM-01) by n months. */
export function shiftInvoice(invoice: string, n: number): string {
  return monthKey(addMonths(toMonth(invoice), n))
}

/** Whole months from invoice a to invoice b. */
export function monthsBetween(a: string, b: string): number {
  const x = toMonth(a), y = toMonth(b)
  return (y.year - x.year) * 12 + (y.month - x.month)
}

/** The invoice closes in its due month when the due day comes after the closing day, otherwise the month before. */
const closesMonthsBefore = (card: Pick<Card, 'closing_day' | 'due_day'>) => (card.due_day > card.closing_day ? 0 : 1)

/** The invoice a purchase on `date` falls into. A purchase on the closing day goes to the next invoice. */
export function invoiceFor(card: Pick<Card, 'closing_day' | 'due_day'>, date: string): string {
  const m = toMonth(date)
  const closesThisMonth = date < dayIn(m, card.closing_day)
  const closingMonth = closesThisMonth ? m : addMonths(m, 1)
  return monthKey(addMonths(closingMonth, closesMonthsBefore(card)))
}

export function closingDate(card: Pick<Card, 'closing_day' | 'due_day'>, invoice: string): string {
  return dayIn(addMonths(toMonth(invoice), -closesMonthsBefore(card)), card.closing_day)
}

export function dueDate(card: Pick<Card, 'due_day'>, invoice: string): string {
  return dayIn(toMonth(invoice), card.due_day)
}

/** "Fatura Outubro 2026" / "October 2026 bill" */
export function invoiceName(invoice: string): string {
  return t().common.invoiceName(monthLabel(toMonth(invoice)))
}

/** Purchases add to an invoice; a refund (receita on the card) takes away. */
export function cardEffect(tx: Transaction): number {
  if (tx.kind === 'expense') return tx.amount_cents
  if (tx.kind === 'income') return -tx.amount_cents
  return 0
}

export type InvoiceStatus = 'paid' | 'late' | 'current' | 'closed' | 'future'

/** "Fatura paga" / "Bill paid" */
export const statusLabel = (status: InvoiceStatus) => t().common.invoiceStatus[status]
/** "Paga" / "Paid" */
export const statusShort = (status: InvoiceStatus) => t().common.invoiceStatusShort[status]

export interface Invoice {
  card: Card
  month: string
  purchases: Transaction[]
  payments: Transaction[]
  total: number
  paid: number
  remaining: number
  closing: string
  due: string
  status: InvoiceStatus
}

export function invoiceOf(card: Card, txs: Transaction[], month: string, on = today()): Invoice {
  const purchases: Transaction[] = []
  const payments: Transaction[] = []
  for (const tx of txs) {
    if (tx.card_id !== card.id || tx.invoice_month !== month || tx.virtual) continue
    if (tx.kind === 'payment') payments.push(tx)
    else purchases.push(tx)
  }
  const total = purchases.reduce((s, tx) => s + cardEffect(tx), 0)
  const paid = payments.reduce((s, tx) => s + tx.amount_cents, 0)
  const remaining = Math.max(0, total - paid)
  const closing = closingDate(card, month)
  const due = dueDate(card, month)
  let status: InvoiceStatus
  if (total > 0 && remaining === 0) status = 'paid'
  else if (on > due && remaining > 0) status = 'late'
  else if (month === invoiceFor(card, on)) status = 'current'
  else if (on >= closing) status = 'closed'
  else status = 'future'
  return { card, month, purchases, payments, total, paid, remaining, closing, due, status }
}

/** Every invoice month a card has entries in. */
export function invoiceMonths(card: Card, txs: Transaction[]): string[] {
  const set = new Set<string>()
  for (const tx of txs) if (tx.card_id === card.id && tx.invoice_month && !tx.virtual) set.add(tx.invoice_month)
  return [...set].sort()
}

/**
 * The unpaid part of each invoice as a pending expense in the card's payment
 * account, on the due date. That's how an open invoice shows in Lançamentos
 * ("Fatura Novembro 2026") and counts in the account's forecast.
 */
export function invoiceRows(cards: Card[], txs: Transaction[]): Transaction[] {
  const out: Transaction[] = []
  for (const card of cards) {
    if (!card.payment_account_id) continue
    for (const month of invoiceMonths(card, txs)) {
      const inv = invoiceOf(card, txs, month)
      if (inv.remaining <= 0) continue
      out.push({
        id: `fatura:${card.id}:${month}`,
        kind: 'expense',
        description: invoiceName(month),
        amount_cents: inv.remaining,
        date: inv.due,
        paid: false,
        account_id: card.payment_account_id,
        to_account_id: null,
        card_id: card.id,
        invoice_month: month,
        category_id: null,
        notes: null,
        series_id: null,
        series_index: null,
        tag_ids: [],
        attachments: [],
        created_at: '',
        virtual: true,
      })
    }
  }
  return out
}

/** Account-side view of the money: card purchases are replaced by their invoices. */
export function cashFlow(cards: Card[], txs: Transaction[]): Transaction[] {
  return [...txs.filter((tx) => !isCardPurchase(tx)), ...invoiceRows(cards, txs)]
}

export const isCardPurchase = (tx: Transaction) => !!tx.card_id && (tx.kind === 'expense' || tx.kind === 'income') && !tx.virtual

/** Limit minus everything bought on the card and not yet paid. */
export function availableLimit(card: Card, txs: Transaction[]): number {
  let used = 0
  for (const tx of txs) {
    if (tx.card_id !== card.id || tx.virtual) continue
    if (tx.kind === 'payment') used -= tx.amount_cents
    else used += cardEffect(tx)
  }
  return card.limit_cents - used
}
