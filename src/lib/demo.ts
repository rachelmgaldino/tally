import type { Table } from './api'
import { DEFAULT_CATEGORIES } from './defaults'
import { invoiceFor } from './cards'
import { today } from './dates'

// Demo mode keeps everything in localStorage so the UI can be tried without a
// database. It is only reachable through `npm run demo` in development.

const KEY = 'tally-demo-3'
type Store = Record<string, Record<string, unknown>[]>

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // fall through to a fresh store
  }
  return seed()
}

function save(store: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // demo data simply won't persist
  }
}

const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()

function seed(): Store {
  const categories: Record<string, unknown>[] = []
  for (const c of DEFAULT_CATEGORIES) {
    categories.push({ id: id(), parent_id: null, archived: false, created_at: now(), ...c })
  }
  const cat = (name: string) => categories.find((c) => c.name === name)!.id
  const nu = { id: id(), name: 'Nuconta', icon: 'bank:nubank', color: '#820ad1', initial_balance_cents: 0, exclude_from_total: false, archived: false, created_at: now() }
  const inter = { id: id(), name: 'Inter', icon: 'bank:inter', color: '#ff7a00', initial_balance_cents: 0, exclude_from_total: false, archived: false, created_at: now() }
  const savings = { id: id(), name: 'Nuconta Poupança', icon: 'bank:nubank', color: '#820ad1', initial_balance_cents: 60000, exclude_from_total: true, archived: false, created_at: now() }
  const t = today()
  const month = t.slice(0, 8)
  const tx = (o: Record<string, unknown>) => ({
    id: id(), created_at: now(), notes: null, to_account_id: null, paid: true,
    series_id: null, series_index: null, tag_ids: [], attachments: [], card_id: null, invoice_month: null, ...o,
  })
  const card = { id: id(), name: 'Inter Gold', icon: 'bank:inter', color: '#ff7a00', limit_cents: 300000, closing_day: 29, due_day: 5, payment_account_id: inter.id, archived: false, created_at: now() }
  const buy = (description: string, cents: number, date: string, category: string) =>
    tx({ kind: 'expense', description, amount_cents: cents, date, account_id: null, card_id: card.id, invoice_month: invoiceFor(card, date), category_id: cat(category) })
  return {
    categories,
    accounts: [nu, inter, savings],
    cards: [card],
    series: [],
    tags: [{ id: id(), name: 'Viagem', created_at: now() }, { id: id(), name: 'Trabalho', created_at: now() }],
    transactions: [
      tx({ kind: 'income', description: 'Salário', amount_cents: 180000, date: `${month}01`, account_id: nu.id, category_id: cat('Salário') }),
      tx({ kind: 'expense', description: 'Mercado', amount_cents: 23490, date: `${month}03`, account_id: nu.id, category_id: cat('Mercado') }),
      tx({ kind: 'expense', description: 'Claro', amount_cents: 3900, date: `${month}05`, account_id: inter.id, category_id: cat('Casa') }),
      tx({ kind: 'transfer', description: 'Transferência', amount_cents: 20000, date: t, account_id: inter.id, to_account_id: nu.id, category_id: null }),
      tx({ kind: 'income', description: 'Pai', amount_cents: 20000, date: t, account_id: nu.id, category_id: cat('Outras receitas') }),
      tx({ kind: 'expense', description: 'Aluguel', amount_cents: 120000, date: `${month}28`, paid: false, account_id: nu.id, category_id: cat('Casa') }),
      buy('Restaurante', 8650, `${month}02`, 'Bares e restaurantes'),
      buy('Farmácia', 4390, `${month}08`, 'Saúde'),
      buy('Cinema', 6000, t, 'Lazer e hobbies'),
    ],
  }
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
