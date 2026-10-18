const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const pad = (n: number) => String(n).padStart(2, '0')

/** Today's date in the browser's local time zone, as YYYY-MM-DD. */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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

export function monthLabel(m: Month): string {
  return `${MONTHS[m.month - 1]} ${m.year}`
}

/** "2026-10-01" → "01/10/26" */
export function shortDate(iso: string): string {
  const [y, mo, d] = iso.split('-')
  return `${d}/${mo}/${y.slice(2)}`
}

/** "2026-10-01" → "01 de Outubro de 2026" */
export function longDate(iso: string): string {
  const [y, mo, d] = iso.split('-')
  return `${d} de ${MONTHS[Number(mo) - 1]} de ${y}`
}
