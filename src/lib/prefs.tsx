import { createContext, Fragment, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { DEMO } from './config'
import { browserLanguage, isLanguage, setLanguage, type Language } from './i18n'
import { isCurrency, setHomeCurrency, type Currency } from './money'
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
  /** "Idioma / Language". Português unless the account was made on an English sign-up screen. */
  language: Language
  /** Show the total of the kept accounts (savings) on the Saldo geral card. Off: they stay out of sight. */
  showSaved: boolean
  /** "Moeda principal": the Saldo geral and the month's totals are in it. */
  homeCurrency: Currency
  /** Adds an approximate total in the Moeda principal, at today's rate, under the other currencies on the Saldo geral card. */
  convertTotal: boolean
  /** How Início sums up the month on desktop: a receipt in its own column, or four boxes in a row. */
  homeSummary: 'receipt' | 'boxes'
}

export const DEFAULT_PREFS: Prefs = { order: 'desc', period: 'month', dailyBalance: false, nextDays: 7, language: 'pt-BR', showSaved: false, homeCurrency: 'BRL', convertTotal: false, homeSummary: 'receipt' }
const KEY = 'tally-prefs'
/** The last language used on this device, for the login screen. */
const LANGUAGE_KEY = 'tally-language'

/** The login and sign-up screens: the language last used here, or the browser's. */
export function deviceLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY)
    if (isLanguage(saved)) return saved
  } catch { /* ignore */ }
  return browserLanguage()
}

export function rememberLanguage(lang: Language) {
  try { localStorage.setItem(LANGUAGE_KEY, lang) } catch { /* ignore */ }
}

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
  const [prefs, setState] = useState<Prefs>(() => {
    const cached = local()
    // The demo has no account, so it starts in the visitor's language. A real
    // account only takes the language from its own saved prefs (the demo
    // shares this browser's storage).
    const language = DEMO ? (cached.language ?? deviceLanguage()) : (saved?.language ?? DEFAULT_PREFS.language)
    return { ...DEFAULT_PREFS, ...cached, ...saved, language }
  })
  const lang = isLanguage(prefs.language) ? prefs.language : DEFAULT_PREFS.language
  // Set before the children render, so everything below reads the right strings and currency.
  setLanguage(lang)
  const home = isCurrency(prefs.homeCurrency) ? prefs.homeCurrency : DEFAULT_PREFS.homeCurrency
  setHomeCurrency(home)
  useEffect(() => { if (!DEMO) rememberLanguage(lang) }, [lang])

  const setPrefs = useCallback(async (patch: Partial<Prefs>) => {
    let next = DEFAULT_PREFS
    setState((p) => (next = { ...p, ...patch }))
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
    if (!DEMO) {
      const { error } = await supabase.auth.updateUser({ data: { prefs: next } })
      if (error) throw error
    }
  }, [])

  // A new language or Moeda principal redraws everything, so no screen keeps the old one.
  return (
    <PrefsContext.Provider value={{ prefs, setPrefs }}>
      <Fragment key={`${lang}-${home}`}>{children}</Fragment>
    </PrefsContext.Provider>
  )
}

export const usePrefs = () => useContext(PrefsContext)
