import { ChevronRight, Eye, LogOut, SlidersHorizontal, Tag, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { UserAvatar } from '../components/Avatars'
import { Mascot } from '../components/Sidebar'
import { Toggle } from '../components/ui'
import { DEMO } from '../lib/config'
import { t } from '../lib/i18n'
import { useAccounts, useCards } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { tone } from '../lib/theme'

/** The phone's "Mais" tab: everything the desktop sidebar keeps under Ajustes. */
export default function More({ name }: { name: string }) {
  const { data: accounts = [] } = useAccounts()
  const { data: cards = [] } = useCards()
  const nAcc = accounts.filter((a) => !a.archived).length
  const nCard = cards.filter((c) => !c.archived).length
  // Same switch as the eye on Início.
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem('tally-hide-balance') === '1' } catch { return false }
  })
  const toggleHidden = (v: boolean) => {
    setHidden(v)
    try { localStorage.setItem('tally-hide-balance', v ? '1' : '0') } catch { /* ignore */ }
  }
  const s = t().settings.more
  const nav = t().common.nav
  return (
    <main className="page more">
      <header className="page-head"><h1>{nav.more}</h1></header>

      <Link to="/perfil" className="card more-profile">
        <UserAvatar size={52} fontSize={18} />
        <span style={{ flex: 1, minWidth: 0 }}><b>{name}</b><small>{nav.myProfile}</small></span>
        <ChevronRight size={20} className="muted" />
      </Link>

      <div className="more-grid">
        <Link className="toned" to="/configuracoes/contas" style={tone('var(--lavender)')}>
          <span className="bi"><Wallet size={20} /></span>
          <span><b>{nav.accountsAndCards}</b><small>{s.counts(nAcc, nCard)}</small></span>
        </Link>
        <Link className="toned" to="/configuracoes/categorias" style={tone('var(--green)')}>
          <span className="bi"><Tag size={20} /></span>
          <span><b>{nav.categories}</b><small>{s.categoriesSub}</small></span>
        </Link>
        <Link className="toned" to="/configuracoes/preferencias" style={tone('var(--blue)')}>
          <span className="bi"><SlidersHorizontal size={20} /></span>
          <span><b>{nav.preferences}</b><small>{s.preferencesSub}</small></span>
        </Link>
      </div>

      <div className="card more-list">
        <Toggle checked={hidden} onChange={toggleHidden} label={<span className="row" style={{ flex: 1, gap: 12 }}><Eye size={20} />{s.hideValues}</span>} />
        <button className="expense" onClick={() => !DEMO && supabase.auth.signOut()}><LogOut size={20} /> {nav.signOut}</button>
      </div>

      <div className="more-foot"><Mascot size={40} /><span>{s.footer}</span></div>
    </main>
  )
}
