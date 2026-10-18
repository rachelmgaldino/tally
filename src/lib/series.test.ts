import { describe, expect, it } from 'vitest'
import { daysBetween, occurrenceDate, seriesChanges, seriesRows, shiftDate, splitInstallments } from './series'
import type { NewTransaction, Transaction } from './types'

describe('occurrenceDate', () => {
  it('keeps the day of the month and clamps short months', () => {
    expect(occurrenceDate('2026-01-31', 'monthly', 1)).toBe('2026-02-28')
    expect(occurrenceDate('2026-01-31', 'monthly', 2)).toBe('2026-03-31')
    expect(occurrenceDate('2026-10-01', 'monthly', 3)).toBe('2027-01-01')
    expect(occurrenceDate('2028-02-29', 'yearly', 1)).toBe('2029-02-28')
    expect(occurrenceDate('2026-10-15', 'semiannual', 1)).toBe('2027-04-15')
  })
  it('counts days for weekly, fortnightly and daily', () => {
    expect(occurrenceDate('2026-12-28', 'weekly', 1)).toBe('2027-01-04')
    expect(occurrenceDate('2026-10-01', 'biweekly', 2)).toBe('2026-10-31')
    expect(occurrenceDate('2026-10-31', 'daily', 1)).toBe('2026-11-01')
  })
  it('shifts and measures dates across months', () => {
    expect(shiftDate('2026-10-30', 5)).toBe('2026-11-04')
    expect(daysBetween('2026-10-01', '2026-10-05')).toBe(4)
  })
})

describe('instalments', () => {
  it('puts the rounding remainder on the first one', () => {
    expect(splitInstallments(8900, 2)).toEqual([4450, 4450])
    expect(splitInstallments(10000, 3)).toEqual([3334, 3333, 3333])
  })
})

const template: NewTransaction = {
  kind: 'expense', description: 'Shopee', amount_cents: 8900, date: '2026-09-22', paid: true,
  account_id: 'inter', to_account_id: null, category_id: null, notes: null,
  series_id: null, series_index: null, tag_ids: [], attachments: [],
}

describe('seriesRows', () => {
  it('creates every instalment with its number', () => {
    const rows = seriesRows(template, { id: 's', kind: 'installment', period: 'monthly', start_date: '2026-09-22', installments: 2 }, 0, '2026-10-01', true)
    expect(rows.map((r) => [r.date, r.amount_cents, r.series_index])).toEqual([['2026-09-22', 4450, 1], ['2026-10-22', 4450, 2]])
    expect(rows.every((r) => r.series_id === 's')).toBe(true)
  })
  it('creates fixed entries up to the horizon, only the first paid when the rest are in the future', () => {
    const rows = seriesRows({ ...template, date: '2099-01-01' }, { id: 's', kind: 'fixed', period: 'monthly', start_date: '2099-01-01', installments: null }, 0, '2099-04-01', true)
    expect(rows.map((r) => r.date)).toEqual(['2099-01-01', '2099-02-01', '2099-03-01'])
    expect(rows.map((r) => r.paid)).toEqual([true, false, false])
  })
  it('continues from a later entry', () => {
    const rows = seriesRows(template, { id: 's', kind: 'fixed', period: 'monthly', start_date: '2099-01-01', installments: null }, 3, '2099-06-01', false)
    expect(rows.map((r) => [r.date, r.series_index])).toEqual([['2099-04-01', 4], ['2099-05-01', 5]])
  })
})

describe('seriesChanges', () => {
  it('lists only what the next entries should copy', () => {
    const before = { ...template, id: '1', created_at: '', series_id: 's', series_index: 1 } as Transaction
    const after = { ...before, amount_cents: 9900, paid: false, date: '2026-09-25' }
    expect(seriesChanges(before, after)).toEqual({ patch: { amount_cents: 9900 }, dayShift: 3 })
  })
})
