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
  series_id: string | null
  /** Position in the series, from 1. */
  series_index: number | null
  tag_ids: string[]
  attachments: Attachment[]
  created_at: string
}

export interface Attachment {
  /** Storage path ("<user>/<transaction>/<file>"), or a data: URL in demo mode. */
  path: string
  name: string
  size: number
}

export type SeriesKind = 'fixed' | 'installment'
export type Period = 'yearly' | 'semiannual' | 'quarterly' | 'bimonthly' | 'monthly' | 'biweekly' | 'weekly' | 'daily'

export interface Series {
  id: string
  kind: SeriesKind
  period: Period
  start_date: string
  installments: number | null
  generated_count: number
  ended: boolean
  created_at: string
}

export interface Tag {
  id: string
  name: string
  created_at: string
}

export type NewAccount = Omit<Account, 'id' | 'created_at'>
export type NewCategory = Omit<Category, 'id' | 'created_at'>
export type NewTransaction = Omit<Transaction, 'id' | 'created_at'>
export type NewSeries = Omit<Series, 'id' | 'created_at'>
export type NewTag = Omit<Tag, 'id' | 'created_at'>
