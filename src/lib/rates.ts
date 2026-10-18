import { useQuery } from '@tanstack/react-query'
import type { Currency } from './money'

// Today's exchange rates, only for the optional "≈ total" on the Saldo geral
// card. Frankfurter serves the European Central Bank's reference rates: free,
// no key, updated once per working day. Nothing Tally stores ever depends on
// them; transfers between currencies keep the amounts Rachel typed.

export interface Rates {
  /** The day the rates are from (YYYY-MM-DD). */
  date: string
  /** How much of each currency one unit of the base buys. */
  rates: Partial<Record<Currency, number>>
}

async function fetchRates(base: Currency, others: Currency[]): Promise<Rates> {
  const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${others.join(',')}`)
  if (!res.ok) throw new Error(`rates ${res.status}`)
  const body = await res.json()
  return { date: body.date, rates: body.rates }
}

/** Off (no request at all) until `enabled`; then fetched at most every few hours. */
export function useRates(base: Currency, others: Currency[], enabled: boolean) {
  const list = [...new Set(others)].filter((c) => c !== base).sort()
  return useQuery({
    queryKey: ['rates', base, list.join(',')],
    queryFn: () => fetchRates(base, list),
    enabled: enabled && list.length > 0,
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  })
}

/** An amount in `from`, in the base currency at those rates; null when a rate is missing. */
export function convert(cents: number, from: Currency, base: Currency, rates: Rates): number | null {
  if (from === base) return cents
  const r = rates.rates[from]
  return r ? Math.round(cents / r) : null
}
