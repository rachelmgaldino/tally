import { ChevronDown, CirclePlus, Ellipsis, Image } from 'lucide-react'
import { useState } from 'react'
import { CategoryAvatar, CategoryIcon, pastel } from '../../components/Avatars'
import { Popover } from '../../components/Picker'
import { useToast } from '../../components/Toast'
import { Modal, Segmented } from '../../components/ui'
import { t, locale } from '../../lib/i18n'
import { CATEGORY_ICONS, PALETTE } from '../../lib/icons'
import { useCategories, useCategoryMutations } from '../../lib/queries'
import type { Category, CategoryKind } from '../../lib/types'

type Editing = { mode: 'category' | 'sub'; parentId?: string; category?: Category }

export default function Categories() {
  const s = t().settings.categories
  const { data: categories = [], isLoading } = useCategories()
  const { update } = useCategoryMutations()
  const toast = useToast()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)

  const ofKind = categories.filter((c) => c.kind === kind && (showArchived || !c.archived))
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, locale())
  const parents = ofKind.filter((c) => !c.parent_id).sort(byName)
  const archivedCount = categories.filter((c) => c.kind === kind && c.archived).length

  async function toggleArchive(c: Category) {
    await update.mutateAsync({ id: c.id, patch: { archived: !c.archived } })
    toast(c.archived ? s.reactivated : s.archivedToast)
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>{s.title}</h1>
          <p>{s.intro}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ mode: 'category' })}>
          <CirclePlus size={18} /> {s.addFor[kind]}
        </button>
      </header>
      <section className="card card-pad">
      <div className="tabs" style={{ maxWidth: 360 }}>
        <button className={kind === 'expense' ? 'on' : ''} onClick={() => setKind('expense')}>{s.tabs.expense}</button>
        <button className={kind === 'income' ? 'on' : ''} onClick={() => setKind('income')}>{s.tabs.income}</button>
      </div>
      {isLoading && <p className="muted">{s.loading}</p>}
      {parents.map((p) => (
        <div key={p.id}>
          <div className="list-row" style={{ opacity: p.archived ? 0.5 : 1 }}>
            <CategoryAvatar category={p} />
            <button onClick={() => setEditing({ mode: 'category', category: p })}>{p.name}</button>
            <RowMenu
              items={[
                [s.edit, () => setEditing({ mode: 'category', category: p })],
                ...(!p.archived ? [[s.newSub, () => setEditing({ mode: 'sub', parentId: p.id })] as MenuItem] : []),
                [p.archived ? s.reactivate : s.archive, () => toggleArchive(p)],
              ]}
            />
          </div>
          {ofKind.filter((c) => c.parent_id === p.id).sort(byName).map((c) => (
            <div key={c.id} className="list-row sub" style={{ opacity: c.archived ? 0.5 : 1 }}>
              <span className="dot" style={{ background: pastel(p.color, 0.3) }} />
              <button onClick={() => setEditing({ mode: 'sub', parentId: p.id, category: c })}>{c.name}</button>
              <RowMenu
                items={[
                  [s.edit, () => setEditing({ mode: 'sub', parentId: p.id, category: c })],
                  [c.archived ? s.reactivate : s.archive, () => toggleArchive(c)],
                ]}
              />
            </div>
          ))}
        </div>
      ))}
      {archivedCount > 0 && (
        <button className="link" style={{ marginTop: 14 }} onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? s.hideArchived : s.showArchived(archivedCount)}
        </button>
      )}
      </section>
      {editing && (
        <CategoryModal
          kind={kind}
          initial={editing}
          parents={categories.filter((c) => c.kind === kind && !c.parent_id && !c.archived).sort(byName)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

type MenuItem = [string, () => void]

/** The ⋯ at the end of a category row. */
function RowMenu({ items }: { items: MenuItem[] }) {
  return (
    <Popover
      className="row-menu"
      trigger={(_, toggle) => <button className="icon-btn sm" onClick={toggle} aria-label={t().settings.categories.options}><Ellipsis size={18} /></button>}
    >
      {(close) => items.map(([label, run]) => (
        <button key={label} className="picker-item" onClick={() => { close(); run() }}>{label}</button>
      ))}
    </Popover>
  )
}

function CategoryModal({
  kind, initial, parents, onClose,
}: {
  kind: CategoryKind
  initial: Editing
  parents: Category[]
  onClose: () => void
}) {
  const s = t().settings.categories
  const cm = t().common
  const { insert, update } = useCategoryMutations()
  const toast = useToast()
  const existing = initial.category
  const [mode, setMode] = useState(initial.mode)
  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState(existing?.icon ?? '')
  const [color, setColor] = useState(existing?.color ?? PALETTE[1])
  const [parentId, setParentId] = useState<string | null>(initial.parentId ?? null)
  const [error, setError] = useState<string | null>(null)
  const parent = parents.find((p) => p.id === parentId)
  const valid = name.trim() && (mode === 'category' ? !!icon : !!parentId)

  async function save() {
    const row = mode === 'category'
      ? { kind, name: name.trim(), icon, color, parent_id: null }
      : { kind, name: name.trim(), icon: parent?.icon ?? 'more', color: parent?.color ?? '#a8a8a8', parent_id: parentId }
    try {
      if (existing) await update.mutateAsync({ id: existing.id, patch: row })
      else await insert.mutateAsync([{ ...row, archived: false }])
      toast(existing ? s.updated : s.created)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <Modal
      title={<>{s.modalTitle(!!existing, mode === 'sub')} <span className="muted">{s.kindName[kind]}</span></>}
      onClose={onClose}
      wide
    >
      <div className="stack">
        {!existing && (
          <Segmented value={mode} onChange={setMode} options={[['category', s.category], ['sub', s.subcategory]]} />
        )}
        {mode === 'category' ? (
          <>
            <div className="row" style={{ gap: 14 }}>
              {icon ? <CategoryIcon icon={icon} color={color} size={56} /> : (
                <span className="avatar" style={{ width: 56, height: 56, background: 'var(--field)' }}><Image size={20} /></span>
              )}
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="cat-name">{s.name}</label>
                <input id="cat-name" className="input" placeholder={s.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="label">{s.pickIcon}</div>
            <div className="cat-icons">
              {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                <button key={key} className={icon === key ? 'on' : ''} onClick={() => setIcon(key)} aria-label={key}><Icon size={16} /></button>
              ))}
            </div>
            <div className="label">{s.pickColor}</div>
            <div className="swatches">
              {PALETTE.map((c) => (
                <button key={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label>{s.parent}</label>
              <Popover
                trigger={(_, toggle) => (
                  <button type="button" className="input" onClick={toggle}>
                    {parent ? <><CategoryAvatar category={parent} size={20} /> {parent.name}</> : <span className="muted">{s.pickParent}</span>}
                    <span className="spacer" />
                    <ChevronDown size={16} className="muted" />
                  </button>
                )}
              >
                {(close) => parents.map((p) => (
                  <button key={p.id} className={`picker-item ${p.id === parentId ? 'on' : ''}`} onClick={() => { setParentId(p.id); close() }}>
                    <CategoryAvatar category={p} size={20} /> {p.name}
                  </button>
                ))}
              </Popover>
            </div>
            <div className="field">
              <label htmlFor="sub-name">{existing ? s.subName : s.newSub}</label>
              <input id="sub-name" className="input" placeholder={s.subPlaceholder} value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </>
        )}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>{cm.cancel}</button>
        <button className="btn btn-primary" disabled={!valid || insert.isPending || update.isPending} onClick={save}>
          {existing ? cm.save : mode === 'category' ? s.createCategory : s.createSub}
        </button>
      </div>
    </Modal>
  )
}
