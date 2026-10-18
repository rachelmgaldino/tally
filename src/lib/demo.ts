import type { Table } from './api'
import { DEFAULT_CATEGORIES } from './defaults'
import { dueDate, invoiceFor, invoiceOf } from './cards'
import { addMonths, currentMonth, monthStart, today, type Month } from './dates'
import { defaultHorizon, seriesRows } from './series'
import type { Card, NewTransaction, Period, Series, Transaction } from './types'

// Demo mode keeps everything in localStorage so the UI can be tried without a
// database: `npm run demo` locally, or any page under /demo on the live site.
// It never reads or writes the real account.

const KEY = 'tally-demo-5'
type Store = Record<string, Record<string, unknown>[]>

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
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
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // demo data simply won't persist
  }
}

/** Throws away the visitor's changes and starts again from the sample data. */
export function resetDemo() {
  try {
    localStorage.removeItem(KEY)
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
  const rnd = random(42)
  const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo))
  const t = today()
  const months = [-3, -2, -1, 0].map((d) => addMonths(currentMonth(), d))
  const first = months[0]

  const categories: Record<string, unknown>[] = []
  for (const c of DEFAULT_CATEGORIES) {
    categories.push({ id: id(), parent_id: null, archived: false, created_at: now(), ...c })
  }
  const cat = (name: string) => categories.find((c) => c.name === name && !c.parent_id)!.id as string
  const subs = cat('Assinaturas e serviços')
  const sub = (name: string) => {
    const row = { id: id(), name, kind: 'expense', icon: '', color: '', parent_id: subs, archived: false, created_at: now() }
    categories.push(row)
    return row.id
  }
  const streaming = sub('Streaming')
  const celular = sub('Celular')

  const account = (name: string, icon: string, color: string, initial: number, exclude = false) =>
    ({ id: id(), name, icon, color, initial_balance_cents: initial, exclude_from_total: exclude, archived: false, created_at: now() })
  const nu = account('Nubank', 'bank:nubank', '#820ad1', 320000)
  const inter = account('Inter', 'bank:inter', '#ff7a00', 85000)
  const savings = account('Caixinha', 'bank:nubank', '#820ad1', 800000, true)

  const card = (name: string, icon: string, color: string, limit: number, closing: number, due: number, pays: string): Card =>
    ({ id: id(), name, icon, color, limit_cents: limit, closing_day: closing, due_day: due, payment_account_id: pays, archived: false, created_at: now() })
  const nuCard = card('Nubank', 'bank:nubank', '#820ad1', 600000, 3, 10, nu.id)
  const interCard = card('Inter Gold', 'bank:inter', '#ff7a00', 450000, 25, 5, inter.id)
  const cards = [nuCard, interCard]

  const tags = [{ id: id(), name: 'Viagem', created_at: now() }, { id: id(), name: 'Trabalho', created_at: now() }]
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
  repeat({ kind: 'income', description: 'Salário', amount_cents: 680000, account_id: nu.id, category_id: cat('Salário') }, 5)
  repeat({ description: 'Aluguel', amount_cents: 185000, account_id: nu.id, category_id: cat('Casa') }, 10)
  repeat({ description: 'Internet', amount_cents: 11990, account_id: inter.id, category_id: cat('Casa') }, 15)
  repeat({ description: 'Plano do celular', amount_cents: 4990, account_id: inter.id, category_id: celular }, 18)
  repeat({ description: 'Academia', amount_cents: 10990, card_id: nuCard.id, category_id: cat('Saúde') }, 2)
  repeat({ description: 'Netflix', amount_cents: 4490, card_id: nuCard.id, category_id: streaming }, 12)
  repeat({ description: 'Spotify', amount_cents: 2190, card_id: interCard.id, category_id: streaming }, 20)
  repeat({ description: 'Curso de inglês', amount_cents: 32000, account_id: inter.id, category_id: cat('Educação') }, 25)
  repeat({ kind: 'transfer', description: 'Separar as contas do mês', amount_cents: 150000, account_id: nu.id, to_account_id: inter.id }, 6)
  repeat({ kind: 'transfer', description: 'Guardar na caixinha', amount_cents: 50000, account_id: nu.id, to_account_id: savings.id }, 6)
  repeat({ description: 'Notebook', amount_cents: 420000, card_id: interCard.id, category_id: cat('Trabalho'), tag_ids: [work.id] }, 14, 10, months[1])
  repeat({ description: 'Óculos novos', amount_cents: 96000, card_id: nuCard.id, category_id: cat('Saúde') }, 22, 4, months[2])

  // Everyday spending, a little different each month.
  for (const m of months) {
    for (const day of [4, 11, 19, 26]) swipe(nuCard, 'Mercado', between(16000, 34000), on(m, day), cat('Mercado'))
    for (let i = 0; i < 4; i++) swipe(nuCard, pick(rnd, ['iFood', 'Restaurante japonês', 'Padaria', 'Pizzaria', 'Café com a Bia']), between(2800, 11500), on(m, between(1, 28)), cat('Bares e restaurantes'))
    for (let i = 0; i < 5; i++) swipe(interCard, 'Uber', between(1400, 4200), on(m, between(1, 28)), cat('Transporte'))
    spend('Conta de luz', between(12000, 19000), on(m, 22), cat('Casa'), inter.id)
    spend('Farmácia', between(3500, 9000), on(m, between(1, 28)), cat('Saúde'), nu.id)
    swipe(interCard, 'Ração e areia', between(14000, 19000), on(m, 8), cat('Pets'))
    swipe(nuCard, pick(rnd, ['Cinema', 'Show', 'Livro', 'Jogo novo']), between(4000, 16000), on(m, between(1, 28)), cat('Lazer e hobbies'))
    add({ kind: 'expense', description: 'Gasolina', amount_cents: between(18000, 25000), date: on(m, 16), account_id: inter.id, category_id: cat('Transporte') })
  }
  const [m3, m2, m1, m0] = months
  add({ kind: 'income', description: 'Freela de design', amount_cents: 150000, date: on(m2, 21), account_id: inter.id, category_id: cat('Outras receitas'), tag_ids: [work.id] })
  add({ kind: 'income', description: 'Freela de design', amount_cents: 120000, date: on(m0, 9), account_id: inter.id, category_id: cat('Outras receitas'), tag_ids: [work.id] })
  add({ kind: 'income', description: 'Rendimento da caixinha', amount_cents: 7100, date: on(m1, 1), account_id: savings.id, category_id: cat('Investimentos'), notes: null })
  swipe(nuCard, 'Presente da Ju', 18900, on(m3, 13), cat('Presentes e doações'))
  swipe(nuCard, 'Tênis de corrida', 42990, on(m2, 9), cat('Roupas'))
  swipe(interCard, 'Passagem para Floripa', 68400, on(m2, 3), cat('Viagem'), { tag_ids: [trip.id] })
  swipe(interCard, 'Pousada em Floripa', 92000, on(m1, 12), cat('Viagem'), { tag_ids: [trip.id], notes: '3 noites, café incluso' })
  swipe(nuCard, 'Passeio de barco', 15000, on(m1, 14), cat('Viagem'), { tag_ids: [trip.id] })
  spend('Corte de cabelo', 9000, on(m0, 7), cat('Cuidados pessoais'), nu.id)
  spend('IPVA', 64000, on(m3, 20), cat('Impostos e Taxas'), inter.id)
  // Still to pay this month, so Próximos has something in it.
  rows.push({ ...base, description: 'Dentista', amount_cents: 25000, date: on(m0, 28), paid: false, account_id: nu.id, category_id: cat('Saúde') })

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
        ...base, id: id(), created_at: now(), kind: 'payment', description: 'Pagamento de fatura', amount_cents: total,
        date: due, account_id: c.payment_account_id, card_id: c.id, invoice_month: month,
      })
    }
  }

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
