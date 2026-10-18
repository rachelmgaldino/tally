import { findBank } from '../lib/banks'
import { ACCOUNT_ICONS, categoryIcon } from '../lib/icons'
import { useAvatarUrl, useProfile } from '../lib/profile'
import type { Account, Card, Category } from '../lib/types'

/** The user's colour softened towards the card colour, so icons sit on pastel fills with ink lines. */
export function pastel(hex: string, amount = 0.55): string {
  const n = parseInt(hex.slice(1), 16)
  const mix = (c: number, w: number) => Math.round(c + (w - c) * amount)
  const r = mix((n >> 16) & 255, 255), g = mix((n >> 8) & 255, 253), b = mix(n & 255, 248)
  return `rgb(${r} ${g} ${b})`
}

const INK = '#2b2a33'

export function AccountIcon({ icon, color, size = 40, square }: { icon: string; color: string; size?: number; square?: boolean }) {
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
    <span className={cls} style={{ width: size, height: size, background: pastel(color), color: INK }}>
      <Icon size={size * 0.5} />
    </span>
  )
}

export function AccountAvatar({ account, size, square }: { account: Account | undefined; size?: number; square?: boolean }) {
  if (!account) return <AccountIcon icon="icon:bank" color="#d4d4d4" size={size} square={square} />
  return <AccountIcon icon={account.icon} color={account.color} size={size} square={square} />
}

export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  const Icon = categoryIcon(icon)
  return (
    <span className="avatar cat" style={{ width: size, height: size, background: pastel(color), color: INK }}>
      <Icon size={size * 0.5} strokeWidth={2} />
    </span>
  )
}

export function CategoryAvatar({ category, size }: { category: Category | undefined; size?: number }) {
  if (!category) return <CategoryIcon icon="more" color="#d4d4d4" size={size} />
  return <CategoryIcon icon={category.icon} color={category.color} size={size} />
}

/** A credit card drawn as a pastel card with the issuer icon, used on the overview, settings and invoice pages. */
export function CardArt({ card, sub, tilt, style }: { card: Pick<Card, 'name' | 'icon' | 'color'>; sub?: React.ReactNode; tilt?: boolean; style?: React.CSSProperties }) {
  return (
    <div className={`ccard ${tilt ? 'tilt' : ''}`} style={{ background: pastel(card.color, 0.5), ...style }}>
      <div className="top">
        <span className="chipdeco" />
        <AccountIcon icon={card.icon} color={card.color} size={32} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="name">{card.name}</div>
        {sub && <div className="sub">{sub}</div>}
      </div>
    </div>
  )
}

/** Rachel's profile photo, or her initial on rose when there's none. */
export function UserAvatar({ size = 40, fontSize }: { size?: number; fontSize?: number }) {
  const { name, avatarPath } = useProfile()
  const url = useAvatarUrl(avatarPath)
  return (
    <span className="avatar" style={{ width: size, height: size, background: 'var(--rose)', fontSize }}>
      {url ? <img src={url} alt="" width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
    </span>
  )
}
