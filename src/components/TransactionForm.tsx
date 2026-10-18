import { Check, CopyPlus, MessageSquare, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { today } from '../lib/dates'
import { useAccounts, useCategories, useTransactionMutations } from '../lib/queries'
import type { NewTransaction, Transaction, TxKind } from '../lib/types'
import { AccountSelect, CategorySelect } from './Selects'
import { useToast } from './Toast'
import { Modal, MoneyInput, Toggle } from './ui'

const TITLES: Record<TxKind, [string, string]> = {
  expense: ['Nova despesa', 'Editar despesa'],
  income: ['Nova receita', 'Editar receita'],
  transfer: ['Transferência entre contas', 'Editar transferência'],
}

export function TransactionForm({
  kind, editing, copyOf, defaultAccountId, onClose,
}: {
  kind: TxKind
  editing?: Transaction
  copyOf?: Transaction
  defaultAccountId?: string
  onClose: () => void
}) {
  const { data: accounts = [] } = useAccounts()
  const { data: categories = [] } = useCategories()
  const { insert, update, remove } = useTransactionMutations()
  const toast = useToast()
  const active = accounts.filter((a) => !a.archived)
  const source = editing ?? copyOf

  const [description, setDescription] = useState(source?.description ?? (kind === 'transfer' ? 'Transferência' : ''))
  const [amount, setAmount] = useState(source?.amount_cents ?? 0)
  const [date, setDate] = useState(editing?.date ?? today())
  const [paid, setPaid] = useState(editing?.paid ?? true)
  const [accountId, setAccountId] = useState<string | null>(source?.account_id ?? defaultAccountId ?? active[0]?.id ?? null)
  const [toAccountId, setToAccountId] = useState<string | null>(source?.to_account_id ?? null)
  const [categoryId, setCategoryId] = useState<string | null>(source?.category_id ?? null)
  const [notes, setNotes] = useState(source?.notes ?? '')
  const [showNotes, setShowNotes] = useState(!!source?.notes)
  const [error, setError] = useState<string | null>(null)

  const busy = insert.isPending || update.isPending || remove.isPending
  const titleIndex = editing ? 1 : 0

  function validate(): NewTransaction | null {
    if (amount <= 0) return fail('Informe um valor.')
    if (!date) return fail('Informe a data.')
    if (!accountId) return fail(kind === 'transfer' ? 'Escolha de qual conta saiu.' : 'Escolha a conta.')
    if (kind === 'transfer') {
      if (!toAccountId) return fail('Escolha em qual conta entrou.')
      if (toAccountId === accountId) return fail('Escolha duas contas diferentes.')
    }
    return {
      kind,
      description: description.trim(),
      amount_cents: amount,
      date,
      paid: kind === 'transfer' ? true : paid,
      account_id: accountId,
      to_account_id: kind === 'transfer' ? toAccountId : null,
      category_id: kind === 'transfer' ? null : categoryId,
      notes: notes.trim() || null,
    }
  }

  function fail(msg: string): null {
    setError(msg)
    return null
  }

  async function save(again: boolean) {
    const row = validate()
    if (!row) return
    setError(null)
    try {
      if (editing) await update.mutateAsync({ id: editing.id, patch: row })
      else await insert.mutateAsync([row])
      toast(editing ? 'Lançamento atualizado.' : 'Lançamento salvo.')
      if (again) {
        setDescription(kind === 'transfer' ? 'Transferência' : '')
        setAmount(0)
        setNotes('')
        setShowNotes(false)
      } else {
        onClose()
      }
    } catch (e) {
      setError(`Não foi possível salvar: ${(e as Error).message}`)
    }
  }

  async function del() {
    if (!editing) return onClose()
    if (!confirm('Excluir este lançamento?')) return
    await remove.mutateAsync(editing.id)
    toast('Lançamento excluído.')
    onClose()
  }

  return (
    <Modal title={TITLES[kind][titleIndex]} onClose={onClose}>
      <form className="tx-form" onSubmit={(e) => { e.preventDefault(); save(false) }}>
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
            <Toggle checked={paid} onChange={setPaid} label={kind === 'income' ? 'Lançamento recebido' : 'Lançamento pago'} />
            <div className="grid-2" style={{ gap: 10 }}>
              <div className="field">
                <label>Conta</label>
                <AccountSelect accounts={active} value={accountId} onChange={setAccountId} />
              </div>
              <div className="field">
                <label>Categoria</label>
                <CategorySelect categories={categories} kind={kind} value={categoryId} onChange={setCategoryId} />
              </div>
            </div>
          </>
        )}
        <div className="option-icons">
          <button type="button" className={showNotes ? 'on' : ''} onClick={() => setShowNotes((s) => !s)} title="Adicionar comentário">
            <MessageSquare size={16} />
          </button>
        </div>
        {showNotes && (
          <div className="field">
            <label htmlFor="notes">Observação</label>
            <textarea id="notes" className="input" placeholder="Adicione uma observação…" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        )}
        {error && <div className="error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="mini-btn" onClick={del} title={editing ? 'Excluir' : 'Descartar'} disabled={busy}><Trash2 size={15} /></button>
          <button type="submit" className="save-btn" disabled={busy} title="Salvar"><Check size={24} /></button>
          {editing ? <span style={{ width: 32 }} /> : (
            <button type="button" className="mini-btn" onClick={() => save(true)} disabled={busy} title="Salvar e criar outro"><CopyPlus size={15} /></button>
          )}
        </div>
      </form>
    </Modal>
  )
}
