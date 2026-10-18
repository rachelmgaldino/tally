import { t } from './i18n'

const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date in the browser's local time zone, as YYYY-MM-DD. */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The date `n` days after `iso` (both YYYY-MM-DD). */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const x = new Date(y, m - 1, d + n)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

export interface Month {
  year: number
  /** 1–12 */
  month: number
}

export function currentMonth(): Month {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export function addMonths(m: Month, delta: number): Month {
  const index = m.year * 12 + (m.month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

export function monthStart(m: Month): string {
  return `${m.year}-${pad(m.month)}-01`
}

/** First day of the following month, so a month is [monthStart, monthEnd). */
export function monthEnd(m: Month): string {
  return monthStart(addMonths(m, 1))
}

/** "Outubro 2026" / "October 2026" */
export function monthLabel(m: Month): string {
  return `${t().common.months[m.month - 1]} ${m.year}`
}

/** "outubro 2026" / "October 2026": the month switchers. */
export function monthTitle(m: Month): string {
  return t().common.monthYear(t().common.monthsInline[m.month - 1], m.year)
}

/** "outubro" / "October", for the middle of a sentence. Takes a Month or a YYYY-MM-DD date. */
export function monthName(m: Month | string): string {
  const month = typeof m === 'string' ? Number(m.slice(5, 7)) : m.month
  return t().common.monthsInline[month - 1]
}

/** "sábado" / "Saturday" */
export function weekdayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return t().common.weekdays[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** "sábado, 18 de outubro" / "Saturday, October 18" */
export function weekdayDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return t().common.weekdayDate(weekdayName(iso), d, t().common.monthsInline[m - 1])
}

/** "2026-10-18" → "18/10" (Portuguese) or "10/18" (English) */
export function dayMonth(iso: string): string {
  const [, mo, d] = iso.split('-')
  return t().common.dayMonthOrder === 'md' ? `${mo}/${d}` : `${d}/${mo}`
}

/** "2026-10-01" → "01/10/26" (Portuguese) or "10/01/26" (English) */
export function shortDate(iso: string): string {
  return `${dayMonth(iso)}/${iso.slice(2, 4)}`
}

/** "2026-10-01" → "1 de outubro de 2026" / "October 1, 2026" */
export function longDate(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number)
  return t().common.longDate(d, t().common.monthsInline[mo - 1], y)
}
