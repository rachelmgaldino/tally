import { findBank } from '../lib/banks'
import { ACCOUNT_ICONS, categoryIcon } from '../lib/icons'
import type { Account, Category } from '../lib/types'

/** Text colour that stays readable on a given background. */
function contrast(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return r * 0.299 + g * 0.587 + b * 0.114 > 170 ? '#333' : '#fff'
}

export function AccountIcon({ icon, color, size = 32, square }: { icon: string; color: string; size?: number; square?: boolean }) {
  const [type, key] = icon.split(':')
  const cls = `avatar ${square ? 'square' : ''}`
  if (type === 'bank') {
    const bank = findBank(key)
    if (bank) {
      const fs = Math.max(8, size * (bank.label.length > 3 ? 0.26 : 0.38))
      return (
        <span className={cls} style={{ width: size, height: size, background: bank.bg, color: bank.fg, fontSize: fs, letterSpacing: -0.3 }}>
          {bank.label}
        </span>
      )
    }
  }
  const Icon = (ACCOUNT_ICONS[key] ?? ACCOUNT_ICONS.bank).icon
  return (
    <span className={cls} style={{ width: size, height: size, background: color, color: contrast(color) }}>
      <Icon size={size * 0.5} />
    </span>
  )
}

export function AccountAvatar({ account, size, square }: { account: Account | undefined; size?: number; square?: boolean }) {
  if (!account) return <AccountIcon icon="icon:bank" color="#d4d4d4" size={size} square={square} />
  return <AccountIcon icon={account.icon} color={account.color} size={size} square={square} />
}

export function CategoryIcon({ icon, color, size = 32 }: { icon: string; color: string; size?: number }) {
  const Icon = categoryIcon(icon)
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, color: contrast(color) }}>
      <Icon size={size * 0.5} />
    </span>
  )
}

export function CategoryAvatar({ category, size }: { category: Category | undefined; size?: number }) {
  if (!category) return <CategoryIcon icon="more" color="#d4d4d4" size={size} />
  return <CategoryIcon icon={category.icon} color={category.color} size={size} />
}
