import { addMonths, monthEnd, monthStart, monthTitle, weekdayDate } from './dates'
import { t } from './i18n'
import { shiftDate } from './series'

// The span of time Lançamentos shows: one day, one week (Sunday to Saturday)
// or one month, set in Preferências as "Período padrão".

export type PeriodKind = 'day' | 'week' | 'month'

export interface Span {
  kind: PeriodKind
  /** First day of the span, YYYY-MM-DD. */
  start: string
}

const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number]
const weekday = (iso: string) => {
  const [y, m, d] = parts(iso)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** The span of the given kind that contains `date`. */
export function spanAt(kind: PeriodKind, date: string): Span {
  if (kind === 'day') return { kind, start: date }
  if (kind === 'week') return { kind, start: shiftDate(date, -weekday(date)) }
  return { kind, start: `${date.slice(0, 8)}01` }
}

/** [from, to): `to` is the first day after the span. */
export function spanRange(span: Span): { from: string; to: string } {
  const { kind, start } = span
  if (kind === 'day') return { from: start, to: shiftDate(start, 1) }
  if (kind === 'week') return { from: start, to: shiftDate(start, 7) }
  const [y, m] = parts(start)
  return { from: start, to: monthEnd({ year: y, month: m }) }
}

export function shiftSpan(span: Span, n: number): Span {
  const { kind, start } = span
  if (kind === 'day') return { kind, start: shiftDate(start, n) }
  if (kind === 'week') return { kind, start: shiftDate(start, 7 * n) }
  const [y, m] = parts(start)
  return { kind, start: monthStart(addMonths({ year: y, month: m }, n)) }
}

/** "sábado, 18 de outubro", "12 a 18 de outubro", "outubro 2026" (and the same in English) */
export function spanLabel(span: Span): string {
  const [y, m, d] = parts(span.start)
  if (span.kind === 'month') return monthTitle({ year: y, month: m })
  if (span.kind === 'day') return weekdayDate(span.start)
  const months = t().common.monthsInline
  const [, m2, d2] = parts(shiftDate(span.start, 6))
  return m2 === m ? t().common.weekSameMonth(d, d2, months[m - 1]) : t().common.weekTwoMonths(d, months[m - 1].slice(0, 3), d2, months[m2 - 1].slice(0, 3))
}
