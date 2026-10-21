import { AlignLeft, ArrowRight, Calendar, Check, ChevronDown, ChevronRight, CircleCheck, CopyPlus, CreditCard, Info, MessageSquare, Paperclip, Plus, Repeat2, Tag as TagIcon, Trash2, Wallet, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { formatSize, MAX_ATTACHMENT_BYTES } from '../lib/attachments'
import { invoiceFor, invoiceName, monthsBetween, shiftInvoice, toMonth } from '../lib/cards'
import { dayMonth, monthTitle, today } from '../lib/dates'
import { t } from '../lib/i18n'
import { applyToNext, convertEntry, createEntry, deleteEntries, deleteFromHere, updateEntry, useRefresh, type RepeatOptions } from '../lib/entries'
import { centsFromTyping, currencyOf, formatMoney, formatCents, symbol } from '../lib/money'
import { byId, useAccounts, useCards, useCategories, useSeries, useTransactions } from '../lib/queries'
import { PERIOD_ORDER, PERIODS, seriesChanges, splitInstallments } from '../lib/series'
import type { Attachment, NewTransaction, Period, SeriesKind, Transaction, TxKind } from '../lib/types'
import { AccountAvatar, AccountIcon, CategoryAvatar } from './Avatars'
import { Popover } from './Picker'
import { AccountSelect, CategorySelect, SourceSelect } from './Selects'
import { TagInput } from './TagInput'
import { useToast } from './Toast'
import { useConfirm } from './Confirm'
import { useTxForm } from './TxFormContext'
import { caretToEnd, Modal, MoneyInput, Segmented, Toggle } from './ui'
import { tone } from '../lib/theme'

export type FormKind = Exclude<TxKind, 'payment'>

/** The invoices offered in "Entra na fatura de": two before the date's own, up to two years after. */
const INVOICE_SHIFTS = Array.from({ length: 27 }, (_, i) => i - 2)

function yesterday(): string {
  const d = new Date(`${today()}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
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
  const s = t().form
  const common = t().common
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { data: allTxs = [] } = useTransactions()
  const { data: cards = [] } = useCards()
  const seriesMap = byId(useSeries().data)
  const { ask } = useTxForm()
  const refresh = useRefresh()
  const toast = useToast()
  const confirmDelete = useConfirm()
  const active = accounts.filter((a) => !a.archived)
  const source = editing ?? copyOf
  const inSeries = !!editing?.series_id
  const series = editing?.series_id ? seriesMap.get(editing.series_id) : undefined

  const [description, setDescription] = useState(source?.description ?? (kind === 'transfer' ? common.kinds.transfer : ''))
  const [amount, setAmount] = useState(source?.amount_cents ?? 0)
  const [toAmount, setToAmount] = useState(source?.to_amount_cents ?? 0)
  const [date, setDate] = useState(editing?.date ?? today())
  const [paid, setPaid] = useState(editing?.paid ?? true)
  // A new entry counts as paid when it's dated today or earlier, until Rachel flips the switch herself.
  const [paidTouched, setPaidTouched] = useState(!!editing)
  function changeDate(d: string) {
    setDate(d)
    if (!paidTouched && d) setPaid(d <= today())
  }
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
  const fromAccount = active.find((a) => a.id === accountId)
  const toAccount = kind === 'transfer' ? active.find((a) => a.id === toAccountId) : undefined
  // The amount is in the currency of the account or card it comes from.
  const currency = currencyOf(card ?? fromAccount)
  const toCurrency = currencyOf(toAccount)
  // Between currencies a transfer keeps both sides: what left and what actually landed.
  const crossing = !!fromAccount && !!toAccount && currency !== toCurrency
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
  const formRef = useRef<HTMLFormElement>(null)
  const toggle = (k: keyof typeof show) => {
    const opening = !show[k]
    setShow((v) => ({ ...v, [k]: !v[k] }))
    // On short screens the section opens below the fold; bring it into view.
    if (opening) requestAnimationFrame(() => formRef.current?.querySelector(`[data-section="${k}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  function validate(): NewTransaction | null {
    if (amount <= 0) return fail(s.enterAmount)
    if (!date) return fail(s.enterDate)
    if (!accountId) return fail(kind === 'transfer' ? s.pickFromAccount : s.pickAccount)
    if (kind === 'transfer') {
      if (!toAccountId) return fail(s.pickToAccount)
      if (toAccountId === accountId) return fail(s.pickTwoAccounts)
      if (crossing && toAmount <= 0) return fail(s.enterLanded)
    }
    if (repeat?.kind === 'installment' && amount < installments) return fail(s.tooManyInstallments)
    return {
      kind,
      description: description.trim(),
      amount_cents: amount,
      date,
      paid: card ? true : paid,
      account_id: card ? null : accountId,
      to_account_id: kind === 'transfer' ? toAccountId : null,
      to_amount_cents: crossing ? toAmount : null,
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
      toast(editing ? s.entryUpdated : repeat ? s.entriesSaved : s.entrySaved)
      if (again) {
        setDescription(kind === 'transfer' ? common.kinds.transfer : '')
        setAmount(0)
        setToAmount(0)
        setNotes('')
        setFiles([])
        setShow((v) => ({ ...v, repeat: false, notes: false, files: false }))
      } else {
        onClose()
      }
    } catch (e) {
      setError(s.couldNotSave((e as Error).message))
    } finally {
      setBusy(false)
    }
  }

  /** After editing one entry of a series, Organizze asks whether the later ones change too. */
  function offerApplyToNext(before: Transaction, after: Transaction) {
    const { patch, dayShift } = seriesChanges(before, after)
    const hasLater = allTxs.some((x) => x.series_id === after.series_id && (x.series_index ?? 0) > (after.series_index ?? 0))
    // Card instalments can also move to another invoice, which the later ones follow.
    const invoiceMoved = series?.kind === 'installment' && before.card_id === after.card_id && before.invoice_month !== after.invoice_month
    if (!hasLater || (Object.keys(patch).length === 0 && dayShift === 0 && !invoiceMoved)) return
    ask({
      title: s.changeSaved,
      text: s.applyToNextText,
      options: [
        { label: s.onlyThisNo, onClick: () => {} },
        {
          label: s.updateNext,
          primary: true,
          onClick: async () => {
            await refresh(applyToNext(before, after, allTxs, series, cards))
            toast(s.nextUpdated)
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
        title: s.deleteRecurringTitle,
        text: s.deleteRecurringText,
        options: [
          { label: s.onlyThis, onClick: async () => { await refresh(deleteEntries([editing])); toast(s.entryDeleted) } },
          { label: s.thisAndNext, primary: true, onClick: async () => { await refresh(deleteFromHere(editing, allTxs, series)); toast(s.entriesDeleted) } },
        ],
      })
      return
    }
    if (!(await confirmDelete({ title: s.deleteTitle, text: s.deleteText }))) return
    onClose()
    await refresh(deleteEntries([editing]))
    toast(s.entryDeleted)
  }

  function addFiles(list: FileList | null) {
    if (!list) return
    const picked = Array.from(list)
    const tooBig = picked.find((f) => f.size > MAX_ATTACHMENT_BYTES)
    if (tooBig) setError(s.fileTooBig(tooBig.name, Math.round(MAX_ATTACHMENT_BYTES / 1_000_000)))
    setFiles((f) => [...f, ...picked.filter((p) => p.size <= MAX_ATTACHMENT_BYTES)])
  }

  // Phone rows show the picked account and category as their icon.
  const srcAccount = active.find((a) => a.id === accountId)
  const pickedCategory = categories.find((c) => c.id === categoryId)
  const pickedParent = pickedCategory?.parent_id ? categories.find((c) => c.id === pickedCategory.parent_id) : undefined

  const parts = repeat?.kind === 'installment' ? splitInstallments(amount, installments) : null

  return (
    <Modal
      title={<><span className="desk-only">{s.titles[kind][titleIndex]}</span><span className="phone-only">{editing ? s.editEntry : s.newEntry}</span></>}
      onClose={onClose}
      className="modal-form"
    >
      <form ref={formRef} className="tx-form" onSubmit={(e) => { e.preventDefault(); save(false) }}>
        {onKind && !editing && (
          <div className="segmented kind-tabs" role="tablist" aria-label={s.kindTabs}>
            {(['expense', 'income', 'transfer'] as const).map((k) => (
              <button type="button" role="tab" aria-selected={k === kind} key={k} className={`${k} ${k === kind ? 'on' : ''}`} onClick={() => k !== kind && onKind(k)}>
                {common.kinds[k]}
              </button>
            ))}
          </div>
        )}
        {!crossing && <div className={`ph-amount ${kind}`}>
          <label htmlFor="ph-amount">{s.amount}</label>
          <div className="row">
            <span className="prefix">{symbol(currency)}</span>
            <input id="ph-amount" inputMode="numeric" value={formatCents(amount)} style={{ width: `${formatCents(amount).length * 0.62 + 0.2}em` }} autoFocus={!editing}
              onChange={(e) => setAmount(centsFromTyping(e.target.value))} onFocus={caretToEnd} />
          </div>
        </div>}
        <div className="form-group">
        {kind === 'transfer' ? (
          <>
            <div className="field">
              <label>{s.fromAccount}</label>
              <AccountSelect accounts={active} value={accountId} onChange={setAccountId} />
            </div>
            <div className="field">
              <label>{s.toAccount}</label>
              <AccountSelect accounts={active} value={toAccountId} onChange={setToAccountId} />
            </div>
            {crossing && (
              <div className="fx-box toned" style={tone('var(--blue)')}>
                <div className="fx-row">
                  <div className="field">
                    <label htmlFor="fx-from">{s.leftFrom(fromAccount.name)}</label>
                    <MoneyInput id="fx-from" value={amount} onChange={setAmount} prefix={symbol(currency)} />
                  </div>
                  <span className="fx-arrow" aria-hidden="true"><ArrowRight size={18} /></span>
                  <div className="field">
                    <label htmlFor="fx-to">{s.landedIn(toAccount.name)}</label>
                    <MoneyInput id="fx-to" value={toAmount} onChange={setToAmount} prefix={symbol(toCurrency)} />
                  </div>
                </div>
                {amount > 0 && toAmount > 0 && (
                  <p className="fx-rate"><Info size={14} /><span>{s.ratePaid} <b>{symbol(toCurrency)} 1 = {formatMoney(Math.round((amount / toAmount) * 100), currency)}</b></span></p>
                )}
              </div>
            )}
          </>
        ) : null}
        <div className="field f-desc">
          <span className="f-ico phone-only"><AlignLeft size={20} /></span>
          <label htmlFor="desc">{s.description}</label>
          <input id="desc" className="input" placeholder={s.descriptionPlaceholder} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid-2" style={{ gap: 10 }}>
          <div className="field f-date">
            <span className="f-ico phone-only"><Calendar size={20} /></span>
            <label htmlFor="date">{s.date}</label>
            <div className="f-date-in">
              {[[today(), common.today], [yesterday(), s.yesterday]].map(([d, l]) => (
                <button type="button" key={l} className={`day-chip ${date === d ? 'on' : ''}`} onClick={() => changeDate(d)}>{l}</button>
              ))}
              {/* On the phone the native input sits invisibly over a round chip that shows the picked day. */}
              <span className={`date-pick ${date !== today() && date !== yesterday() ? 'on' : ''}`}>
                <span className="date-face phone-only" aria-hidden="true">{date !== today() && date !== yesterday() ? dayMonth(date) : '···'}</span>
                <input id="date" className="input" type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
              </span>
            </div>
          </div>
        </div>
        {!card && <div className="f-paid"><Toggle checked={paid} onChange={(v) => { setPaid(v); setPaidTouched(true) }} label={
          <span className="paid-label">
            <CircleCheck size={20} className="phone-only" />
            <span className="desk-only">{kind === 'income' ? s.receivedDesk : kind === 'transfer' ? s.doneDesk : s.paidDesk}</span>
            <span className="phone-only">{kind === 'income' ? s.receivedPhone : kind === 'transfer' ? s.donePhone : s.paidPhone}</span>
          </span>
        } /></div>}
        {kind !== 'transfer' && (
          <>
            <div className="grid-2" style={{ gap: 10 }}>
              <div className="field f-src">
                <span className="f-ico phone-only">
                  {card ? <AccountIcon icon={card.icon} color={card.color} size={40} square />
                    : srcAccount ? <AccountAvatar account={srcAccount} size={40} />
                    : <Wallet size={20} />}
                </span>
                <label><span className="desk-only">{usableCards.length ? s.accountOrCardDesk : s.account}</span><span className="phone-only">{usableCards.length ? s.accountOrCardPhone : s.account}</span></label>
                <SourceSelect accounts={active} cards={usableCards} value={accountId} onChange={setAccountId} />
                <ChevronRight size={18} className="f-chev phone-only" />
              </div>
              <div className="field f-cat">
                <span className="f-ico phone-only">
                  {pickedCategory ? <CategoryAvatar category={pickedParent ?? pickedCategory} size={40} /> : <TagIcon size={20} />}
                </span>
                <label>{s.category}</label>
                <CategorySelect categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} />
                <ChevronRight size={18} className="f-chev phone-only" />
              </div>
            </div>
            {card && invoice && (
              <div className="invoice-banner">
                <CreditCard size={18} /> <span className="inv-label">{s.goesToInvoice}</span>
                <Popover
                  className="invoice-pick"
                  trigger={(_, toggle) => (
                    <button type="button" onClick={toggle}>
                      <span>{monthTitle(toMonth(invoice))}</span>
                      <ChevronDown size={14} className="desk-only" /><ChevronRight size={18} className="phone-only" />
                    </button>
                  )}
                >
                  {/* Old purchases still being paid can land in an invoice months after their date. */}
                  {(close) => INVOICE_SHIFTS.map((d) => {
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
        </div>
        <div className="ph-more phone-only">
          <button type="button" onClick={() => toggle('repeat')} disabled={inSeries} aria-expanded={show.repeat}>
            <Repeat2 size={20} />
            <span><small>{s.repeat}</small>{inSeries ? s.alreadyRepeats : !show.repeat ? s.noRepeat : repeatKind === 'fixed' ? s.fixedSummary(PERIODS[period].adjective) : s.installmentSummary(installments)}</span>
            <ChevronRight size={18} className={show.repeat ? 'turned' : ''} />
          </button>
          <button type="button" onClick={() => {
            const open = !(show.tags || show.notes || show.files)
            setShow((v) => ({ ...v, tags: open, notes: open, files: open }))
          }} aria-expanded={show.tags || show.notes || show.files}>
            <Plus size={20} />
            <span><small>{s.moreDetails}</small>{s.moreDetailsHint}</span>
            <ChevronDown size={18} className={show.tags || show.notes || show.files ? 'flipped' : ''} />
          </button>
        </div>
        <div className="option-icons desk-only">
          <button
            type="button"
            className={show.repeat ? 'on' : ''}
            onClick={() => toggle('repeat')}
            disabled={inSeries}
            title={inSeries ? s.entryAlreadyRepeats : undefined}
          >
            <span><Repeat2 size={20} /></span>{s.repeat}
          </button>
          <button type="button" className={show.notes ? 'on' : ''} onClick={() => toggle('notes')}>
            <span><MessageSquare size={20} /></span>{s.note}
          </button>
          <button type="button" className={show.files ? 'on' : ''} onClick={() => toggle('files')}>
            <span><Paperclip size={20} /></span>{s.attachment}
          </button>
          <button type="button" className={show.tags ? 'on' : ''} onClick={() => toggle('tags')}>
            <span><TagIcon size={20} /></span>{s.tags}
          </button>
        </div>

        {show.tags && (
          <div className="form-section" data-section="tags">
            <h4>{s.tags}</h4>
            <TagInput value={tagIds} onChange={setTagIds} />
          </div>
        )}

        {show.notes && (
          <div className="form-section" data-section="notes">
            <h4>{s.note}</h4>
            <div className="field">
              <textarea id="notes" className="input" placeholder={s.notePlaceholder} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        )}

        {show.files && (
          <div className="form-section" data-section="files">
            <h4>{s.attachments}</h4>
            {kept.map((a) => (
              <div key={a.path} className="file-line">
                <Paperclip size={13} /> <span>{a.name}</span> <small>{formatSize(a.size)}</small>
                <button type="button" onClick={() => setKept((k) => k.filter((x) => x !== a))} aria-label={s.remove(a.name)}><X size={13} /></button>
              </div>
            ))}
            {files.map((f, i) => (
              <div key={`${f.name}-${i}`} className="file-line">
                <Paperclip size={13} /> <span>{f.name}</span> <small>{formatSize(f.size)}</small>
                <button type="button" onClick={() => setFiles((list) => list.filter((x) => x !== f))} aria-label={s.remove(f.name)}><X size={13} /></button>
              </div>
            ))}
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
            <button type="button" className="add-file" style={{ alignSelf: 'flex-start' }} onClick={() => fileInput.current?.click()}><Plus size={13} /> {s.addAttachment}</button>
          </div>
        )}

        {show.repeat && !inSeries && (
          <div className="form-section repeat" data-section="repeat">
            <h4>{s.repeatTitle[kind]}</h4>
            <Segmented value={repeatKind} onChange={setRepeatKind} options={[['fixed', s.fixed], ['installment', s.installment]]} />
            {repeatKind === 'fixed' ? (
              <div className="field">
                <label htmlFor="period">{s.period}</label>
                <select id="period" className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
                  {PERIOD_ORDER.map((p) => <option key={p} value={p}>{PERIODS[p].label}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div className="grid-2" style={{ gap: 10 }}>
                  <div className="field">
                    <label htmlFor="parts">{s.installments}</label>
                    <select id="parts" className="input" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                      {INSTALLMENT_COUNTS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="period">{s.period}</label>
                    <select id="period" className="input" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
                      {PERIOD_ORDER.map((p) => <option key={p} value={p}>{PERIODS[p].unit}</option>)}
                    </select>
                  </div>
                </div>
                {parts && (
                  <div className="info-box">
                    <Info size={15} />
                    <div>
                      {s.installmentsInfo(installments)}<b>{formatMoney(parts[parts.length - 1], currency)}</b>
                      {parts[0] !== parts[parts.length - 1] && <>{s.firstInstallment(formatMoney(parts[0], currency))}</>}
                      <small>{s.installmentsRemainder}</small>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {error && <div className="error">{error}</div>}
        <div className={`form-actions ${editing ? 'editing' : ''}`}>
          {editing
            ? <button type="button" className="mini-btn" onClick={del} title={common.delete} aria-label={common.delete} disabled={busy}><Trash2 size={18} /></button>
            : <button type="button" className="btn cancel-btn desk-only" onClick={onClose} disabled={busy}>{common.cancel}</button>}
          <div className="row" style={{ gap: 14 }}>
            {!editing && (
              <button type="button" className="btn save-again" onClick={() => save(true)} disabled={busy}><CopyPlus size={18} className="desk-only" /> <span className="desk-only">{s.saveAndNewDesk}</span><span className="phone-only">{s.saveAndNewPhone}</span></button>
            )}
            <button type="submit" className="save-btn" disabled={busy} title={common.save} aria-label={common.save}><Check size={30} strokeWidth={2.5} className="desk-only" /><span className="phone-only">{common.save}</span></button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
