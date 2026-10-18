import { ChevronLeft, ChevronRight, Copy, Paperclip, Pencil, Plus, Repeat2, ThumbsUp, Trash2, Undo2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatSize, openAttachment, removeAttachments, uploadAttachment } from '../lib/attachments'
import { invoiceName } from '../lib/cards'
import { longDate } from '../lib/dates'
import { deleteEntries, deleteFromHere, useRefresh } from '../lib/entries'
import { formatBRL } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useSeries, useTags, useTransactionMutations, useTransactions } from '../lib/queries'
import { PERIODS } from '../lib/series'
import type { Attachment, Transaction } from '../lib/types'
import { AccountAvatar, AccountIcon, CategoryAvatar } from './Avatars'
import { useToast } from './Toast'
import { useTxForm } from './TxFormContext'

const KIND_LABEL = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência', payment: 'Pagamento de fatura' }
const FIXED_LABEL = { expense: 'Despesa fixa', income: 'Receita fixa', transfer: 'Transferência fixa', payment: 'Pagamento fixo' }

export function TransactionPanel({ tx, onClose, onNavigate }: { tx: Transaction; onClose: () => void; onNavigate: (id: string) => void }) {
  const accounts = byId(useAccounts().data)
  const categories = byId(useCategories().data)
  const tags = byId(useTags().data)
  const seriesMap = byId(useSeries().data)
  const cards = byId(useCards().data)
  const { data: allTxs = [] } = useTransactions()
  const { update } = useTransactionMutations()
  const { open, ask } = useTxForm()
  const refresh = useRefresh()
  const toast = useToast()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const category = tx.category_id ? categories.get(tx.category_id) : undefined
  const parent = category?.parent_id ? categories.get(category.parent_id) : undefined
  const account = tx.account_id ? accounts.get(tx.account_id) : undefined
  const card = tx.card_id ? cards.get(tx.card_id) : undefined
  const isPayment = tx.kind === 'payment'
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
        <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={18} /></button>
        <span className={`chip-kind ${tx.kind}`}>{KIND_LABEL[tx.kind]}</span>
        <h2>{tx.description || KIND_LABEL[tx.kind]}</h2>

        {seriesLabel && (
          <div className="series-nav">
            <button onClick={() => prev && onNavigate(prev.id)} disabled={!prev} aria-label="Ocorrência anterior"><ChevronLeft size={18} /></button>
            <span><Repeat2 size={15} /> {seriesLabel}</span>
            <button onClick={() => next && onNavigate(next.id)} disabled={!next} aria-label="Próxima ocorrência"><ChevronRight size={18} /></button>
          </div>
        )}

        <div className="details">
          {(tx.kind === 'expense' || tx.kind === 'income') && (
            <div className="detail">
              <span className="k">Categoria</span>
              <span className="row">
                <CategoryAvatar category={parent ?? category} size={24} />
                {category ? (parent ? `${parent.name} › ${category.name}` : category.name) : 'Sem categoria'}
              </span>
            </div>
          )}
          <div className="detail"><span className="k">Valor</span><span className={`value ${tx.kind === 'income' ? 'income' : tx.kind === 'transfer' ? '' : 'expense'}`}>{formatBRL(tx.amount_cents)}</span></div>
          {tx.kind === 'transfer' ? (
            <>
              <div className="detail"><span className="k">Saiu da conta</span><span className="row"><AccountAvatar account={account} size={24} />{account?.name}</span></div>
              <div className="detail"><span className="k">Entrou na conta</span><span className="row"><AccountAvatar account={to} size={24} />{to?.name}</span></div>
            </>
          ) : (
            <>
              {account && <div className="detail"><span className="k">{isPayment ? 'Paga com' : 'Conta'}</span><span className="row"><AccountAvatar account={account} size={24} />{account.name}</span></div>}
              {card && (
                <div className="detail">
                  <span className="k">Cartão</span>
                  <span>
                    <span className="row"><AccountIcon icon={card.icon} color={card.color} size={24} />{card.name}</span>
                    {tx.invoice_month && <span className="muted small" style={{ display: 'block', marginTop: 2 }}>{invoiceName(tx.invoice_month)}</span>}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="detail"><span className="k">Data</span><span>{longDate(tx.date)}</span></div>
          <div className="detail">
            <span className="k">Tags</span>
            {tx.tag_ids.filter((id) => tags.has(id)).length === 0 ? <span className="muted">--</span> : (
              <span className="chips" style={{ justifyContent: 'flex-end' }}>{tx.tag_ids.map((id) => tags.get(id) && <span key={id} className="chip">{tags.get(id)!.name}</span>)}</span>
            )}
          </div>
          <div className="detail block">
            <span className="k">Anexos</span>
            <div>
              {tx.attachments.map((a) => (
                <div key={a.path} className="file-line">
                  <Paperclip size={14} />
                  <button className="file-name" onClick={() => openAttachment(a).catch((e) => toast(`Não foi possível abrir: ${(e as Error).message}`))}>{a.name}</button>
                  <small>{formatSize(a.size)}</small>
                  <button onClick={() => removeFile(a)} aria-label={`Remover ${a.name}`}><X size={14} /></button>
                </div>
              ))}
              <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
              <button className="add-file" onClick={() => fileInput.current?.click()} disabled={uploading}>
                <Plus size={13} /> {uploading ? 'Enviando…' : 'Adicionar'}
              </button>
            </div>
          </div>
          <div className="detail block"><span className="k">Observação</span><span className={tx.notes ? '' : 'muted'} style={{ fontWeight: 600 }}>{tx.notes || 'Nenhuma observação ainda.'}</span></div>
        </div>

        <div className="drawer-actions">
          <button className="btn btn-primary" onClick={() => open({ kind: tx.kind, editing: tx })}><Pencil size={18} /> Editar</button>
          {!isPayment && (
            <button className="btn btn-blue" onClick={() => open({ kind: tx.kind, editing: tx, repeat: true })} disabled={!!tx.series_id} title={tx.series_id ? 'Este lançamento já se repete' : undefined}>
              <Repeat2 size={18} /> Repetir
            </button>
          )}
          {tx.kind !== 'transfer' && !isPayment && !card && (
            <button className="btn" onClick={togglePaid}>
              {tx.paid ? <Undo2 size={18} /> : <ThumbsUp size={18} />}
              {tx.paid ? 'Desfazer' : 'Pagar'}
            </button>
          )}
          {!isPayment && <button className="btn" onClick={() => open({ kind: tx.kind, copyOf: tx })}><Copy size={18} /> Copiar</button>}
          <button className="btn btn-pink" onClick={del}><Trash2 size={18} /> Excluir</button>
        </div>
      </aside>
    </>
  )
}
