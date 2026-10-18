import { language, locale } from './i18n'

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

// Each account and card keeps its money in one currency. The "Moeda principal"
// (Preferências, reais unless changed) is what the Saldo geral and the month's
// totals are in; accounts in other currencies are shown apart, never mixed in.
export const CURRENCIES = ['BRL', 'USD', 'CAD', 'EUR', 'GBP'] as const
export type Currency = (typeof CURRENCIES)[number]

const INFO: Record<Currency, { symbol: string; pt: string; en: string }> = {
  BRL: { symbol: 'R$', pt: 'Real', en: 'Brazilian real' },
  USD: { symbol: 'US$', pt: 'Dólar americano', en: 'US dollar' },
  CAD: { symbol: 'C$', pt: 'Dólar canadense', en: 'Canadian dollar' },
  EUR: { symbol: '€', pt: 'Euro', en: 'Euro' },
  GBP: { symbol: '£', pt: 'Libra', en: 'British pound' },
}

export const isCurrency = (v: unknown): v is Currency => typeof v === 'string' && v in INFO

let home: Currency = 'BRL'

/** Set by PrefsProvider before anything renders, like the language. */
export function setHomeCurrency(c: Currency): void {
  home = c
}

export function homeCurrency(): Currency {
  return home
}

/** "C$" */
export const symbol = (c: Currency = home) => INFO[c].symbol

/** "Dólar canadense" / "Canadian dollar" */
export const currencyName = (c: Currency) => INFO[c][language() === 'en' ? 'en' : 'pt']

/** An account's or card's currency; rows saved before currencies existed are in reais. */
export const currencyOf = (x?: { currency?: string | null } | null): Currency => (isCurrency(x?.currency) ? x.currency : 'BRL')

/** Not in the Moeda principal: kept out of the Saldo geral and the month's totals. */
export const isForeign = (x?: { currency?: string | null } | null) => currencyOf(x) !== home

/** 123456 → "R$ 1.234,56"; −23900 → "−R$ 239,00". In the Moeda principal unless another currency is given. */
export function formatMoney(cents: number, currency: Currency = home): string {
  const sym = INFO[currency].symbol
  return cents < 0 ? `${MINUS}${sym} ${formatCents(-cents)}` : `${sym} ${formatCents(cents)}`
}

/** Signed display used in lists: +1.800,00 / −44,50; with another currency, +C$ 44,50. */
export function formatSigned(cents: number, currency?: Currency): string {
  const body = (c: number) => (currency && currency !== home ? `${INFO[currency].symbol} ${formatCents(c)}` : formatCents(c))
  if (cents > 0) return `+${body(cents)}`
  if (cents < 0) return `${MINUS}${body(-cents)}`
  return body(cents)
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
