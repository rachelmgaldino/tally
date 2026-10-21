import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { seriesTable, transactionsTable } from './api'
import { removeAttachments, uploadAttachment } from './attachments'
import { invoiceFor, monthsBetween, shiftInvoice } from './cards'
import { useCards, useSeries, useTransactions } from './queries'
import { defaultHorizon, occurrenceDate, seriesChanges, seriesRows, shiftDate, splitInstallments } from './series'
import type { Card, NewTransaction, Period, Series, SeriesKind, Transaction } from './types'

// Saving, repeating and deleting lançamentos. These touch several rows (and
// files) at once, so they live here rather than in the plain table mutations.

export interface RepeatOptions {
  kind: SeriesKind
  period: Period
  /** Only for instalments. */
  installments: number
}

function toNew(tx: Transaction): NewTransaction {
  const { id: _id, created_at: _created, ...rest } = tx
  return rest
}

/** Runs async jobs a few at a time, so hundreds of updates don't all fire at once. */
async function inBatches<T>(items: T[], job: (item: T) => Promise<unknown>, size = 8) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(job))
}

/** How many months the user moved this entry away from the invoice its date falls into ("Fatura de …"). */
function invoiceOffset(entry: Pick<NewTransaction, 'card_id' | 'date' | 'invoice_month'>, card: Card | undefined): number {
  return card && entry.invoice_month ? monthsBetween(invoiceFor(card, entry.date), entry.invoice_month) : 0
}

/**
 * Card entries of a series each go to the invoice of their own date, keeping the first entry's offset.
 * Instalments share the purchase date, so the k-th one goes k-1 invoices after the first.
 */
function alignInvoices(template: NewTransaction, rows: NewTransaction[], cards: Card[], installments = false): NewTransaction[] {
  const card = cards.find((c) => c.id === template.card_id)
  if (!card) return rows
  const offset = invoiceOffset(template, card)
  return rows.map((r) => ({ ...r, invoice_month: shiftInvoice(invoiceFor(card, r.date), offset + (installments ? (r.series_index ?? 1) - 1 : 0)) }))
}

async function attach(tx: Transaction, files: File[]): Promise<Transaction> {
  if (files.length === 0) return tx
  const added = []
  for (const f of files) added.push(await uploadAttachment(tx.id, f))
  return transactionsTable.update(tx.id, { attachments: [...tx.attachments, ...added] })
}

async function newSeries(row: NewTransaction, repeat: RepeatOptions): Promise<Series> {
  const [series] = await seriesTable.insert([{
    kind: repeat.kind,
    period: repeat.period,
    start_date: row.date,
    installments: repeat.kind === 'installment' ? repeat.installments : null,
    generated_count: 0,
    ended: false,
  }])
  return series
}

/** Fixed series always get at least their first entry, even if it starts beyond the horizon. */
const horizonFor = (date: string) => {
  const h = defaultHorizon()
  return date < h ? h : shiftDate(date, 1)
}

export async function createEntry(row: NewTransaction, repeat: RepeatOptions | null, files: File[], cards: Card[] = []) {
  if (!repeat) {
    const [tx] = await transactionsTable.insert([row])
    return attach(tx, files)
  }
  const series = await newSeries(row, repeat)
  const rows = alignInvoices(row, seriesRows(row, series, 0, horizonFor(row.date), row.paid), cards, repeat.kind === 'installment')
  const created = await transactionsTable.insert(rows)
  await seriesTable.update(series.id, { generated_count: rows.length })
  return attach(created.find((t) => t.series_index === 1) ?? created[0], files)
}

/** "Repetir" on an existing single entry: it becomes the first of a new series. */
export async function convertEntry(existing: Transaction, row: NewTransaction, repeat: RepeatOptions, files: File[], cards: Card[] = []) {
  const series = await newSeries(row, repeat)
  const firstAmount = repeat.kind === 'installment' ? splitInstallments(row.amount_cents, repeat.installments)[0] : row.amount_cents
  const first = await transactionsTable.update(existing.id, { ...row, amount_cents: firstAmount, series_id: series.id, series_index: 1 })
  const rest = alignInvoices(row, seriesRows(row, series, 1, horizonFor(row.date), row.paid), cards, repeat.kind === 'installment')
  if (rest.length) await transactionsTable.insert(rest)
  await seriesTable.update(series.id, { generated_count: rest.length + 1 })
  return attach(first, files)
}

export async function updateEntry(existing: Transaction, row: NewTransaction, files: File[]) {
  const removed = existing.attachments.filter((a) => !row.attachments.some((b) => b.path === a.path))
  const tx = await transactionsTable.update(existing.id, row)
  await removeAttachments(removed)
  return attach(tx, files)
}

const laterInSeries = (tx: Transaction, all: Transaction[]) =>
  all.filter((t) => t.series_id === tx.series_id && (t.series_index ?? 0) > (tx.series_index ?? 0))

/** "Sim, atualizar próximos": copy what changed in this entry to the ones after it. */
export async function applyToNext(before: Transaction, after: Transaction, all: Transaction[], series?: Series, cards: Card[] = []) {
  const { patch, dayShift } = seriesChanges(before, after)
  const next = laterInSeries(after, all)
  const card = cards.find((c) => c.id === after.card_id)
  const invoiceMoved = !!card && before.card_id === after.card_id && !!before.invoice_month && before.invoice_month !== after.invoice_month
  if (series?.kind === 'installment' && card && before.card_id === after.card_id && (dayShift || invoiceMoved)) {
    // Card instalments keep one purchase date and sit an invoice apart: move them all together.
    const moved = invoiceMoved ? monthsBetween(before.invoice_month!, after.invoice_month!) : 0
    await inBatches(next, (t) => transactionsTable.update(t.id, {
      ...patch,
      date: shiftDate(t.date, dayShift),
      invoice_month: t.invoice_month ? shiftInvoice(t.invoice_month, moved) : t.invoice_month,
    }))
    if (dayShift) await seriesTable.update(series.id, { start_date: shiftDate(series.start_date, dayShift) })
  } else if (dayShift || 'card_id' in patch || 'account_id' in patch) {
    // Dates or the card changed, so each entry's invoice is worked out again.
    const offset = invoiceOffset(after, card)
    await inBatches(next, (t) => {
      const date = shiftDate(t.date, dayShift)
      return transactionsTable.update(t.id, { ...patch, date, invoice_month: card ? shiftInvoice(invoiceFor(card, date), offset) : null })
    })
    if (series && dayShift) await seriesTable.update(series.id, { start_date: shiftDate(series.start_date, dayShift) })
  } else if (Object.keys(patch).length) {
    await transactionsTable.updateMany(next.map((t) => t.id), patch)
  }
}

export async function deleteEntries(list: Transaction[]) {
  await transactionsTable.removeMany(list.map((t) => t.id))
  // Files go after the rows, so a failed delete never leaves rows pointing at missing files.
  await removeAttachments(list.flatMap((t) => t.attachments)).catch(() => {})
}

/** "Este e os próximos": delete this entry and the later ones; a fixed series stops repeating. */
export async function deleteFromHere(tx: Transaction, all: Transaction[], series?: Series) {
  if (series?.kind === 'fixed') await seriesTable.update(series.id, { ended: true })
  await deleteEntries([tx, ...laterInSeries(tx, all)])
}

/**
 * Fixed entries are created about a year ahead. This creates the missing ones
 * up to `until`, copying the latest entry of each series. Returns whether
 * anything was added.
 */
export async function topUpFixed(until: string, series: Series[], all: Transaction[], cards: Card[] = []): Promise<boolean> {
  let changed = false
  for (const s of series) {
    if (s.kind !== 'fixed' || s.ended) continue
    if (occurrenceDate(s.start_date, s.period, s.generated_count) >= until) continue
    const entries = all.filter((t) => t.series_id === s.id)
    const latest = entries.reduce<Transaction | undefined>((a, b) => (!a || (b.series_index ?? 0) > (a.series_index ?? 0) ? b : a), undefined)
    if (!latest) {
      // Every entry was deleted one by one; nothing left to copy.
      await seriesTable.update(s.id, { ended: true })
      continue
    }
    const template = { ...toNew(latest), attachments: [] }
    const rows = alignInvoices(template, seriesRows(template, s, s.generated_count, until, false), cards)
    if (rows.length === 0) continue
    // Claim the range first, so two open tabs never create the same entries twice.
    const claimed = await seriesTable.updateIf(s.id, { generated_count: s.generated_count }, { generated_count: s.generated_count + rows.length })
    if (!claimed) continue
    await transactionsTable.insert(rows)
    changed = true
  }
  return changed
}

let topping: Promise<unknown> | null = null

/** Keeps fixed entries created through `until` (default: a year ahead). */
export function useSeriesUpkeep(until?: string) {
  const qc = useQueryClient()
  const { data: series } = useSeries()
  const { data: txs } = useTransactions()
  const { data: cards } = useCards()
  useEffect(() => {
    if (!series || !txs || !cards || topping) return
    const target = until && until > defaultHorizon() ? until : defaultHorizon()
    topping = topUpFixed(target, series, txs, cards)
      .then(async (changed) => {
        if (changed) await Promise.all([qc.invalidateQueries({ queryKey: ['transactions'] }), qc.invalidateQueries({ queryKey: ['series'] })])
      })
      .catch((e) => console.error('Não foi possível criar os lançamentos fixos', e))
      .finally(() => { topping = null })
  }, [series, txs, cards, until, qc])
}

/** Wraps an entry operation so every list refreshes afterwards. */
export function useRefresh() {
  const qc = useQueryClient()
  return async <T,>(job: Promise<T>): Promise<T> => {
    try {
      return await job
    } finally {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['series'] }),
      ])
    }
  }
}
