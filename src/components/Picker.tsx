import { useEffect, useRef, useState, type ReactNode } from 'react'

/** A button that opens a small list below it; closes on outside click or Escape. */
export function Popover({
  trigger, children, className = '', popClassName = '',
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode
  children: (close: () => void) => ReactNode
  className?: string
  popClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])
  return (
    <div className={`picker ${className}`} ref={ref}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && <div className={`picker-pop ${popClassName}`}>{children(() => setOpen(false))}</div>}
    </div>
  )
}
