import { Check, ChevronDown, CopyPlus, CreditCard, Info, MessageSquare, Paperclip, Plus, Repeat2, Tag as TagIcon, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatSize, MAX_ATTACHMENT_BYTES } from '../lib/attachments'
import { invoiceFor, invoiceName, monthsBetween, shiftInvoice, toMonth } from '../lib/cards'
import { monthLabel, today } from '../lib/dates'
import { applyToNext, convertEntry, createEntry, deleteEntries, deleteFromHere, updateEntry, useRefresh, type RepeatOptions } from '../lib/entries'
import { formatBRL } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useSeries, useTransactions } from '../lib/queries'
import { PERIOD_ORDER, PERIODS, seriesChanges, splitInstallments } from '../lib/series'
import type { Attachment, NewTransaction, Period, SeriesKind, Transaction, TxKind } from '../lib/types'
import { Popover } from './Picker'
import { AccountSelect, CategorySelect, SourceSelect } from './Selects'
import { TagInput } from './TagInput'
import { useToast } from './Toast'
import { useTxForm } from './TxFormContext'
import { Modal, MoneyInput, Segmented, Toggle } from './ui'

export type FormKind = Exclude<TxKind, 'payment'>

const TITLES: Record<FormKind, [string, string]> = {
  expense: ['Nova despesa', 'Editar despesa'],
  income: ['Nova receita', 'Editar receita'],
  transfer: ['Transferência entre contas', 'Editar transferência'],
}

const KIND_TAB: Record<FormKind, string> = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência' }

const REPEAT_TITLE: Record<FormKind, string> = {
  expense: 'Repetir despesas',
  income: 'Repetir receitas',
  transfer: 'Repetir transferências',
}

const INSTALLMENT_COUNTS = Array.from({ length: 71 }, (_, i) => i + 2)

export function TransactionForm({
  kind, editing, copyOf, defaultAccountId, startRepeat, onClose, onKind,
}: {
  kind: FormKind
  editing?: Transaction
  copyOf?: Transaction
  defaultAccountId?: string
  startRepeat?: boolean
  onClose: () => void
  /** Switches between despesa, receita and transferência while creating. */
  onKind?: (kind: FormKind) => void
}) {
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: allTxs = [] } = useTransactions()
  const { data: cards = [] } = useCards()
  const seriesMap = byId(useSeries().data)
  const { ask } = useTxForm()
  const refresh = useRefresh()
  const toast = useToast()
  const active = accounts.filter((a) => !a.archived)
  const source = editing ?? copyOf
  const inSeries = !!editing?.series_id
  const series = editing?.series_id ? seriesMap.get(editing.series_id) : undefined

  const [description, setDescription] = useState(source?.description ?? (kind === 'transfer' ? 'Transferência' : ''))
  const [amount, setAmount] = useState(source?.amount_cents ?? 0)
  const [date, setDate] = useState(editing?.date ?? today())
  const [paid, setPaid] = useState(editing?.paid ?? true)
  // Account or, for expenses and income, a card.
  const [accountId, setAccountId] = useState<string | null>(source?.account_id ?? source?.card_id ?? defaultAccountId ?? active[0]?.id ?? null)
  const card = kind === 'transfer' ? undefined : cards.find((c) => c.id === accountId)
  const usableCards = cards.filter((c) => !c.archived || c.id === source?.card_id)
  // "Fatura de …": months away from the invoice the date falls into.
  const [invoiceShift, setInvoiceShift] = useState(() => {
    const c = cards.find((x) => x.id === source?.card_id)
    return c && source?.invoice_month ? monthsBetween(invoiceFor(c, source.date), source.invoice_month) : 0
  })
  const invoice = card ? shiftInvoice(invoiceFor(card, date || today()), invoiceShift) : null
  const [toAccountId, setToAccountId] = useState<string | null>(source?.to_account_id ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(source?.category_id ?? null)
  const [notes, setNotes] = useState(source?.notes ?? '')
  const [tagIds, setTagIds] = useState<string[]>(source?.tag_ids ?? [])
  const [kept, setKept] = useState<Attachment[]>(editing?.attachments ?? [])
  const [files, setFiles] = useState<File[]>([])
  const [show, setShow] = useState({
    repeat: !!startRepeat && !inSeries,
    notes: !!source?.notes,
    files: !!editing?.attachments.length,
    tags: !!source?.tag_ids.length,
  })
  const [repeatKind, setRepeatKind] = useState<SeriesKind>('fixed')
  const [period, setPeriod] = useState<Period>('monthly')
  const [installments, setInstallments] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const titleIndex = editing ? 1 : 0
  const repeat: RepeatOptions | null = show.repeat && !inSeries ? { kind: repeatKind, period, installments } : null
  const toggle = (k: keyof typeof show) => setShow((s) => ({ ...s, [k]: !s[k] }))

  function validate(): NewTransaction | null {
    if (amount <= 0) return fail('Informe um valor.')
    if (!date) return fail('Informe a data.')
    if (!accountId) return fail(kind === 'transfer' ? 'Escolha de qual conta saiu.' : 'Escolha a conta.')
    if (kind === 'transfer') {
      if (!toAccountId) return fail('Escolha em qual conta entrou.')
      if (toAccountId === accountId) return fail('Escolha duas contas diferentes.')
    }
    if (repeat?.kind === 'installment' && amount < installments) return fail('O valor é pequeno demais para tantas parcelas.')
    return {
      kind,
      description: description.trim(),
      amount_cents: amount,
      date,
      paid: kind === 'transfer' || card ? true : paid,
      account_id: card ? null : accountId,
      to_account_id: kind === 'transfer' ? toAccountId : null,
      card_id: card?.id ?? null,
      invoice_month: invoice,
      category_id: kind === 'transfer' ? null : categoryId,
      notes: show.notes ? notes.trim() || null : null,
      series_id: editing?.series_id ?? null,
      series_index: editing?.series_index ?? null,
      tag_ids: show.tags ? tagIds : [],
      attachments: show.files ? kept : [],
    }
  }

  function fail(msg: string): null {
    setError(msg)
    return null
  }

  async function save(again: boolean) {
    const row = validate()
    if (!row) return
    const upload = show.files ? files : []
    setError(null)
    setBusy(true)
    try {
      if (!editing) {
        await refresh(createEntry(row, repeat, upload, cards))
      } else if (repeat) {
        await refresh(convertEntry(editing, row, repeat, upload, cards))
      } else {
        const after = await refresh(updateEntry(editing, row, upload))
        if (inSeries) offerApplyToNext(editing, after)
      }
      toast(editing ? 'Lançamento atualizado.' : repeat ? 'Lançamentos salvos.' : 'Lançamento salvo.')
      if (again) {
        setDescription(kind === 'transfer' ? 'Transferência' : '')
        setAmount(0)
        setNotes('')
        setFiles([])
        setShow((s) => ({ ...s, repeat: false, notes: false, files: false }))
      } else {
        onClose()
      }
    } catch (e) {
      setError(`Não foi possível salvar: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  /** After editing one entry of a series, Organizze asks whether the later ones change too. */
  function offerApplyToNext(before: Transaction, after: Transaction) {
    const { patch, dayShift } = seriesChanges(before, after)
    const hasLater = allTxs.some((t) => t.series_id === after.series_id && (t.series_index ?? 0) > (after.series_index ?? 0))
    if (!hasLater || (Object.keys(patch).length === 0 && dayShift === 0)) return
    ask({
      title: 'Alteração salva!',
      text: 'Este lançamento é recorrente. Deseja aplicar a mesma alteração nos próximos?',
      options: [
        { label: 'Não, apenas este', onClick: () => {} },
        {
          label: 'Sim, atualizar próximos',
          primary: true,
          onClick: async () => {
            await refresh(applyToNext(before, after, allTxs, series, cards))
            toast('Próximos lançamentos atualizados.')
          },
        },
      ],
    })
  }

  async function del() {
    if (!editing) return onClose()
    if (inSeries) {
      onClose()
      ask({
        title: 'Excluir lançamento recorrente',
        text: 'Este lançamento faz parte de uma repetição. O que você deseja excluir?',
        options: [
          { label: 'Apenas este', onClick: async () => { await refresh(deleteEntries([editing])); toast('Lançamento excluído.') } },
          { label: 'Este e os próximos', primary: true, onClick: async () => { await refresh(deleteFromHere(editing, allTxs, series)); toast('Lançamentos excluídos.') } },
        ],
      })
      return
    }
    if (!confirm('Excluir este lançamento?')) return
    await refresh(deleteEntries([editing]))
    toast('Lançamento excluído.')
    onClose()
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const picked = Array.from(list)
    const tooBig = picked.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (tooBig) setError(`${tooBig.name} passa de ${Math.round(MAX_ATTACHMENT_BYTES / 1_000_000)} MB.`)
    setFiles((f) => [...f, ...picked.filter((p) => p.size <= MAX_ATTACHMENT_BYTES)])
  }

  const parts = repeat?.kind === 'installment' ? splitInstallments(amount, installments) : null

  return (
    <Modal title={TITLES[kind][titleIndex]} onClose={onClose} className="modal-form">
      <form className="tx-form" onSubmit={(e) => { e.preventDefault(); save(false) }}>
        {onKind && !editing && (
          <div className="segmented kind-tabs" role="tablist" aria-label="Tipo de lançamento">
            {(['expense', 'income', 'transfer'] as const).map((k) => (
              <button type="button" role="tab" aria-selected={k === kind} key={k} className={`${k} ${k === kind ? 'on' : ''}`} onClick={() => k !== kind && onKind(k)}>
                {KIND_TAB[k]}
              </button>
            ))}
          </div>
        )}
        {kind === 'transfer' ? (
          <>
            <div className="field">
              <label>Saiu da conta</label>
              <AccountSelect accounts={active} value={accountId} onChange={setAccountId} />
            </div>
            <div className="field">
              <label>Entrou na conta</label>
              <AccountSelect accounts={active} value={toAccountId} onChange={setToAccountId} />
            </div>
          </>
        ) : null}
        <div className="field">
          <label htmlFor="desc">Descrição</label>
          <input id="desc" className="input" placeholder="Adicione uma descrição para o lançamento" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus={kind !== 'transfer'} />
        </div>
        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field">
            <label>Valor</label>
            <MoneyInput value={amount} onChange={setAmount} />
          </div>
          <div className="field">
            <label htmlFor="date">Data</label>
            <input id="date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {kind !== 'transfer' && (
          <>
            {!card && <Toggle checked={paid} onChange={setPaid} label={kind === 'income' ? 'Lançamento recebido' : 'Lançamento pago'} />}
            <div className="grid-2" style={{ gap: 10 }}>
              <div className="field">
                <label>{usableCards.length ? 'Conta/Cartão' : 'Conta'}</label>
                <SourceSelect accounts={active} cards={usableCards} value={accountId} onChange={setAccountId} />
              </div>
              <div className="field">
                <label>Categoria</label>
                <CategorySelect categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} />
              </div>
            </div>
            {card && invoice && (
              <div className="invoice-banner">
                <CreditCard size={18} /> Entra na fatura de
                <Popover
                  className="invoice-pick"
                  trigger={(_, toggle) => (
                    <button type="button" onClick={toggle}>{monthLabel(toMonth(invoice)).toLowerCase()} <ChevronDown size={14} /></button>
                  )}
                >
                  {(close) => [-2, -1, 0, 1, 2, 3].map((d) => {
                    const m = shiftInvoice(invoiceFor(card, date || today()), d)
                    return (
                      <button type="button" key={d} className={`picker-item ${d === invoiceShift ? 'on' : ''}`} onClick={() => { setInvoiceShift(d); close() }}>
                        {invoiceName(m)}
                      </button>
                    )
                  })}
                </Popover>
              </div>
            )}
          </>
        )}
        <div className="option-icons">
          <button
            type="button"
            className={show.repeat ? 'on' : ''}
            onClick={() => toggle('repeat')}
            disabled={inSeries}
            title={inSeries ? 'Este lançamento já se repete' : undefined}
          >
            <span><Repeat2 size={20} /></span>Repetir
          </button>
          <button type="button" className={show.notes ? 'on' : ''} onClick={() => toggle('notes')}>
            <span><MessageSquare size={20} /></span>Observação
          </button>
          <button type="button" className={show.files ? 'on' : ''} onClick={() => toggle('files')}>
            <span><Paperclip size={20} /></span>Anexo
          </button>
          <button type="button" className={show.tags ? 'on' : ''} onClick={() => toggle('tags')}>
            <span><TagIcon size={20} /></span>Tags
          </button>
        </div>

        {show.tags && (
          <div className="form-section">
            <h4>Tags</h4>
            <TagInput value={tagIds} onChange={setTagIds} />
          </div>
        )}

        {show.notes && (
          <div className="form-section">
            <h4>Observação</h4>
            <div className="field">
              <textarea id="notes" className="input" placeholder="Adicione uma observação…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
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
            <button type="button" className="add-file" style={{ alignSelf: 'flex-start' }} onClick={() => fileInput.current?.click()}><Plus size={13} /> Adicionar anexo</button>
          </div>
        )}

        {show.repeat && !inSeries && (
          <div className="form-section repeat">
            <h4>{REPEAT_TITLE[kind]}</h4>
            <Segmented value={repeatKind} onChange={setRepeatKind} options={[['fixed', 'Fixo'], ['installment', 'Parcelado']]} />
            {repeatKind === 'fixed' ? (
              <div className="field">
                <label htmlFor="period">Período de lançamento</label>
                <select id="period" className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
                  {PERIOD_ORDER.map((p) => <option key={p} value={p}>{PERIODS[p].label}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="field">
                    <label htmlFor="parts">Parcelas</label>
                    <select id="parts" className="input" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                      {INSTALLMENT_COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="period">Período de lançamento</label>
                    <select id="period" className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
                      {PERIOD_ORDER.map((p) => <option key={p} value={p}>{PERIODS[p].unit}</option>)}
                    </select>
                  </div>
                </div>
                {parts && (
                  <div className="info-box">
                    <Info size={15} />
                    <div>
                      Serão lançadas {installments} parcelas de <b>{formatBRL(parts[parts.length - 1])}</b>
                      {parts[0] !== parts[parts.length - 1] && <> (a primeira de {formatBRL(parts[0])})</>}
                      <small>Em caso de divisão não exata, a sobra será somada à primeira parcela.</small>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="mini-btn" onClick={del} title={editing ? 'Excluir' : 'Descartar'} aria-label={editing ? 'Excluir' : 'Descartar'} disabled={busy}><Trash2 size={18} /></button>
          <div className="row" style={{ gap: 14 }}>
            {!editing && (
              <button type="button" className="btn" onClick={() => save(true)} disabled={busy}><CopyPlus size={18} /> Salvar e criar outro</button>
            )}
            <button type="submit" className="save-btn" disabled={busy} title="Salvar" aria-label="Salvar"><Check size={30} strokeWidth={2.5} /></button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
