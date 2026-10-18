import { addMonths, currentMonth, monthEnd, today } from './dates'
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

export const PERIODS: Record<Period, PeriodInfo> = {
  yearly: { label: 'Anual', unit: 'Anos', adjective: 'anual', months: 12 },
  semiannual: { label: 'Semestral', unit: 'Semestres', adjective: 'semestral', months: 6 },
  quarterly: { label: 'Trimestral', unit: 'Trimestres', adjective: 'trimestral', months: 3 },
  bimonthly: { label: 'Bimestral', unit: 'Bimestres', adjective: 'bimestral', months: 2 },
  monthly: { label: 'Mensal', unit: 'Meses', adjective: 'mensal', months: 1 },
  biweekly: { label: 'Quinzenal', unit: 'Quinzenas', adjective: 'quinzenal', days: 15 },
  weekly: { label: 'Semanal', unit: 'Semanas', adjective: 'semanal', days: 7 },
  daily: { label: 'Diário', unit: 'Dias', adjective: 'diária', days: 1 },
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
  for (let k = from; k < count && out.length < limit; k++) {
    const date = occurrenceDate(series.start_date, series.period, k)
    if (!series.installments && date >= until) break
    out.push({
      ...template,
      date,
      amount_cents: amounts ? amounts[k] : template.amount_cents,
      paid: template.kind === 'transfer' ? true : paidFor(date, firstPaid, k === 0),
      series_id: series.id,
      series_index: k + 1,
      attachments: k === 0 ? template.attachments : [],
    })
  }
  return out
}

/** Fields that "Sim, atualizar próximos" copies to the following entries. */
export const SHARED_FIELDS = ['description', 'amount_cents', 'account_id', 'to_account_id', 'category_id', 'notes', 'tag_ids'] as const

/** What changed between two versions of an entry, limited to SHARED_FIELDS, plus the date shift in days. */
export function seriesChanges(before: Transaction, after: Transaction) {
  const patch: Partial<NewTransaction> = {}
  for (const k of SHARED_FIELDS) {
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) Object.assign(patch, { [k]: after[k] })
  }
  return { patch, dayShift: daysBetween(before.date, after.date) }
}
