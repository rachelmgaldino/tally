import { ChevronDown, CirclePlus, Image } from 'lucide-react'
import { useState } from 'react'
import { CategoryAvatar, CategoryIcon, pastel } from '../../components/Avatars'
import { Popover } from '../../components/Picker'
import { useToast } from '../../components/Toast'
import { Modal, Segmented } from '../../components/ui'
import { CATEGORY_ICONS, PALETTE } from '../../lib/icons'
import { useCategories, useCategoryMutations } from '../../lib/queries'
import type { Category, CategoryKind } from '../../lib/types'

const KIND_NAME: Record<CategoryKind, string> = { expense: 'Despesa', income: 'Receita' }

type Editing = { mode: 'category' | 'sub'; parentId?: string; category?: Category }

export default function Categories() {
  const { data: categories = [], isLoading } = useCategories()
  const { update } = useCategoryMutations()
  const toast = useToast()
  const [kind, setKind] = useState<CategoryKind>('expense')
  const [showArchived, setShowArchived] = useState(false)
  const [editing, setEditing] = useState<Editing | null>(null)

  const ofKind = categories.filter((c) => c.kind === kind && (showArchived || !c.archived))
  const byName = (a: Category, b: Category) => a.name.localeCompare(b.name, 'pt-BR')
  const parents = ofKind.filter((c) => !c.parent_id).sort(byName)
  const archivedCount = categories.filter((c) => c.kind === kind && c.archived).length

  async function toggleArchive(c: Category) {
    await update.mutateAsync({ id: c.id, patch: { archived: !c.archived } })
    toast(c.archived ? 'Categoria reativada.' : 'Categoria arquivada.')
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Categorias</h1>
          <p>Como você separa o que entra e o que sai.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({ mode: 'category' })}>
          <CirclePlus size={18} /> Categoria de {KIND_NAME[kind].toLowerCase()}
        </button>
      </header>
      <section className="card card-pad">
      <div className="tabs" style={{ maxWidth: 360 }}>
        <button className={kind === 'expense' ? 'on' : ''} onClick={() => setKind('expense')}>Despesas</button>
        <button className={kind === 'income' ? 'on' : ''} onClick={() => setKind('income')}>Receitas</button>
      </div>
      {isLoading && <p className="muted">Carregando…</p>}
      {parents.map((p) => (
        <div key={p.id}>
          <div className="list-row" style={{ opacity: p.archived ? 0.5 : 1 }}>
            <CategoryAvatar category={p} />
            <button onClick={() => setEditing({ mode: 'category', category: p })}>{p.name}</button>
            <span className="actions">
              {!p.archived && <button onClick={() => setEditing({ mode: 'sub', parentId: p.id })}>+ subcategoria</button>}
              <button onClick={() => toggleArchive(p)}>{p.archived ? 'reativar' : 'arquivar'}</button>
            </span>
          </div>
          {ofKind.filter((c) => c.parent_id === p.id).sort(byName).map((c) => (
            <div key={c.id} className="list-row sub" style={{ opacity: c.archived ? 0.5 : 1 }}>
              <span className="dot" style={{ background: pastel(p.color, 0.3) }} />
              <button onClick={() => setEditing({ mode: 'sub', parentId: p.id, category: c })}>{c.name}</button>
              <span className="actions">
                <button onClick={() => toggleArchive(c)}>{c.archived ? 'reativar' : 'arquivar'}</button>
              </span>
            </div>
          ))}
        </div>
      ))}
      {archivedCount > 0 && (
        <button className="link" style={{ marginTop: 14 }} onClick={() => setShowArchived((s) => !s)}>
          {showArchived ? 'Esconder arquivadas' : `Mostrar arquivadas (${archivedCount})`}
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

function CategoryModal({
  kind, initial, parents, onClose,
}: {
  kind: CategoryKind
  initial: Editing
  parents: Category[]
  onClose: () => void
}) {
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
      toast(existing ? 'Categoria atualizada.' : 'Categoria criada.')
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const verb = existing ? 'Editar' : 'Criar nova'
  return (
    <Modal
      title={<>{verb} {mode === 'category' ? 'categoria' : 'subcategoria'} de <span className="muted">{KIND_NAME[kind]}</span></>}
      onClose={onClose}
      wide
    >
      <div className="stack">
        {!existing && (
          <Segmented value={mode} onChange={setMode} options={[['category', 'Categoria'], ['sub', 'Subcategoria']]} />
        )}
        {mode === 'category' ? (
          <>
            <div className="row" style={{ gap: 14 }}>
              {icon ? <CategoryIcon icon={icon} color={color} size={56} /> : (
                <span className="avatar" style={{ width: 56, height: 56, background: 'var(--field)' }}><Image size={20} /></span>
              )}
              <div className="field" style={{ flex: 1 }}>
                <label htmlFor="cat-name">Nome da categoria</label>
                <input id="cat-name" className="input" placeholder="Escolha um nome para a categoria" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
            </div>
            <div className="label">Escolha um ícone</div>
            <div className="cat-icons">
              {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                <button key={key} className={icon === key ? 'on' : ''} onClick={() => setIcon(key)} aria-label={key}><Icon size={16} /></button>
              ))}
            </div>
            <div className="label">Escolha uma cor</div>
            <div className="swatches">
              {PALETTE.map((c) => (
                <button key={c} className={`swatch ${color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label>Categoria principal</label>
              <Popover
                trigger={(_, toggle) => (
                  <button type="button" className="input" onClick={toggle}>
                    {parent ? <><CategoryAvatar category={parent} size={20} /> {parent.name}</> : <span className="muted">Selecione a categoria pai</span>}
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
              <label htmlFor="sub-name">{existing ? 'Nome da subcategoria' : 'Nova subcategoria'}</label>
              <input id="sub-name" className="input" placeholder="Escolha o nome da subcategoria" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          </>
        )}
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn btn-outline" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!valid || insert.isPending || update.isPending} onClick={save}>
          {existing ? 'Salvar' : mode === 'category' ? 'Criar categoria' : 'Criar subcategoria'}
        </button>
      </div>
    </Modal>
  )
}
