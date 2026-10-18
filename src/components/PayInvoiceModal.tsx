import { Check, Paperclip, Tag as TagIcon, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatSize, MAX_ATTACHMENT_BYTES } from '../lib/attachments'
import { invoiceName, invoiceOf } from '../lib/cards'
import { today } from '../lib/dates'
import { createEntry, deleteEntries, updateEntry, useRefresh } from '../lib/entries'
import { useAccounts, useCards, useTransactions } from '../lib/queries'
import type { Attachment, NewTransaction, Transaction } from '../lib/types'
import { AccountSelect } from './Selects'
import { TagInput } from './TagInput'
import { useToast } from './Toast'
import { Modal, MoneyInput } from './ui'

/** "Pagar fatura": records a (possibly partial) payment of one invoice from an account. */
export function PayInvoiceModal({
  cardId, invoiceMonth, editing, onClose,
}: {
  cardId: string
  invoiceMonth: string
  editing?: Transaction
  onClose: () => void
}) {
  const { data: accounts = [] } = useAccounts()
  const { data: cards = [] } = useCards()
  const { data: txs = [] } = useTransactions()
  const refresh = useRefresh()
  const toast = useToast()
  const card = cards.find((c) => c.id === cardId)
  const invoice = card ? invoiceOf(card, txs, invoiceMonth) : undefined
  const active = accounts.filter((a) => !a.archived || a.id === editing?.account_id)

  const [amount, setAmount] = useState(editing?.amount_cents ?? invoice?.remaining ?? 0)
  const [date, setDate] = useState(editing?.date ?? today())
  const [accountId, setAccountId] = useState<string | null>(editing?.account_id ?? card?.payment_account_id ?? active[0]?.id ?? null)
  const [tagIds, setTagIds] = useState<string[]>(editing?.tag_ids ?? [])
  const [kept, setKept] = useState<Attachment[]>(editing?.attachments ?? [])
  const [files, setFiles] = useState<File[]>([])
  const [show, setShow] = useState({ files: !!editing?.attachments.length, tags: !!editing?.tag_ids.length })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  if (!card) return null

  async function save() {
    if (amount <= 0) return setError('Informe um valor.')
    if (!date) return setError('Informe a data.')
    if (!accountId) return setError('Escolha a conta.')
    const row: NewTransaction = {
      kind: 'payment',
      description: 'Pagamento de fatura',
      amount_cents: amount,
      date,
      paid: true,
      account_id: accountId,
      to_account_id: null,
      card_id: cardId,
      invoice_month: invoiceMonth,
      category_id: null,
      notes: editing?.notes ?? null,
      series_id: null,
      series_index: null,
      tag_ids: show.tags ? tagIds : [],
      attachments: show.files ? kept : [],
    }
    setBusy(true)
    setError(null)
    try {
      const upload = show.files ? files : []
      if (editing) await refresh(updateEntry(editing, row, upload))
      else await refresh(createEntry(row, null, upload))
      toast(editing ? 'Pagamento atualizado.' : 'Pagamento registrado com sucesso.')
      onClose()
    } catch (e) {
      setError(`Não foi possível salvar: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!editing) return onClose()
    if (!confirm('Excluir este pagamento?')) return
    await refresh(deleteEntries([editing]))
    toast('Pagamento excluído.')
    onClose()
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const picked = Array.from(list)
    const tooBig = picked.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (tooBig) setError(`${tooBig.name} passa de ${Math.round(MAX_ATTACHMENT_BYTES / 1_000_000)} MB.`)
    setFiles((f) => [...f, ...picked.filter((p) => p.size <= MAX_ATTACHMENT_BYTES)])
  }

  return (
    <Modal title={editing ? 'Editar pagamento' : 'Pagar fatura'} subtitle={`${card.name} · ${invoiceName(invoiceMonth)}`} onClose={onClose}>
      <form className="tx-form" onSubmit={(e) => { e.preventDefault(); save() }}>
        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label>Valor</label>
            <MoneyInput value={amount} onChange={setAmount} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="pay-date">Data</label>
            <input id="pay-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Conta</label>
          <AccountSelect accounts={active} value={accountId} onChange={setAccountId} />
        </div>
        <div className="option-icons">
          <button type="button" className={show.files ? 'on' : ''} onClick={() => setShow((s) => ({ ...s, files: !s.files }))}><span><Paperclip size={20} /></span>Anexo</button>
          <button type="button" className={show.tags ? 'on' : ''} onClick={() => setShow((s) => ({ ...s, tags: !s.tags }))}><span><TagIcon size={20} /></span>Tags</button>
        </div>
        {show.tags && (
          <div className="form-section">
            <h4>Tags</h4>
            <TagInput value={tagIds} onChange={setTagIds} />
          </div>
        )}
        {show.files && (
          <div className="form-section">
            <h4>Anexos</h4>
            {kept.map((a) => (
              <div key={a.path} className="file-line">
                <Paperclip size={13} /> <span>{a.name}</span> <small>{formatSize(a.size)}</small>
                <button type="button" onClick={() => setKept((k) => k.filter((x) => x !== a))} aria-label={`Remover ${a.name}`}><X size={13} /></button>
              </div>
            ))}
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="file-line">
                <Paperclip size={13} /> <span>{f.name}</span> <small>{formatSize(f.size)}</small>
                <button type="button" onClick={() => setFiles((list) => list.filter((x) => x !== f))} aria-label={`Remover ${f.name}`}><X size={13} /></button>
              </div>
            ))}
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            <button type="button" className="add-file" style={{ alignSelf: 'flex-start' }} onClick={() => fileInput.current?.click()}>+ Adicionar anexo</button>
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          {editing ? <button type="button" className="mini-btn" onClick={del} title="Excluir" disabled={busy}><Trash2 size={18} /></button> : <span />}
          <button type="submit" className="save-btn" disabled={busy} title="Salvar" aria-label="Salvar"><Check size={30} strokeWidth={2.5} /></button>
          <span style={{ width: 32 }} />
        </div>
      </form>
    </Modal>
  )
}
