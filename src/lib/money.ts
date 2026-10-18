import { locale } from './i18n'

const formats = new Map<string, Intl.NumberFormat>()

/** 123456 → "1.234,56" in Portuguese, "1,234.56" in English (still reais). */
export function formatCents(cents: number): string {
  const loc = locale()
  let f = formats.get(loc)
  if (!f) formats.set(loc, (f = new Intl.NumberFormat(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 })))
  return f.format(cents / 100)
}

/** The real minus sign, which lines up with "+" (a hyphen is shorter). */
export const MINUS = '\u2212'

/** 123456 → "R$ 1.234,56"; −23900 → "−R$ 239,00" */
export function formatBRL(cents: number): string {
  return cents < 0 ? `${MINUS}R$ ${formatCents(-cents)}` : `R$ ${formatCents(cents)}`
}

/** Signed display used in lists: +1.800,00 / −44,50 */
export function formatSigned(cents: number): string {
  if (cents > 0) return `+${formatCents(cents)}`
  if (cents < 0) return `${MINUS}${formatCents(-cents)}`
  return formatCents(cents)
}

/**
 * Reads what the user typed into a money field the way a bank app does:
 * digits fill in from the right, so typing 1 2 3 4 gives 12,34.
 */
export function centsFromTyping(text: string): number {
  const digits = text.replace(/\D/g, '').replace(/^0+/, '')
  if (!digits) return 0
  return Number(digits.slice(-13))
}
