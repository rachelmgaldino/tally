/** A payment is an invoice payment: money leaves account_id and pays card_id's invoice. */
export type TxKind = 'expense' | 'income' | 'transfer' | 'payment'
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
  /** Null for card purchases, which have card_id instead. */
  account_id: string | null
  to_account_id: string | null
  card_id: string | null
  /** Card entries: the invoice, as the first day of the month it is due (YYYY-MM-01). */
  invoice_month: string | null
  category_id: string | null
  notes: string | null
  series_id: string | null
  /** Position in the series, from 1. */
  series_index: number | null
  tag_ids: string[]
  attachments: Attachment[]
  created_at: string
  /** Set on the computed "Fatura <mês>" rows, which are not stored. */
  virtual?: boolean
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

export interface Card {
  id: string
  name: string
  icon: string
  color: string
  limit_cents: number
  closing_day: number
  due_day: number
  payment_account_id: string | null
  archived: boolean
  created_at: string
}

export interface Tag {
  id: string
  name: string
  created_at: string
}

export type NewAccount = Omit<Account, 'id' | 'created_at'>
export type NewCategory = Omit<Category, 'id' | 'created_at'>
export type NewTransaction = Omit<Transaction, 'id' | 'created_at' | 'virtual'>
export type NewCard = Omit<Card, 'id' | 'created_at'>
export type NewSeries = Omit<Series, 'id' | 'created_at'>
export type NewTag = Omit<Tag, 'id' | 'created_at'>
