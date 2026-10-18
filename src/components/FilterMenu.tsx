import { ChevronDown } from 'lucide-react'
import { Popover } from './Picker'

export interface FilterItem<T> {
  id: T | null
  label: string
  sub?: boolean
  /** A group heading, not selectable. */
  header?: boolean
}

/** One pill in the grey filter bar, opening a single-choice list. */
export function FilterMenu<T extends string>({
  label, on, items, value, onChange, className,
}: {
  className?: string
  label: string
  on: boolean
  items: FilterItem<T>[]
  value: T | null
  onChange: (v: T | null) => void
}) {
  return (
    <Popover
      className={className}
      trigger={(_, toggle) => (
        <button className={on ? 'on' : ''} onClick={toggle}>{label} <ChevronDown size={13} /></button>
      )}
    >
      {(close) =>
        items.map((item, i) => item.header ? (
          <div key={`h${i}`} className="picker-group">{item.label}</div>
        ) : (
          <button
            key={item.id ?? 'all'}
            className={`picker-item ${item.sub ? 'sub' : ''} ${item.id === value ? 'on' : ''}`}
            onClick={() => { onChange(item.id); close() }}
          >
            {item.label}
          </button>
        ))
      }
    </Popover>
  )
}
