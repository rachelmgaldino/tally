import { ChevronLeft, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, type ReactNode } from 'react'
import { centsFromTyping, formatCents } from '../lib/money'
import { t } from '../lib/i18n'

export function Modal({
  title, subtitle, onClose, children, wide, className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
  className?: string
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''} ${className ?? ''}`} role="dialog" aria-modal="true">
        <button className="modal-close" onClick={onClose} aria-label={t().common.close}><X size={20} /></button>
        <div className="modal-head">
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button type="button" className="toggle" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <span className="toggle-track" />
      {label}
    </button>
  )
}

export function MoneyInput({ value, onChange, autoFocus }: { value: number; onChange: (cents: number) => void; autoFocus?: boolean }) {
  return (
    <div className="input">
      <span className="prefix">R$</span>
      <input
        inputMode="numeric"
        value={formatCents(value)}
        autoFocus={autoFocus}
        onChange={(e) => onChange(centsFromTyping(e.target.value))}
        onFocus={(e) => e.target.select()}
      />
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button type="button" key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  )
}

/** Phone only: the way back to the Mais tab from the pages it opens. */
export function BackToMore() {
  return <Link to="/mais" className="back-link phone-only"><ChevronLeft size={18} /> {t().common.nav.more}</Link>
}
