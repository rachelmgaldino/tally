// Every piece of text Tally shows, in Brazilian Portuguese and English. Each
// area of the app keeps its strings in its own file here (pt first, then en,
// typed to match). The language is set before anything renders (see
// PrefsProvider and App), so components and helpers read it through `t()`.

import * as common from './common'
import * as demo from './demo'
import * as entries from './entries'
import * as form from './form'
import * as invoice from './invoice'
import * as landing from './landing'
import * as login from './login'
import * as overview from './overview'
import * as prefs from './prefs'
import * as settings from './settings'

export type Language = 'pt-BR' | 'en'

export const LANGUAGES: { id: Language; name: string }[] = [
  { id: 'pt-BR', name: 'Português' },
  { id: 'en', name: 'English' },
]

const pt = {
  common: common.pt,
  demo: demo.pt,
  entries: entries.pt,
  form: form.pt,
  invoice: invoice.pt,
  landing: landing.pt,
  login: login.pt,
  overview: overview.pt,
  prefs: prefs.pt,
  settings: settings.pt,
}

export type Strings = typeof pt

const en: Strings = {
  common: common.en,
  demo: demo.en,
  entries: entries.en,
  form: form.en,
  invoice: invoice.en,
  landing: landing.en,
  login: login.en,
  overview: overview.en,
  prefs: prefs.en,
  settings: settings.en,
}

const strings: Record<Language, Strings> = { 'pt-BR': pt, en }

let current: Language = 'pt-BR'

export function setLanguage(lang: Language): void {
  current = lang
  if (typeof document !== 'undefined') document.documentElement.lang = lang
}

export function language(): Language {
  return current
}

/** The strings of the current language. */
export function t(): Strings {
  return strings[current]
}

/** For Intl: number and date formatting follow the language (money stays in R$). */
export function locale(): string {
  return current === 'en' ? 'en-US' : 'pt-BR'
}

export const isLanguage = (v: unknown): v is Language => v === 'pt-BR' || v === 'en'

/** Portuguese for browsers set to Portuguese, English for everyone else. */
export function browserLanguage(): Language {
  const list = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
  return list.some((l) => l?.toLowerCase().startsWith('pt')) ? 'pt-BR' : 'en'
}
