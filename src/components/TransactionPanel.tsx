import { ChevronLeft, ChevronRight, Copy, Paperclip, Pencil, Plus, Repeat2, ThumbsUp, Trash2, Undo2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatSize, openAttachment, removeAttachments, uploadAttachment } from '../lib/attachments'
import { longDate } from '../lib/dates'
import { deleteEntries, deleteFromHere, useRefresh } from '../lib/entries'
import { formatBRL } from '../lib/money'
import { byId, useAccounts, useCategories, useSeries, useTags, useTransactionMutations, useTransactions } from '../lib/queries'
import { PERIODS } from '../lib/series'
import type { Attachment, Transaction } from '../lib/types'
import { AccountAvatar, CategoryAvatar } from './Avatars'
import { useToast } from './Toast'
import { useTxForm } from './TxFormContext'

const KIND_LABEL = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência' }
const FIXED_LABEL = { expense: 'Despesa fixa', income: 'Receita fixa', transfer: 'Transferência fixa' }

export function TransactionPanel({ tx, onClose, onNavigate }: { tx: Transaction; onClose: () => void; onNavigate: (id: string) => void }) {
  const accounts = byId(useAccounts().data)
  const categories = byId(useCategories().data)
  const tags = byId(useTags().data)
  const seriesMap = byId(useSeries().data)
  const { data: allTxs = [] } = useTransactions()
  const { update } = useTransactionMutations()
  const { open, ask } = useTxForm()
  const refresh = useRefresh()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const category = tx.category_id ? categories.get(tx.category_id) : undefined
  const parent = category?.parent_id ? categories.get(category.parent_id) : undefined
  const account = accounts.get(tx.account_id)
  const to = tx.to_account_id ? accounts.get(tx.to_account_id) : undefined
  const series = tx.series_id ? seriesMap.get(tx.series_id) : undefined

  // Neighbouring entries of the same series, for the ‹ › arrows.
  const siblings = tx.series_id
    ? allTxs.filter((t) => t.series_id === tx.series_id).sort((a, b) => (a.series_index ?? 0) - (b.series_index ?? 0))
    : []
  const at = siblings.findIndex((t) => t.id === tx.id)
  const prev = at > 0 ? siblings[at - 1] : undefined
  const next = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : undefined

  async function togglePaid() {
    await update.mutateAsync({ id: tx.id, patch: { paid: !tx.paid } })
    toast(tx.paid ? 'Marcado como pendente.' : 'Marcado como pago.')
  }

  async function del() {
    if (tx.series_id) {
      ask({
        title: 'Excluir lançamento recorrente',
        text: 'Este lançamento faz parte de uma repetição. O que você deseja excluir?',
        options: [
          { label: 'Apenas este', onClick: async () => { onClose(); await refresh(deleteEntries([tx])); toast('Lançamento excluído.') } },
          { label: 'Este e os próximos', primary: true, onClick: async () => { onClose(); await refresh(deleteFromHere(tx, allTxs, series)); toast('Lançamentos excluídos.') } },
        ],
      })
      return
    }
    if (!confirm('Excluir este lançamento?')) return
    await refresh(deleteEntries([tx]))
    toast('Lançamento excluído.')
    onClose()
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return
    setUploading(true)
    try {
      const added: Attachment[] = []
      for (const f of Array.from(list)) added.push(await uploadAttachment(tx.id, f))
      await update.mutateAsync({ id: tx.id, patch: { attachments: [...tx.attachments, ...added] } })
      toast(added.length > 1 ? 'Anexos adicionados.' : 'Anexo adicionado.')
    } catch (e) {
      toast(`Não foi possível anexar: ${(e as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  async function removeFile(a: Attachment) {
    if (!confirm(`Remover o anexo ${a.name}?`)) return
    await update.mutateAsync({ id: tx.id, patch: { attachments: tx.attachments.filter((x) => x.path !== a.path) } })
    await removeAttachments([a]).catch(() => {})
  }

  const seriesLabel = series && (
    series.kind === 'fixed'
      ? <>{FIXED_LABEL[tx.kind]} · <b>{PERIODS[series.period].adjective}</b></>
      : <>Parcela {tx.series_index}/{series.installments} · <b>{PERIODS[series.period].adjective}</b></>
  )

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" aria-label="Detalhes do lançamento">
        <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        <span className="badge">{KIND_LABEL[tx.kind]}</span>
        <h2 style={{ fontSize: 15, margin: '8px 0 14px' }}>{tx.description || KIND_LABEL[tx.kind]}</h2>

        {seriesLabel && (
          <div className="series-nav">
            <button onClick={() => prev && onNavigate(prev.id)} disabled={!prev} aria-label="Anterior"><ChevronLeft size={15} /></button>
            <span><Repeat2 size={13} /> {seriesLabel}</span>
            <button onClick={() => next && onNavigate(next.id)} disabled={!next} aria-label="Próximo"><ChevronRight size={15} /></button>
          </div>
        )}

        {tx.kind !== 'transfer' && (
          <div className="detail">
            <div className="k">Categoria</div>
            <div className="row">
              <CategoryAvatar category={parent ?? category} size={20} />
              {category ? (parent ? `${parent.name} › ${category.name}` : category.name) : 'Sem categoria'}
            </div>
          </div>
        )}
        <div className="detail"><div className="k">Valor</div>{formatBRL(tx.amount_cents)}</div>
        {tx.kind === 'transfer' ? (
          <>
            <div className="detail"><div className="k">Saiu da conta</div><div className="row"><AccountAvatar account={account} size={20} />{account?.name}</div></div>
            <div className="detail"><div className="k">Entrou na conta</div><div className="row"><AccountAvatar account={to} size={20} />{to?.name}</div></div>
          </>
        ) : (
          <div className="detail"><div className="k">Conta</div><div className="row"><AccountAvatar account={account} size={20} />{account?.name}</div></div>
        )}
        <div className="detail"><div className="k">Data</div>{longDate(tx.date)}</div>
        <div className="detail">
          <div className="k">Tags</div>
          {tx.tag_ids.filter((id) => tags.has(id)).length === 0 ? '--' : (
            <div className="chips">{tx.tag_ids.map((id) => tags.get(id) && <span key={id} className="chip">{tags.get(id)!.name}</span>)}</div>
          )}
        </div>
        <div className="detail">
          <div className="k">Anexos</div>
          {tx.attachments.map((a) => (
            <div key={a.path} className="file-line">
              <Paperclip size={13} />
              <button className="file-name" onClick={() => openAttachment(a).catch((e) => toast(`Não foi possível abrir: ${(e as Error).message}`))}>{a.name}</button>
              <small>{formatSize(a.size)}</small>
              <button onClick={() => removeFile(a)} aria-label={`Remover ${a.name}`}><X size={13} /></button>
            </div>
          ))}
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          <button className="add-file" onClick={() => fileInput.current?.click()} disabled={uploading}>
            <Plus size={13} /> {uploading ? 'Enviando…' : 'Adicionar anexo'}
          </button>
        </div>
        <div className="detail"><div className="k">Observação</div>{tx.notes || '--'}</div>

        <div className="drawer-actions">
          <button onClick={() => open({ kind: tx.kind, editing: tx })}><span className="circle"><Pencil size={14} /></span>Editar</button>
          <button onClick={() => open({ kind: tx.kind, editing: tx, repeat: true })} disabled={!!tx.series_id} title={tx.series_id ? 'Este lançamento já se repete' : undefined}>
            <span className="circle"><Repeat2 size={14} /></span>Repetir
          </button>
          {tx.kind !== 'transfer' && (
            <button onClick={togglePaid}>
              <span className="circle">{tx.paid ? <Undo2 size={14} /> : <ThumbsUp size={14} />}</span>
              {tx.paid ? 'Desfazer' : 'Pagar'}
            </button>
          )}
          <button onClick={() => open({ kind: tx.kind, copyOf: tx })}><span className="circle"><Copy size={14} /></span>Copiar</button>
          <button onClick={del}><span className="circle"><Trash2 size={14} /></span>Excluir</button>
        </div>
      </aside>
    </>
  )
}
