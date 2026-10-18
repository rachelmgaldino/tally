import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { accountsTable, cardsTable, categoriesTable, seriesTable, tagsTable, transactionsTable, type Table } from './api'
import { defaultCategories } from './defaults'
import type { Account, Card, Category, NewCategory, Series, Tag, Transaction } from './types'

let seeding: Promise<Category[]> | null = null

async function loadCategories(): Promise<Category[]> {
  const rows = await categoriesTable.list()
  if (rows.length > 0) return rows
  // First run: give the user Organizze's default categories.
  // Shared while in flight so parallel loads seed once; cleared after so the next account to sign in on this tab gets its own.
  seeding ??= categoriesTable.insert(
    defaultCategories().map(({ key: _key, ...c }): NewCategory => ({ ...c, parent_id: null, archived: false })),
  ).finally(() => { seeding = null })
  return seeding
}

export const useAccounts = () =>
  useQuery({ queryKey: ['accounts'], queryFn: () => accountsTable.list() })

export const useCategories = () =>
  useQuery({ queryKey: ['categories'], queryFn: loadCategories })

export const useTransactions = () =>
  useQuery({ queryKey: ['transactions'], queryFn: () => transactionsTable.list() })

export const useCards = () =>
  useQuery({ queryKey: ['cards'], queryFn: () => cardsTable.list() })

export const useSeries = () =>
  useQuery({ queryKey: ['series'], queryFn: () => seriesTable.list() })

export const useTags = () =>
  useQuery({ queryKey: ['tags'], queryFn: () => tagsTable.list() })

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
export const useTagMutations = () => useTableMutations('tags', tagsTable)
export const useCardMutations = () => useTableMutations('cards', cardsTable)

export function byId<T extends { id: string }>(rows: T[] | undefined): Map<string, T> {
  return new Map((rows ?? []).map((r) => [r.id, r]))
}

export type { Account, Card, Category, Series, Tag, Transaction }
