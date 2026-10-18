import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useToast } from '../../components/Toast'
import { Modal, Segmented, Toggle } from '../../components/ui'
import { seriesTable, transactionsTable } from '../../lib/api'
import { removeAttachments } from '../../lib/attachments'
import { DEMO } from '../../lib/config'
import { LANGUAGES, t, type Language } from '../../lib/i18n'
import type { PeriodKind } from '../../lib/periods'
import { usePrefs, type Prefs } from '../../lib/prefs'
import { supabase } from '../../lib/supabase'
import { getTheme, setTheme, tone, type Theme } from '../../lib/theme'

export default function Preferences() {
  const { prefs, setPrefs } = usePrefs()
  const toast = useToast()
  const [danger, setDanger] = useState<'reset' | 'delete' | null>(null)
  const [theme, setThemeState] = useState<Theme>(getTheme)
  const s = t().prefs

  async function change(patch: Partial<Prefs>) {
    try {
      await setPrefs(patch)
      toast(s.saved)
    } catch (e) {
      toast(s.saveFailed((e as Error).message))
    }
  }

  return (
    <>
      <header className="page-head"><h1>{s.title}</h1></header>
      <section className="card card-pad prefs">
        {/* In both languages, so it can be found whichever one is showing. */}
        <h3 className="section-h">Idioma · Language</h3>
        <div className="pref-row">
          <div><b>{s.appLanguage}</b><small>{s.languageNote}</small></div>
          <Segmented<Language> value={prefs.language} onChange={(language) => change({ language })} options={LANGUAGES.map((l): [Language, string] => [l.id, l.name])} />
        </div>
      </section>

      <section className="card card-pad prefs">
        <h3 className="section-h">{s.entries}</h3>
        <div className="pref-row">
          <div><b>{s.order}</b><small>{s.orderNote}</small></div>
          <Segmented value={prefs.order} onChange={(order) => change({ order })} options={[['desc', s.newest], ['asc', s.oldest]]} />
        </div>
        <div className="pref-row">
          <div><b>{s.period}</b><small>{s.periodNote}</small></div>
          <Segmented<PeriodKind> value={prefs.period} onChange={(period) => change({ period })} options={[['day', s.daily], ['week', s.weekly], ['month', s.monthly]]} />
        </div>
        <div className="pref-row">
          <div><b>{s.dailyBalance}</b><small>{s.dailyBalanceNote}</small></div>
          <Toggle checked={prefs.dailyBalance} onChange={(dailyBalance) => change({ dailyBalance })} label={<span className="sr-only">{s.dailyBalance}</span>} />
        </div>
      </section>

      <section className="card card-pad prefs">
        <h3 className="section-h">{s.appearance}</h3>
        <div className="pref-row">
          <div><b>{s.theme}</b><small>{s.themeNote}</small></div>
          <Segmented<Theme> value={theme} onChange={(t) => { setTheme(t); setThemeState(t) }} options={[['light', s.light], ['dark', s.dark], ['auto', s.auto]]} />
        </div>
      </section>

      <section className="card card-pad prefs toned" style={tone('#fbe8ec')}>
        <h3 className="section-h">{s.danger}</h3>
        <div className="pref-row">
          <div><b>{s.reset}</b><small>{s.resetNote}</small></div>
          <button className="btn" onClick={() => setDanger('reset')}>{s.reset}</button>
        </div>
        <div className="pref-row">
          <div><b>{s.deleteAccount}</b><small>{s.deleteAccountNote}</small></div>
          <button className="btn btn-pink" onClick={() => setDanger('delete')}>{s.deleteAccountButton}</button>
        </div>
      </section>
      {danger && <DangerModal kind={danger} onClose={() => setDanger(null)} />}
    </>
  )
}

const danger = () => {
  const s = t().prefs
  return {
    reset: { title: s.reset, text: s.resetText, word: s.resetWord, button: s.resetButton },
    delete: { title: s.deleteAccount, text: s.deleteText, word: s.deleteWord, button: s.deleteButton },
  }
}

function DangerModal({ kind, onClose }: { kind: 'reset' | 'delete'; onClose: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const d = danger()[kind]
  const s = t().prefs

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
        toast(s.resetDone)
        onClose()
      } else {
        if (DEMO) throw new Error(s.noDeleteInDemo)
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
          <label htmlFor="danger-word">{s.typeToConfirm(d.word)}</label>
          <input id="danger-word" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
        </div>
        {error && <div className="error">{error}</div>}
      </div>
      <div className="modal-foot">
        <button className="btn" onClick={onClose} disabled={busy}>{t().common.cancel}</button>
        <button className="btn btn-pink" disabled={typed.trim().toUpperCase() !== d.word || busy} onClick={run}>{busy ? s.deleting : d.button}</button>
      </div>
    </Modal>
  )
}
