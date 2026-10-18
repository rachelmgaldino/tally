import type { Table } from './api'
import { defaultCategories, type CategoryKey } from './defaults'
import { language, t as strings } from './i18n'
import { dueDate, invoiceFor, invoiceOf } from './cards'
import { addMonths, currentMonth, monthStart, today, type Month } from './dates'
import { defaultHorizon, seriesRows } from './series'
import type { Card, NewTransaction, Period, Series, Transaction } from './types'

// Demo mode keeps everything in localStorage so the UI can be tried without a
// database: `npm run demo` locally, or any page under /demo on the live site.
// It never reads or writes the real account.

// One store per language, so the sample data reads in the language picked.
const key = () => `tally-demo-5${language() === 'pt-BR' ? '' : `-${language()}`}`
type Store = Record<string, Record<string, unknown>[]>

function load(): Store {
  try {
    const raw = localStorage.getItem(key())
    if (raw) return JSON.parse(raw)
  } catch {
    // fall through to a fresh store
  }
  const fresh = seed()
  save(fresh)
  return fresh
}

function save(store: Store) {
  try {
    localStorage.setItem(key(), JSON.stringify(store))
  } catch {
    // demo data simply won't persist
  }
}

/** Throws away the visitor's changes and starts again from the sample data. */
export function resetDemo() {
  try {
    localStorage.removeItem(key())
    localStorage.removeItem('tally-demo-avatar')
  } catch {
    // nothing stored
  }
  location.reload()
}

const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const pad = (n: number) => String(n).padStart(2, '0')
const on = (m: Month, day: number) => `${monthStart(m).slice(0, 8)}${pad(day)}`

/** Same numbers on every visit, so the demo always tells the same story. */
function random(seedValue: number) {
  let x = seedValue
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296
    return x / 4294967296
  }
}

// About three months of an imaginary person's money, ending today, plus the
// fixed bills and instalments that are still to come.
function seed(): Store {
  const s = strings().demo
  const rnd = random(42)
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo))
  const t = today()
  const months = [-3, -2, -1, 0].map((d) => addMonths(currentMonth(), d))
  const first = months[0]

  const categories: Record<string, unknown>[] = []
  for (const { key, ...c } of defaultCategories()) {
    categories.push({ id: id(), parent_id: null, archived: false, created_at: now(), key, ...c })
  }
  const cat = (key: CategoryKey) => categories.find((c) => c.key === key)!.id as string
  const subs = cat('subscriptions')
  const sub = (name: string) => {
    const row = { id: id(), name, kind: 'expense', icon: '', color: '', parent_id: subs, archived: false, created_at: now() }
    categories.push(row)
    return row.id
  }
  const streaming = sub(s.streaming)
  const celular = sub(s.phone)

  const account = (name: string, icon: string, color: string, initial: number, exclude = false) =>
    ({ id: id(), name, icon, color, initial_balance_cents: initial, exclude_from_total: exclude, archived: false, created_at: now() })
  const nu = account('Nubank', 'bank:nubank', '#820ad1', 320000)
  const inter = account('Inter', 'bank:inter', '#ff7a00', 85000)
  const savings = account(s.savings, 'bank:nubank', '#820ad1', 800000, true)

  const card = (name: string, icon: string, color: string, limit: number, closing: number, due: number, pays: string): Card =>
    ({ id: id(), name, icon, color, limit_cents: limit, closing_day: closing, due_day: due, payment_account_id: pays, archived: false, created_at: now() })
  const nuCard = card('Nubank', 'bank:nubank', '#820ad1', 600000, 3, 10, nu.id)
  const interCard = card('Inter Gold', 'bank:inter', '#ff7a00', 450000, 25, 5, inter.id)
  const cards = [nuCard, interCard]

  const tags = [{ id: id(), name: s.tagTrip, created_at: now() }, { id: id(), name: s.tagWork, created_at: now() }]
  const [trip, work] = tags

  const base: NewTransaction = {
    kind: 'expense', description: '', amount_cents: 0, date: t, paid: true, account_id: null, to_account_id: null,
    card_id: null, invoice_month: null, category_id: null, notes: null, series_id: null, series_index: null, tag_ids: [], attachments: [],
  }
  const rows: NewTransaction[] = []
  const add = (o: Partial<NewTransaction>) => {
    const row = { ...base, ...o }
    if (row.date > t) return
    rows.push(row)
  }
  const spend = (description: string, cents: number, date: string, category: string, account_id: string, extra: Partial<NewTransaction> = {}) =>
    add({ description, amount_cents: cents, date, category_id: category, account_id, ...extra })
  const swipe = (c: Card, description: string, cents: number, date: string, category: string, extra: Partial<NewTransaction> = {}) =>
    add({ description, amount_cents: cents, date, category_id: category, card_id: c.id, invoice_month: invoiceFor(c, date), ...extra })

  // Repeating entries, generated the same way the app does it.
  const series: Series[] = []
  const repeat = (template: Partial<NewTransaction>, day: number, installments: number | null = null, startMonth = first, period: Period = 'monthly') => {
    const s: Series = {
      id: id(), kind: installments ? 'installment' : 'fixed', period, start_date: on(startMonth, day),
      installments, generated_count: 0, ended: false, created_at: now(),
    }
    const row = { ...base, ...template, date: s.start_date }
    const made = seriesRows(row, s, 0, defaultHorizon(), true).map((r) =>
      r.card_id ? { ...r, invoice_month: invoiceFor(cards.find((c) => c.id === r.card_id)!, r.date) } : r)
    s.generated_count = made.length
    series.push(s)
    rows.push(...made)
  }
  repeat({ kind: 'income', description: s.salary, amount_cents: 680000, account_id: nu.id, category_id: cat('salary') }, 5)
  repeat({ description: s.rent, amount_cents: 185000, account_id: nu.id, category_id: cat('home') }, 10)
  repeat({ description: s.internet, amount_cents: 11990, account_id: inter.id, category_id: cat('home') }, 15)
  repeat({ description: s.phonePlan, amount_cents: 4990, account_id: inter.id, category_id: celular }, 18)
  repeat({ description: s.gym, amount_cents: 10990, card_id: nuCard.id, category_id: cat('health') }, 2)
  repeat({ description: 'Netflix', amount_cents: 4490, card_id: nuCard.id, category_id: streaming }, 12)
  repeat({ description: 'Spotify', amount_cents: 2190, card_id: interCard.id, category_id: streaming }, 20)
  repeat({ description: s.englishCourse, amount_cents: 32000, account_id: inter.id, category_id: cat('education') }, 25)
  repeat({ kind: 'transfer', description: s.splitBills, amount_cents: 150000, account_id: nu.id, to_account_id: inter.id }, 6)
  repeat({ kind: 'transfer', description: s.toSavings, amount_cents: 50000, account_id: nu.id, to_account_id: savings.id }, 6)
  repeat({ description: s.laptop, amount_cents: 420000, card_id: interCard.id, category_id: cat('work'), tag_ids: [work.id] }, 14, 10, months[1])
  repeat({ description: s.glasses, amount_cents: 96000, card_id: nuCard.id, category_id: cat('health') }, 22, 4, months[2])

  // Everyday spending, a little different each month.
  for (const m of months) {
    for (const day of [4, 11, 19, 26]) swipe(nuCard, s.groceries, between(16000, 34000), on(m, day), cat('groceries'))
    for (let i = 0; i < 4; i++) swipe(nuCard, pick(rnd, s.eatingOut), between(2800, 11500), on(m, between(1, 28)), cat('bars'))
    for (let i = 0; i < 5; i++) swipe(interCard, 'Uber', between(1400, 4200), on(m, between(1, 28)), cat('transport'))
    spend(s.electricity, between(12000, 19000), on(m, 22), cat('home'), inter.id)
    spend(s.pharmacy, between(3500, 9000), on(m, between(1, 28)), cat('health'), nu.id)
    swipe(interCard, s.petFood, between(14000, 19000), on(m, 8), cat('pets'))
    swipe(nuCard, pick(rnd, s.fun), between(4000, 16000), on(m, between(1, 28)), cat('leisure'))
    add({ kind: 'expense', description: s.gas, amount_cents: between(18000, 25000), date: on(m, 16), account_id: inter.id, category_id: cat('transport') })
  }
  const [m3, m2, m1, m0] = months
  add({ kind: 'income', description: s.freelance, amount_cents: 150000, date: on(m2, 21), account_id: inter.id, category_id: cat('otherIncome'), tag_ids: [work.id] })
  add({ kind: 'income', description: s.freelance, amount_cents: 120000, date: on(m0, 9), account_id: inter.id, category_id: cat('otherIncome'), tag_ids: [work.id] })
  add({ kind: 'income', description: s.savingsYield, amount_cents: 7100, date: on(m1, 1), account_id: savings.id, category_id: cat('investmentIncome'), notes: null })
  swipe(nuCard, s.giftJu, 18900, on(m3, 13), cat('gifts'))
  swipe(nuCard, s.runningShoes, 42990, on(m2, 9), cat('clothes'))
  swipe(interCard, s.flight, 68400, on(m2, 3), cat('travel'), { tag_ids: [trip.id] })
  swipe(interCard, s.inn, 92000, on(m1, 12), cat('travel'), { tag_ids: [trip.id], notes: s.innNotes })
  swipe(nuCard, s.boatTrip, 15000, on(m1, 14), cat('travel'), { tag_ids: [trip.id] })
  spend(s.haircut, 9000, on(m0, 7), cat('personalCare'), nu.id)
  spend(s.carTax, 64000, on(m3, 20), cat('taxes'), inter.id)
  // Still to pay this month, so Próximos has something in it.
  rows.push({ ...base, description: s.dentist, amount_cents: 25000, date: on(m0, 28), paid: false, account_id: nu.id, category_id: cat('health') })

  const transactions: Transaction[] = rows.map((r) => ({ id: id(), created_at: now(), ...r }))

  // Invoices that are already due were paid in full on the due date.
  for (const c of cards) {
    const invoices = new Set(transactions.filter((x) => x.card_id === c.id).map((x) => x.invoice_month!))
    for (const month of invoices) {
      const due = dueDate(c, month)
      if (due > t) continue
      const { total } = invoiceOf(c, transactions, month)
      if (total <= 0) continue
      transactions.push({
        ...base, id: id(), created_at: now(), kind: 'payment', description: s.billPayment, amount_cents: total,
        date: due, account_id: c.payment_account_id, card_id: c.id, invoice_month: month,
      })
    }
  }

  for (const c of categories) delete c.key
  return {
    categories,
    accounts: [nu, inter, savings],
    cards: cards as unknown as Record<string, unknown>[],
    series: series as unknown as Record<string, unknown>[],
    tags,
    transactions: transactions as unknown as Record<string, unknown>[],
  }
}

function pick<T>(rnd: () => number, list: T[]): T {
  return list[Math.floor(rnd() * list.length)]
}

let store: Store | null = null
const getStore = () => (store ??= load())

export function demoTable<Row extends { id: string }, New>(name: string): Table<Row, New> {
  const rows = () => (getStore()[name] ??= []) as unknown as Row[]
  return {
    async list() {
      // Copies, so later edits to the store never change rows the UI already holds.
      return structuredClone(rows())
    },
    async insert(newRows) {
      const created = newRows.map((r) => ({ id: id(), created_at: now(), ...r }) as unknown as Row)
      rows().push(...created)
      save(getStore())
      return structuredClone(created)
    },
    async update(rowId, patch) {
      const row = rows().find((r) => r.id === rowId)
      if (!row) throw new Error('not found')
      Object.assign(row, structuredClone(patch))
      save(getStore())
      return structuredClone(row)
    },
    async updateIf(rowId, expect, patch) {
      const row = rows().find((r) => r.id === rowId) as Record<string, unknown> | undefined
      if (!row || Object.entries(expect).some(([k, v]) => row[k] !== v)) return null
      Object.assign(row, patch)
      save(getStore())
      return { ...row } as unknown as Row
    },
    async updateMany(ids, patch) {
      for (const row of rows()) if (ids.includes(row.id)) Object.assign(row, patch)
      save(getStore())
    },
    async remove(rowId) {
      const list = rows()
      const i = list.findIndex((r) => r.id === rowId)
      if (i >= 0) list.splice(i, 1)
      save(getStore())
    },
    async removeMany(ids) {
      getStore()[name] = rows().filter((r) => !ids.includes(r.id)) as unknown as Record<string, unknown>[]
      save(getStore())
    },
  }
}
