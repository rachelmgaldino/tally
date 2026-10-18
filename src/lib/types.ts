export type TxKind = 'expense' | 'income' | 'transfer'
export type CategoryKind = 'expense' | 'income'

export interface Account {
  id: string
  name: string
  icon: string
  color: string
  initial_balance_cents: number
  exclude_from_total: boolean
  archived: boolean
  created_at: string
}

export interface Category {
  id: string
  kind: CategoryKind
  name: string
  icon: string
  color: string
  parent_id: string | null
  archived: boolean
  created_at: string
}

export interface Transaction {
  id: string
  kind: TxKind
  description: string
  amount_cents: number
  /** ISO date, YYYY-MM-DD, no time zone. */
  date: string
  paid: boolean
  account_id: string
  to_account_id: string | null
  category_id: string | null
  notes: string | null
  created_at: string
}

export type NewAccount = Omit<Account, 'id' | 'created_at'>
export type NewCategory = Omit<Category, 'id' | 'created_at'>
export type NewTransaction = Omit<Transaction, 'id' | 'created_at'>
