import type { NewCategory } from './types'

type Seed = Pick<NewCategory, 'kind' | 'name' | 'icon' | 'color'>

// Organizze's default categories, created the first time the app opens.
export const DEFAULT_CATEGORIES: Seed[] = [
  { kind: 'expense', name: 'Alimentação', icon: 'utensils', color: '#e8559b' },
  { kind: 'expense', name: 'Assinaturas e serviços', icon: 'calendar-check', color: '#7451c9' },
  { kind: 'expense', name: 'Bares e restaurantes', icon: 'wine', color: '#4b1fbf' },
  { kind: 'expense', name: 'Casa', icon: 'home', color: '#4a90e2' },
  { kind: 'expense', name: 'Compras', icon: 'shopping-bag', color: '#c2407a' },
  { kind: 'expense', name: 'Cuidados pessoais', icon: 'user', color: '#f0505a' },
  { kind: 'expense', name: 'Dívidas e empréstimos', icon: 'file-text', color: '#f78f8f' },
  { kind: 'expense', name: 'Educação', icon: 'graduation-cap', color: '#3f51b5' },
  { kind: 'expense', name: 'Família e filhos', icon: 'users', color: '#5fd068' },
  { kind: 'expense', name: 'Impostos e Taxas', icon: 'percent', color: '#f7a58f' },
  { kind: 'expense', name: 'Investimentos', icon: 'bar-chart', color: '#e66fa6' },
  { kind: 'expense', name: 'Lazer e hobbies', icon: 'smile', color: '#3b8a4a' },
  { kind: 'expense', name: 'Mercado', icon: 'shopping-cart', color: '#f7785a' },
  { kind: 'expense', name: 'Outros', icon: 'list', color: '#a8a8a8' },
  { kind: 'expense', name: 'Pets', icon: 'paw', color: '#f9a825' },
  { kind: 'expense', name: 'Presentes e doações', icon: 'gift', color: '#3d4fb5' },
  { kind: 'expense', name: 'Roupas', icon: 'shirt', color: '#b8360f' },
  { kind: 'expense', name: 'Saúde', icon: 'health', color: '#4a90e2' },
  { kind: 'expense', name: 'Trabalho', icon: 'briefcase', color: '#3f4fa8' },
  { kind: 'expense', name: 'Transporte', icon: 'bus', color: '#6f9fe0' },
  { kind: 'expense', name: 'Viagem', icon: 'plane', color: '#f05a6a' },
  { kind: 'income', name: 'Empréstimos', icon: 'dollar', color: '#2ec4a0' },
  { kind: 'income', name: 'Investimentos', icon: 'trending-up', color: '#145c4a' },
  { kind: 'income', name: 'Outras receitas', icon: 'more', color: '#8fe0c4' },
  { kind: 'income', name: 'Salário', icon: 'star', color: '#2ec4a0' },
]
