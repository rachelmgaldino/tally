import { t } from './i18n'
import type { NewCategory } from './types'

type Seed = Pick<NewCategory, 'kind' | 'name' | 'icon' | 'color'>
type Key = keyof ReturnType<typeof t>['common']['categories']

// Organizze's default categories, created the first time the app opens. Named
// in the language in use at that moment; after that they're the user's own.
const SEEDS: { key: Key; kind: Seed['kind']; icon: string; color: string }[] = [
  { key: 'food', kind: 'expense', icon: 'utensils', color: '#e8559b' },
  { key: 'subscriptions', kind: 'expense', icon: 'calendar-check', color: '#7451c9' },
  { key: 'bars', kind: 'expense', icon: 'wine', color: '#4b1fbf' },
  { key: 'home', kind: 'expense', icon: 'home', color: '#4a90e2' },
  { key: 'shopping', kind: 'expense', icon: 'shopping-bag', color: '#c2407a' },
  { key: 'personalCare', kind: 'expense', icon: 'user', color: '#f0505a' },
  { key: 'debts', kind: 'expense', icon: 'file-text', color: '#f78f8f' },
  { key: 'education', kind: 'expense', icon: 'graduation-cap', color: '#3f51b5' },
  { key: 'family', kind: 'expense', icon: 'users', color: '#5fd068' },
  { key: 'taxes', kind: 'expense', icon: 'percent', color: '#f7a58f' },
  { key: 'investments', kind: 'expense', icon: 'bar-chart', color: '#e66fa6' },
  { key: 'leisure', kind: 'expense', icon: 'smile', color: '#3b8a4a' },
  { key: 'groceries', kind: 'expense', icon: 'shopping-cart', color: '#f7785a' },
  { key: 'other', kind: 'expense', icon: 'list', color: '#a8a8a8' },
  { key: 'pets', kind: 'expense', icon: 'paw', color: '#f9a825' },
  { key: 'gifts', kind: 'expense', icon: 'gift', color: '#3d4fb5' },
  { key: 'clothes', kind: 'expense', icon: 'shirt', color: '#b8360f' },
  { key: 'health', kind: 'expense', icon: 'health', color: '#4a90e2' },
  { key: 'work', kind: 'expense', icon: 'briefcase', color: '#3f4fa8' },
  { key: 'transport', kind: 'expense', icon: 'bus', color: '#6f9fe0' },
  { key: 'travel', kind: 'expense', icon: 'plane', color: '#f05a6a' },
  { key: 'loans', kind: 'income', icon: 'dollar', color: '#2ec4a0' },
  { key: 'investmentIncome', kind: 'income', icon: 'trending-up', color: '#145c4a' },
  { key: 'otherIncome', kind: 'income', icon: 'more', color: '#8fe0c4' },
  { key: 'salary', kind: 'income', icon: 'star', color: '#2ec4a0' },
]

export type CategoryKey = Key

/** The default categories in the current language, each with the key it was made from. */
export function defaultCategories(): (Seed & { key: Key })[] {
  const names = t().common.categories
  return SEEDS.map(({ key, ...c }) => ({ key, ...c, name: names[key] }))
}
