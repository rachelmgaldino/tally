import { addMonths, currentMonth, monthEnd, today } from './dates'
import { t } from './i18n'
import type { NewTransaction, Period, Series, Transaction } from './types'

interface PeriodInfo {
  /** Option in the "Lançamento fixo" list. */
  label: string
  /** Option in the "Lançamento parcelado" list. */
  unit: string
  /** Shown in the side panel: "Receita fixa · mensal". */
  adjective: string
  months?: number
  days?: number
}

/** Labels come from the current language, so they're read when shown. */
const info = (p: Period, span: { months?: number; days?: number }): PeriodInfo => ({
  ...span,
  get label() { return t().common.periods[p].label },
  get unit() { return t().common.periods[p].unit },
  get adjective() { return t().common.periods[p].adjective },
})

export const PERIODS: Record<Period, PeriodInfo> = {
  yearly: info('yearly', { months: 12 }),
  semiannual: info('semiannual', { months: 6 }),
  quarterly: info('quarterly', { months: 3 }),
  bimonthly: info('bimonthly', { months: 2 }),
  monthly: info('monthly', { months: 1 }),
  biweekly: info('biweekly', { days: 15 }),
  weekly: info('weekly', { days: 7 }),
  daily: info('daily', { days: 1 }),
}

export const PERIOD_ORDER = Object.keys(PERIODS) as Period[]

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/**
 * Date of the k-th entry (k = 0 is the first). Month-based periods keep the
 * start day and clamp it to short months, so the 31st becomes the 30th or 28th.
 */
export function occurrenceDate(start: string, period: Period, k: number): string {
  const [y, m, d] = start.split('-').map(Number)
  const { months, days } = PERIODS[period]
  if (months) {
    const target = addMonths({ year: y, month: m }, months * k)
    const lastDay = new Date(Date.UTC(target.year, target.month, 0)).getUTCDate()
    return iso(target.year, target.month, Math.min(d, lastDay))
  }
  const t = new Date(Date.UTC(y, m - 1, d + days! * k))
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Whole days from a to b (both YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split('-').map(Number)
    return Date.UTC(y, m - 1, d)
  }
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000)
}

export function shiftDate(date: string, days: number): string {
  return occurrenceDate(date, 'daily', days)
}

/** Splits a total into n instalments; the rounding remainder goes on the first. */
export function splitInstallments(total: number, n: number): number[] {
  const base = Math.floor(total / n)
  return Array.from({ length: n }, (_, i) => (i === 0 ? total - base * (n - 1) : base))
}

/** Fixed entries are created this far ahead: through the end of the month a year from now. */
export function defaultHorizon(): string {
  return monthEnd(addMonths(currentMonth(), 12))
}

/** Entries after the first start unpaid unless their date has already passed. */
export function paidFor(date: string, firstPaid: boolean, isFirst: boolean): boolean {
  return isFirst ? firstPaid : firstPaid && date <= today()
}

/** The rows a new series needs, from entry `from` (0-based), stopping before `until` for fixed series. */
export function seriesRows(
  template: NewTransaction,
  series: Pick<Series, 'id' | 'kind' | 'period' | 'start_date' | 'installments'>,
  from: number,
  until: string,
  firstPaid: boolean,
  limit = 500,
): NewTransaction[] {
  const out: NewTransaction[] = []
  const amounts = series.installments ? splitInstallments(template.amount_cents, series.installments) : null
  const count = series.installments ?? Infinity
  // Instalments on a card all keep the purchase date; each one goes to a later invoice instead.
  const samePurchase = series.kind === 'installment' && !!template.card_id
  for (let k = from; k < count && out.length < limit; k++) {
    const date = samePurchase ? series.start_date : occurrenceDate(series.start_date, series.period, k)
    if (!series.installments && date >= until) break
    out.push({
      ...template,
      date,
      amount_cents: amounts ? amounts[k] : template.amount_cents,
      // Card purchases are settled by paying the invoice, so they never show as pending.
      paid: template.card_id ? true : paidFor(date, firstPaid, k === 0),
      series_id: series.id,
      series_index: k + 1,
      attachments: k === 0 ? template.attachments : [],
    })
  }
  return out
}

/**
 * The day a card instalment shows on in the full list. They all keep the purchase
 * date, so the k-th one is listed k-1 months after it, next to the invoice it is in.
 * Older instalments that were saved with moving dates keep their own date.
 */
export function listedDate(tx: Pick<Transaction, 'date' | 'card_id' | 'series_index'>, series?: Pick<Series, 'kind' | 'period' | 'start_date'>): string {
  if (!tx.card_id || series?.kind !== 'installment' || tx.date !== series.start_date || !tx.series_index) return tx.date
  return occurrenceDate(tx.date, series.period, tx.series_index - 1)
}

/** Fields that "Sim, atualizar próximos" copies to the following entries. */
export const SHARED_FIELDS = ['description', 'amount_cents', 'to_amount_cents', 'account_id', 'card_id', 'to_account_id', 'category_id', 'notes', 'tag_ids'] as const

/** What changed between two versions of an entry, limited to SHARED_FIELDS, plus the date shift in days. */
export function seriesChanges(before: Transaction, after: Transaction) {
  const patch: Partial<NewTransaction> = {}
  for (const k of SHARED_FIELDS) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) Object.assign(patch, { [k]: after[k] })
  }
  return { patch, dayShift: daysBetween(before.date, after.date) }
}
