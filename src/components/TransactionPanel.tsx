import { Copy, Pencil, ThumbsUp, Trash2, Undo2, X } from 'lucide-react'
import { longDate } from '../lib/dates'
import { formatBRL } from '../lib/money'
import { byId, useAccounts, useCategories, useTransactionMutations } from '../lib/queries'
import type { Transaction } from '../lib/types'
import { AccountAvatar, CategoryAvatar } from './Avatars'
import { useToast } from './Toast'
import { useTxForm } from './TxFormContext'

const KIND_LABEL = { expense: 'Despesa', income: 'Receita', transfer: 'Transferência' }

export function TransactionPanel({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const accounts = byId(useAccounts().data)
  const categories = byId(useCategories().data)
  const { update, remove } = useTransactionMutations()
  const { open } = useTxForm()
  const toast = useToast()
  const category = tx.category_id ? categories.get(tx.category_id) : undefined
  const parent = category?.parent_id ? categories.get(category.parent_id) : undefined
  const account = accounts.get(tx.account_id)
  const to = tx.to_account_id ? accounts.get(tx.to_account_id) : undefined

  async function togglePaid() {
    await update.mutateAsync({ id: tx.id, patch: { paid: !tx.paid } })
    toast(tx.paid ? 'Marcado como pendente.' : 'Marcado como pago.')
  }

  async function del() {
    if (!confirm('Excluir este lançamento?')) return
    await remove.mutateAsync(tx.id)
    toast('Lançamento excluído.')
    onClose()
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" aria-label="Detalhes do lançamento">
        <button className="modal-close" onClick={onClose} aria-label="Fechar"><X size={16} /></button>
        <span className="badge">{KIND_LABEL[tx.kind]}</span>
        <h2 style={{ fontSize: 15, margin: '8px 0 14px' }}>{tx.description || KIND_LABEL[tx.kind]}</h2>

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
        <div className="detail"><div className="k">Observação</div>{tx.notes || '--'}</div>

        <div className="drawer-actions">
          <button onClick={() => open({ kind: tx.kind, editing: tx })}><span className="circle"><Pencil size={14} /></span>Editar</button>
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
