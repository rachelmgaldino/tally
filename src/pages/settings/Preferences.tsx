import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../../components/Toast'
import { Modal, Segmented, Toggle } from '../../components/ui'
import { seriesTable, transactionsTable } from '../../lib/api'
import { removeAttachments } from '../../lib/attachments'
import { DEMO } from '../../lib/config'
import type { PeriodKind } from '../../lib/periods'
import { usePrefs, type Prefs } from '../../lib/prefs'
import { supabase } from '../../lib/supabase'

export default function Preferences() {
  const { prefs, setPrefs } = usePrefs()
  const toast = useToast()
  const [danger, setDanger] = useState<'reset' | 'delete' | null>(null)

  async function change(patch: Partial<Prefs>) {
    try {
      await setPrefs(patch)
      toast('Preferência salva.')
    } catch (e) {
      toast(`Não foi possível salvar: ${(e as Error).message}`)
    }
  }

  return (
    <>
      <header className="page-head"><h1>Preferências</h1></header>
      <section className="card card-pad prefs" style={{ maxWidth: 860 }}>
        <h3 className="section-h">Lançamentos</h3>
        <div className="pref-row">
          <div><b>Ordem da lista</b><small>Qual dia aparece primeiro</small></div>
          <Segmented value={prefs.order} onChange={(order) => change({ order })} options={[['desc', 'Mais recentes'], ['asc', 'Mais antigos']]} />
        </div>
        <div className="pref-row">
          <div><b>Período padrão</b><small>Quanto tempo a lista mostra de uma vez</small></div>
          <Segmented<PeriodKind> value={prefs.period} onChange={(period) => change({ period })} options={[['day', 'Diário'], ['week', 'Semanal'], ['month', 'Mensal']]} />
        </div>
        <div className="pref-row">
          <div><b>Saldo no fim de cada dia</b><small>Mostra quanto sobrou depois de cada dia da lista</small></div>
          <Toggle checked={prefs.dailyBalance} onChange={(dailyBalance) => change({ dailyBalance })} label={<span className="sr-only">Saldo no fim de cada dia</span>} />
        </div>
      </section>

      <section className="card card-pad prefs" style={{ maxWidth: 860, background: '#fbe8ec' }}>
        <h3 className="section-h">Zona de cuidado</h3>
        <div className="pref-row">
          <div><b>Começar do zero</b><small>Apaga todos os lançamentos. Contas, cartões, categorias e tags continuam.</small></div>
          <button className="btn" onClick={() => setDanger('reset')}>Começar do zero</button>
        </div>
        <div className="pref-row">
          <div><b>Excluir minha conta</b><small>Remove tudo, pra sempre, e encerra o seu acesso.</small></div>
          <button className="btn btn-pink" onClick={() => setDanger('delete')}>Excluir conta</button>
        </div>
      </section>
      {danger && <DangerModal kind={danger} onClose={() => setDanger(null)} />}
    </>
  )
}

const DANGER = {
  reset: {
    title: 'Começar do zero',
    text: 'Todos os lançamentos, repetições e anexos serão apagados. Suas contas, cartões, categorias e tags continuam. Isso não pode ser desfeito.',
    word: 'APAGAR',
    button: 'Apagar lançamentos',
  },
  delete: {
    title: 'Excluir minha conta',
    text: 'Sua conta e todos os dados (lançamentos, contas, cartões, categorias, tags e anexos) serão apagados para sempre, e você sai do Tally. Isso não pode ser desfeito.',
    word: 'EXCLUIR',
    button: 'Excluir para sempre',
  },
}

function DangerModal({ kind, onClose }: { kind: 'reset' | 'delete'; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const d = DANGER[kind]

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const txs = await transactionsTable.list()
      const files = txs.flatMap((t) => t.attachments)
      if (kind === 'reset') {
        await transactionsTable.removeMany(txs.map((t) => t.id))
        const series = await seriesTable.list()
        await seriesTable.removeMany(series.map((s) => s.id))
        await removeAttachments(files).catch(() => {})
        await qc.invalidateQueries()
        toast('Pronto, seus lançamentos foram apagados.')
        onClose()
      } else {
        if (DEMO) throw new Error('Não dá para excluir a conta no modo de demonstração.')
        await removeAttachments(files).catch(() => {})
        const { error } = await supabase.rpc('delete_account')
        if (error) throw error
        await supabase.auth.signOut()
      }
    } catch (e) {
      setError((e as Error).message)
      setBusy(false)
    }
  }

  return (
    <Modal title={d.title} onClose={onClose}>
      <div className="stack">
        <p style={{ margin: 0 }}>{d.text}</p>
        <div className="field">
          <label htmlFor="danger-word">Para confirmar, digite {d.word}</label>
          <input id="danger-word" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
        </div>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-pink" disabled={typed.trim().toUpperCase() !== d.word || busy} onClick={run}>{busy ? 'Apagando…' : d.button}</button>
      </div>
    </Modal>
  )
}
