import { addDays, today } from './dates'
import type { Transaction, TxKind } from './types'

// Past descriptions offered while typing a new entry. Matching ignores case and
// accents and looks at the start of every word, so "super" finds
// "Pinheiro Supermercado". Each suggestion carries the latest entry with that
// name, whose category and account or card the form copies.

export interface Suggestion {
  description: string
  /** Entries typed with this description in the last 90 days. */
  count: number
  last: Transaction
}

/** Letters typed before the list opens. */
export const MIN_TYPED = 2

export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()

/** Where the typed text matches in the description: [start, end), or null. */
export function matchAt(description: string, typed: string): [number, number] | null {
  const q = fold(typed)
  if (!q) return null
  const d = fold(description)
  for (let i = 0; i < d.length; i++) {
    if ((i === 0 || /[\s\-/(]/.test(d[i - 1])) && d.startsWith(q, i)) return [i, i + q.length]
  }
  return null
}

/** With nothing typed, the most used names; otherwise the names that match. */
export function suggestions(txs: Transaction[], kind: TxKind, typed: string, limit: number, now = today()): Suggestion[] {
  const from = addDays(now, -90)
  const groups = new Map<string, Suggestion>()
  for (const x of txs) {
    // Repeating entries ahead of today don't count as "last time".
    if (x.kind !== kind || x.date > now || !x.description.trim()) continue
    const k = fold(x.description)
    const g = groups.get(k)
    // Repeating entries are made by the app, not typed, so they don't count as habits.
    const recent = x.date >= from && !x.series_id ? 1 : 0
    if (!g) groups.set(k, { description: x.description.trim(), count: recent, last: x })
    else {
      g.count += recent
      if (x.date > g.last.date || (x.date === g.last.date && x.created_at > g.last.created_at)) {
        g.last = x
        g.description = x.description.trim()
      }
    }
  }
  const q = fold(typed)
  const starts = (g: Suggestion) => (q && fold(g.description).startsWith(q) ? 0 : 1)
  return [...groups.values()]
    .filter((g) => (q ? matchAt(g.description, typed) : g.count > 0))
    // Whole-name prefix first, then the most used lately, then the latest.
    .sort((a, b) => starts(a) - starts(b) || b.count - a.count || b.last.date.localeCompare(a.last.date))
    .slice(0, limit)
}
