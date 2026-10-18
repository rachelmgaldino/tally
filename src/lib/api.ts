import { DEMO } from './config'
import { demoTable } from './demo'
import { supabase } from './supabase'
import type {
  Account, Card, Category, NewAccount, NewCard, NewCategory, NewSeries, NewTag, NewTransaction, Series, Tag, Transaction,
} from './types'

export interface Table<Row, New> {
  list(): Promise<Row[]>
  insert(rows: New[]): Promise<Row[]>
  update(id: string, patch: Partial<New>): Promise<Row>
  /** Updates the row only if it still has the `expect` values; null when it didn't. */
  updateIf(id: string, expect: Partial<New>, patch: Partial<New>): Promise<Row | null>
  updateMany(ids: string[], patch: Partial<New>): Promise<void>
  remove(id: string): Promise<void>
  removeMany(ids: string[]): Promise<void>
}

const PAGE = 1000

/** Keeps `in (...)` filters short enough for a URL. */
function chunks(ids: string[], size = 100): string[][] {
  const out: string[][] = []
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size))
  return out
}

function supabaseTable<Row, New>(name: string, order: string): Table<Row, New> {
  return {
    async list() {
      // PostgREST caps each response at 1000 rows, so read in pages.
      const rows: Row[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from(name)
          .select('*')
          .order(order)
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...(data as Row[]))
        if (data.length < PAGE) return rows
      }
    },
    async insert(rows) {
      const { data, error } = await supabase.from(name).insert(rows as object[]).select()
      if (error) throw error
      return data as Row[]
    },
    async update(id, patch) {
      const { data, error } = await supabase.from(name).update(patch as object).eq('id', id).select().single()
      if (error) throw error
      return data as Row
    },
    async updateIf(id, expect, patch) {
      let q = supabase.from(name).update(patch as object).eq('id', id)
      for (const [k, v] of Object.entries(expect)) q = q.eq(k, v)
      const { data, error } = await q.select()
      if (error) throw error
      return (data[0] as Row | undefined) ?? null
    },
    async updateMany(ids, patch) {
      for (const chunk of chunks(ids)) {
        const { error } = await supabase.from(name).update(patch as object).in('id', chunk)
        if (error) throw error
      }
    },
    async remove(id) {
      const { error } = await supabase.from(name).delete().eq('id', id)
      if (error) throw error
    },
    async removeMany(ids) {
      for (const chunk of chunks(ids)) {
        const { error } = await supabase.from(name).delete().in('id', chunk)
        if (error) throw error
      }
    },
  }
}

function table<Row extends { id: string }, New>(name: string, order: string): Table<Row, New> {
  return DEMO ? demoTable<Row, New>(name) : supabaseTable<Row, New>(name, order)
}

export const accountsTable = table<Account, NewAccount>('accounts', 'created_at')
export const categoriesTable = table<Category, NewCategory>('categories', 'name')
export const transactionsTable = table<Transaction, NewTransaction>('transactions', 'date')
export const seriesTable = table<Series, NewSeries>('series', 'created_at')
export const tagsTable = table<Tag, NewTag>('tags', 'name')
export const cardsTable = table<Card, NewCard>('cards', 'created_at')
