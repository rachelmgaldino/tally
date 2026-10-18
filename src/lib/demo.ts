import type { Table } from './api'
import { DEFAULT_CATEGORIES } from './defaults'
import { today } from './dates'

// Demo mode keeps everything in localStorage so the UI can be tried without a
// database. It is only reachable through `npm run demo` in development.

const KEY = 'tally-demo'
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
  const tx = (o: Record<string, unknown>) => ({ id: id(), created_at: now(), notes: null, to_account_id: null, paid: true, ...o })
  return {
    categories,
    accounts: [nu, inter, savings],
    transactions: [
      tx({ kind: 'income', description: 'Salário', amount_cents: 180000, date: `${month}01`, account_id: nu.id, category_id: cat('Salário') }),
      tx({ kind: 'expense', description: 'Mercado', amount_cents: 23490, date: `${month}03`, account_id: nu.id, category_id: cat('Mercado') }),
      tx({ kind: 'expense', description: 'Claro', amount_cents: 3900, date: `${month}05`, account_id: inter.id, category_id: cat('Casa') }),
      tx({ kind: 'transfer', description: 'Transferência', amount_cents: 20000, date: t, account_id: inter.id, to_account_id: nu.id, category_id: null }),
      tx({ kind: 'income', description: 'Pai', amount_cents: 20000, date: t, account_id: nu.id, category_id: cat('Outras receitas') }),
      tx({ kind: 'expense', description: 'Aluguel', amount_cents: 120000, date: `${month}28`, paid: false, account_id: nu.id, category_id: cat('Casa') }),
    ],
  }
}

let store: Store | null = null
const getStore = () => (store ??= load())

export function demoTable<Row extends { id: string }, New>(name: string): Table<Row, New> {
  const rows = () => (getStore()[name] ??= []) as unknown as Row[]
  return {
    async list() {
      return [...rows()]
    },
    async insert(newRows) {
      const created = newRows.map((r) => ({ id: id(), created_at: now(), ...r }) as unknown as Row)
      rows().push(...created)
      save(getStore())
      return created
    },
    async update(rowId, patch) {
      const row = rows().find((r) => r.id === rowId)
      if (!row) throw new Error('not found')
      Object.assign(row, patch)
      save(getStore())
      return { ...row }
    },
    async remove(rowId) {
      const list = rows()
      const i = list.findIndex((r) => r.id === rowId)
      if (i >= 0) list.splice(i, 1)
      save(getStore())
    },
  }
}
