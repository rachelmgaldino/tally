import { Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { byId, useTagMutations, useTags } from '../lib/queries'
import { t } from '../lib/i18n'

/** Pick tags by searching; typing a new name and pressing Enter creates it. */
export function TagInput({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { data: tags = [] } = useTags()
  const { insert } = useTagMutations()
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const tagMap = byId(tags)
  const q = query.trim()
  const matches = tags.filter((t) => !value.includes(t.id) && t.name.toLowerCase().includes(q.toLowerCase()))
  const exact = tags.find((t) => t.name.toLowerCase() === q.toLowerCase())

  async function pick(name: string) {
    const found = tags.find((t) => t.name.toLowerCase() === name.toLowerCase())
    const id = found?.id ?? (await insert.mutateAsync([{ name }]))[0].id
    if (!value.includes(id)) onChange([...value, id])
    setQuery('')
  }

  return (
    <div className="tag-input">
      {value.length > 0 && (
        <div className="chips">
          {value.map((id) => tagMap.get(id) && (
            <span key={id} className="chip">
              {tagMap.get(id)!.name}
              <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} aria-label={t().form.remove(tagMap.get(id)!.name)}><X size={12} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="picker">
        <div className="input">
          <Search size={15} className="muted" />
          <input
            placeholder={t().form.searchTags}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (q) pick(matches[0]?.name ?? q)
              }
            }}
          />
        </div>
        {focused && (matches.length > 0 || (q && !exact)) && (
          <div className="picker-pop">
            {matches.map((t) => (
              <button type="button" key={t.id} className="picker-item" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(t.name)}>{t.name}</button>
            ))}
            {q && !exact && (
              <button type="button" className="picker-item" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(q)}>
                <Plus size={14} /> {t().form.createTag(q)}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
