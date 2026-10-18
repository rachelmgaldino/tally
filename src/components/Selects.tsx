import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Account, Category, CategoryKind } from '../lib/types'
import { AccountAvatar, CategoryAvatar } from './Avatars'
import { Popover } from './Picker'

export function AccountSelect({
  accounts, value, onChange, placeholder = 'Selecione',
}: {
  accounts: Account[]
  value: string | null
  onChange: (id: string) => void
  placeholder?: string
}) {
  const selected = accounts.find((a) => a.id === value)
  return (
    <Popover
      trigger={(_, toggle) => (
        <button type="button" className="input" onClick={toggle}>
          {selected ? <><AccountAvatar account={selected} size={20} /> <span>{selected.name}</span></> : <span className="muted">{placeholder}</span>}
        </button>
      )}
    >
      {(close) =>
        accounts.length === 0 ? (
          <div className="picker-group">Nenhuma conta. Crie uma em Configurações → Contas.</div>
        ) : (
          accounts.map((a) => (
            <button type="button" key={a.id} className={`picker-item ${a.id === value ? 'on' : ''}`} onClick={() => { onChange(a.id); close() }}>
              <AccountAvatar account={a} size={22} /> {a.name}
            </button>
          ))
        )
      }
    </Popover>
  )
}

/** Parents in name order, each followed by its subcategories. */
export function orderedCategories(categories: Category[], kind?: CategoryKind): { category: Category; depth: number }[] {
  const active = categories.filter((c) => !c.archived && (!kind || c.kind === kind))
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'pt-BR')
  const out: { category: Category; depth: number }[] = []
  for (const parent of active.filter((c) => !c.parent_id).sort(byName)) {
    out.push({ category: parent, depth: 0 })
    for (const child of active.filter((c) => c.parent_id === parent.id).sort(byName)) {
      out.push({ category: child, depth: 1 })
    }
  }
  return out
}

export function CategorySelect({
  categories, kind, value, onChange,
}: {
  categories: Category[]
  kind: CategoryKind
  value: string | null
  onChange: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const selected = categories.find((c) => c.id === value)
  const parent = selected?.parent_id ? categories.find((c) => c.id === selected.parent_id) : undefined
  const items = useMemo(() => {
    const all = orderedCategories(categories, kind)
    const needle = q.trim().toLowerCase()
    return needle ? all.filter(({ category }) => category.name.toLowerCase().includes(needle)) : all
  }, [categories, kind, q])
  return (
    <Popover
      trigger={(_, toggle) => (
        <button type="button" className="input" onClick={() => { setQ(''); toggle() }}>
          {selected ? (
            <><CategoryAvatar category={parent ?? selected} size={20} /> <span>{selected.name}</span></>
          ) : (
            <span className="muted">Buscar categoria</span>
          )}
          <span className="spacer" />
          <ChevronDown size={16} className="muted" />
        </button>
      )}
    >
      {(close) => (
        <>
          <input className="search" placeholder="Buscar" autoFocus value={q} onChange={(e) => setQ(e.target.value)} />
          {items.map(({ category, depth }) => (
            <button
              type="button"
              key={category.id}
              className={`picker-item ${depth ? 'sub' : ''} ${category.id === value ? 'on' : ''}`}
              onClick={() => { onChange(category.id); close() }}
            >
              {depth === 0 && <CategoryAvatar category={category} size={22} />}
              {category.name}
            </button>
          ))}
        </>
      )}
    </Popover>
  )
}
