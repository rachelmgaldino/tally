import { DEMO } from './config'
import { demoTable } from './demo'
import { supabase } from './supabase'
import type {
  Account, Category, NewAccount, NewCategory, NewTransaction, Transaction,
} from './types'

export interface Table<Row, New> {
  list(): Promise<Row[]>
  insert(rows: New[]): Promise<Row[]>
  update(id: string, patch: Partial<New>): Promise<Row>
  remove(id: string): Promise<void>
}

const PAGE = 1000

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
    async remove(id) {
      const { error } = await supabase.from(name).delete().eq('id', id)
      if (error) throw error
    },
  }
}

function table<Row extends { id: string }, New>(name: string, order: string): Table<Row, New> {
  return DEMO ? demoTable<Row, New>(name) : supabaseTable<Row, New>(name, order)
}

export const accountsTable = table<Account, NewAccount>('accounts', 'created_at')
export const categoriesTable = table<Category, NewCategory>('categories', 'name')
export const transactionsTable = table<Transaction, NewTransaction>('transactions', 'date')
