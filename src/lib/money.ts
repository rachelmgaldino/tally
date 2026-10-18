const brl = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** 123456 → "1.234,56" */
export function formatCents(cents: number): string {
  return brl.format(cents / 100)
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
