import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { DEMO } from './config'
import type { PeriodKind } from './periods'
import { supabase } from './supabase'

// Preferências live in the Supabase user's metadata, so they follow Rachel
// from the laptop to the phone. A local copy makes them apply instantly.

export interface Prefs {
  /** Which day comes first in Lançamentos. */
  order: 'desc' | 'asc'
  /** How much time Lançamentos shows at once. */
  period: PeriodKind
  /** A running balance under each day in Lançamentos. */
  dailyBalance: boolean
  /** How many days ahead Próximos looks on Início. */
  nextDays: 7 | 14 | 30
}

export const DEFAULT_PREFS: Prefs = { order: 'desc', period: 'month', dailyBalance: false, nextDays: 7 }
const KEY = 'tally-prefs'

function local(): Partial<Prefs> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

const PrefsContext = createContext<{ prefs: Prefs; setPrefs: (patch: Partial<Prefs>) => Promise<void> }>({
  prefs: DEFAULT_PREFS,
  setPrefs: async () => {},
})

export function PrefsProvider({ saved, children }: { saved?: Partial<Prefs>; children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(() => ({ ...DEFAULT_PREFS, ...local(), ...saved }))

  const setPrefs = useCallback(async (patch: Partial<Prefs>) => {
    let next = DEFAULT_PREFS
    setState((p) => (next = { ...p, ...patch }))
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
    if (!DEMO) {
      const { error } = await supabase.auth.updateUser({ data: { prefs: next } })
      if (error) throw error
    }
  }, [])

  return <PrefsContext.Provider value={{ prefs, setPrefs }}>{children}</PrefsContext.Provider>
}

export const usePrefs = () => useContext(PrefsContext)
