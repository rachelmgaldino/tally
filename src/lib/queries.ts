import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountsTable, categoriesTable, transactionsTable, type Table } from './api'
import { DEFAULT_CATEGORIES } from './defaults'
import type { Account, Category, NewCategory, Transaction } from './types'

let seeding: Promise<Category[]> | null = null

async function loadCategories(): Promise<Category[]> {
  const rows = await categoriesTable.list()
  if (rows.length > 0) return rows
  // First run: give the user Organizze's default categories.
  seeding ??= categoriesTable.insert(
    DEFAULT_CATEGORIES.map((c): NewCategory => ({ ...c, parent_id: null, archived: false })),
  )
  return seeding
}

export const useAccounts = () =>
  useQuery({ queryKey: ['accounts'], queryFn: () => accountsTable.list() })

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: loadCategories })

export const useTransactions = () =>
  useQuery({ queryKey: ['transactions'], queryFn: () => transactionsTable.list() })

/** Insert, update and delete for one table, refreshing what depends on it. */
function useTableMutations<Row extends { id: string }, New>(key: string, table: Table<Row, New>) {
  const qc = useQueryClient()
  const onSuccess = () => qc.invalidateQueries({ queryKey: [key] })
  return {
    insert: useMutation({ mutationFn: (rows: New[]) => table.insert(rows), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Partial<New> }) => table.update(id, patch),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => table.remove(id), onSuccess }),
  }
}

export const useAccountMutations = () => useTableMutations('accounts', accountsTable)
export const useCategoryMutations = () => useTableMutations('categories', categoriesTable)
export const useTransactionMutations = () => useTableMutations('transactions', transactionsTable)

export function byId<T extends { id: string }>(rows: T[] | undefined): Map<string, T> {
  return new Map((rows ?? []).map((r) => [r.id, r]))
}

export type { Account, Category, Transaction }
