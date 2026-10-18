import { ArrowLeftRight, ChevronLeft, ChevronRight, Copy, CreditCard, Paperclip, Pencil, Plus, Repeat2, ThumbsUp, Trash2, Undo2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatSize, openAttachment, removeAttachments, uploadAttachment } from '../lib/attachments'
import { invoiceName } from '../lib/cards'
import { longDate } from '../lib/dates'
import { t } from '../lib/i18n'
import { deleteEntries, deleteFromHere, useRefresh } from '../lib/entries'
import { formatBRL } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useSeries, useTags, useTransactionMutations, useTransactions } from '../lib/queries'
import { PERIODS } from '../lib/series'
import type { Attachment, Transaction } from '../lib/types'
import { AccountAvatar, AccountIcon, CategoryAvatar } from './Avatars'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'
import { useTxForm } from './TxFormContext'

/** Payments are stored as "Pagamento de fatura" (or "Bill payment"); show them in the current language. */
const DEFAULT_PAYMENT = ['Pagamento de fatura', 'Bill payment']

export function TransactionPanel({ tx, onClose, onNavigate }: { tx: Transaction; onClose: () => void; onNavigate: (id: string) => void }) {
  const s = t().form
  const common = t().common
  const kindLabel = common.kinds[tx.kind]
  const title = (tx.kind === 'payment' && DEFAULT_PAYMENT.includes(tx.description) ? '' : tx.description) || kindLabel
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
  const confirmDelete = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const category = tx.category_id ? categories.get(tx.category_id) : undefined
  const parent = category?.parent_id ? categories.get(category.parent_id) : undefined
  const account = tx.account_id ? accounts.get(tx.account_id) : undefined
  const card = tx.card_id ? cards.get(tx.card_id) : undefined
  const isPayment = tx.kind === 'payment'
  const to = tx.to_account_id ? accounts.get(tx.to_account_id) : undefined
  const series = tx.series_id ? seriesMap.get(tx.series_id) : undefined
  const hasTags = tx.tag_ids.some((id) => tags.has(id))

  // Neighbouring entries of the same series, for the ‹ › arrows.
  const siblings = tx.series_id
    ? allTxs.filter((x) => x.series_id === tx.series_id).sort((a, b) => (a.series_index ?? 0) - (b.series_index ?? 0))
    : []
  const at = siblings.findIndex((x) => x.id === tx.id)
  const prev = at > 0 ? siblings[at - 1] : undefined
  const next = at >= 0 && at < siblings.length - 1 ? siblings[at + 1] : undefined

  async function togglePaid() {
    await update.mutateAsync({ id: tx.id, patch: { paid: !tx.paid } })
    toast(tx.paid ? s.markedPending : s.markedPaid)
  }

  async function del() {
    if (tx.series_id) {
      ask({
        title: s.deleteRecurringTitle,
        text: s.deleteRecurringText,
        options: [
          { label: s.onlyThis, onClick: async () => { onClose(); await refresh(deleteEntries([tx])); toast(s.entryDeleted) } },
          { label: s.thisAndNext, primary: true, onClick: async () => { onClose(); await refresh(deleteFromHere(tx, allTxs, series)); toast(s.entriesDeleted) } },
        ],
      })
      return
    }
    if (!(await confirmDelete({ title: s.deleteTitle, text: s.deleteText }))) return
    onClose()
    await refresh(deleteEntries([tx]))
    toast(s.entryDeleted)
  }

  async function addFiles(list: FileList | null) {
    if (!list?.length) return
    setUploading(true)
    try {
      const added: Attachment[] = []
      for (const f of Array.from(list)) added.push(await uploadAttachment(tx.id, f))
      await update.mutateAsync({ id: tx.id, patch: { attachments: [...tx.attachments, ...added] } })
      toast(added.length > 1 ? s.attachmentsAdded : s.attachmentAdded)
    } catch (e) {
      toast(s.couldNotAttach((e as Error).message))
    } finally {
      setUploading(false)
    }
  }

  async function removeFile(a: Attachment) {
    if (!confirm(s.removeAttachment(a.name))) return
    await update.mutateAsync({ id: tx.id, patch: { attachments: tx.attachments.filter((x) => x.path !== a.path) } })
    await removeAttachments([a]).catch(() => {})
  }

  const seriesLabel = series && (
    series.kind === 'fixed'
      ? <>{s.fixedLabel[tx.kind]} · <b>{PERIODS[series.period].adjective}</b></>
      : <>{s.installmentOf(tx.series_index, series.installments)} · <b>{PERIODS[series.period].adjective}</b></>
  )

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" aria-label={s.details}>
        <button className="modal-close" onClick={onClose} aria-label={common.close}><X size={18} /></button>
        <span className={`chip-kind desk-only ${tx.kind}`}>{kindLabel}</span>
        <h2 className="desk-only">{title}</h2>
        <div className="ph-det-head phone-only">
          {tx.kind === 'transfer' ? <span className="avatar cat" style={{ width: 52, height: 52, background: 'var(--blue)' }}><ArrowLeftRight size={22} /></span>
            : isPayment ? <span className="avatar cat" style={{ width: 52, height: 52, background: 'var(--peach)' }}><CreditCard size={22} /></span>
            : <CategoryAvatar category={parent ?? category} size={52} />}
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            <div className="ph-det-badges">
              <span className={`chip-kind ${tx.kind}`}>{kindLabel}</span>
              {(tx.kind === 'expense' || tx.kind === 'income') && !card && (
                <span className={`ph-det-status ${tx.paid ? 'paid' : ''}`}>{tx.paid ? (tx.kind === 'income' ? s.received : s.paid) : s.pending}</span>
              )}
            </div>
          </div>
        </div>
        <div className={`ph-det-amount phone-only ${tx.kind === 'income' ? 'income' : tx.kind === 'transfer' ? '' : 'expense'}`}>
          {tx.kind === 'income' ? '+' : tx.kind === 'transfer' ? '' : '−'}{formatBRL(tx.amount_cents)}
        </div>

        {seriesLabel && (
          <div className="series-nav">
            <button onClick={() => prev && onNavigate(prev.id)} disabled={!prev} aria-label={s.prevOccurrence}><ChevronLeft size={18} /></button>
            <span><Repeat2 size={15} /> {seriesLabel}</span>
            <button onClick={() => next && onNavigate(next.id)} disabled={!next} aria-label={s.nextOccurrence}><ChevronRight size={18} /></button>
          </div>
        )}

        <div className="details ph-det-card">
          {(tx.kind === 'expense' || tx.kind === 'income') && (
            <div className="detail">
              <span className="k">{s.category}</span>
              <span className="row">
                <CategoryAvatar category={parent ?? category} size={24} />
                {category ? (parent ? `${parent.name} › ${category.name}` : category.name) : common.noCategory}
              </span>
            </div>
          )}
          <div className="detail desk-only"><span className="k">{s.amount}</span><span className={`value ${tx.kind === 'income' ? 'income' : tx.kind === 'transfer' ? '' : 'expense'}`}>{formatBRL(tx.amount_cents)}</span></div>
          {tx.kind === 'transfer' ? (
            <>
              <div className="detail"><span className="k">{s.fromAccount}</span><span className="row"><AccountAvatar account={account} size={24} />{account?.name}</span></div>
              <div className="detail"><span className="k">{s.toAccount}</span><span className="row"><AccountAvatar account={to} size={24} />{to?.name}</span></div>
            </>
          ) : (
            <>
              {account && <div className="detail"><span className="k">{isPayment ? s.paidWith : s.account}</span><span className="row"><AccountAvatar account={account} size={24} />{account.name}</span></div>}
              {card && (
                <div className="detail">
                  <span className="k">{common.card}</span>
                  <span>
                    <span className="row"><AccountIcon icon={card.icon} color={card.color} size={24} />{card.name}</span>
                    {tx.invoice_month && <span className="muted small" style={{ display: 'block', marginTop: 2 }}>{invoiceName(tx.invoice_month)}</span>}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="detail"><span className="k">{s.date}</span><span>{longDate(tx.date)}</span></div>
          {hasTags && (
            <div className="detail">
              <span className="k">{s.tags}</span>
              <span className="chips" style={{ justifyContent: 'flex-end' }}>{tx.tag_ids.map((id) => tags.get(id) && <span key={id} className="chip">{tags.get(id)!.name}</span>)}</span>
            </div>
          )}
          {tx.attachments.length > 0 && (
            <div className="detail block">
              <span className="k">{s.attachments}</span>
              <div>
                {tx.attachments.map((a) => (
                  <div key={a.path} className="file-line">
                    <Paperclip size={14} />
                    <button className="file-name" onClick={() => openAttachment(a).catch((e) => toast(s.couldNotOpen((e as Error).message)))}>{a.name}</button>
                    <small>{formatSize(a.size)}</small>
                    <button onClick={() => removeFile(a)} aria-label={s.remove(a.name)}><X size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tx.notes && <div className="detail block"><span className="k">{s.note}</span><span style={{ fontWeight: 600 }}>{tx.notes}</span></div>}
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          <div className="add-chips">
            {!hasTags && <button onClick={() => open({ kind: tx.kind, editing: tx })}><Plus size={13} /> {s.addTag}</button>}
            {!tx.notes && <button onClick={() => open({ kind: tx.kind, editing: tx })}><Plus size={13} /> {s.addNote}</button>}
            <button onClick={() => fileInput.current?.click()} disabled={uploading}><Plus size={13} /> {uploading ? s.uploading : s.addFile}</button>
          </div>
        </div>

        <div className="drawer-actions">
          <button className="btn btn-primary" onClick={() => open({ kind: tx.kind, editing: tx })}><Pencil size={18} /> {s.edit}</button>
          {!isPayment && (
            <button className="btn btn-blue desk-only" onClick={() => open({ kind: tx.kind, editing: tx, repeat: true })} disabled={!!tx.series_id} title={tx.series_id ? s.entryAlreadyRepeats : undefined}>
              <Repeat2 size={18} /> {s.repeat}
            </button>
          )}
          {tx.kind !== 'transfer' && !isPayment && !card && (
            <button className="btn pay-act" onClick={togglePaid}>
              {tx.paid ? <Undo2 size={18} /> : <ThumbsUp size={18} />}
              {tx.paid ? s.undo : s.pay}
            </button>
          )}
          {!isPayment && <button className="btn" onClick={() => open({ kind: tx.kind, copyOf: tx })}><Copy size={18} /> {s.copy}</button>}
          <button className="btn btn-pink" onClick={del}><Trash2 size={18} /> {common.delete}</button>
        </div>
      </aside>
    </>
  )
}
