import { CreditCard, House, List, LogOut, Plus, SlidersHorizontal, Tag, Wallet } from 'lucide-react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { DEMO } from '../lib/config'
import { t } from '../lib/i18n'
import { useCards } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { UserAvatar } from './Avatars'
import { useTxForm } from './TxFormContext'

/** The coin mascot. `plain` is the white version without the stem and cheeks, used on the yellow stat card. */
export function Mascot({ size = 44, plain }: { size?: number; plain?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="26" fill={plain ? '#FFFDF8' : '#F6D98B'} stroke="#2B2A33" strokeWidth="3" />
      {!plain && <path d="M32 8c0-4 4-6 7-5" fill="none" stroke="#2B2A33" strokeWidth="3" strokeLinecap="round" />}
      <ellipse cx="24" cy="31" rx="6" ry="7" fill="#fff" stroke="#2B2A33" strokeWidth="2.5" />
      <ellipse cx="40" cy="31" rx="6" ry="7" fill="#fff" stroke="#2B2A33" strokeWidth="2.5" />
      <circle cx="25.5" cy={plain ? 29.5 : 32.5} r="3" fill="#2B2A33" />
      <circle cx="41.5" cy={plain ? 29.5 : 32.5} r="3" fill="#2B2A33" />
      <path d="M27 43q5 5 10 0" fill="none" stroke="#2B2A33" strokeWidth="2.5" strokeLinecap="round" />
      {!plain && <circle cx="17" cy="41" r="3.5" fill="#EFB3C3" />}
      {!plain && <circle cx="47" cy="41" r="3.5" fill="#EFB3C3" />}
    </svg>
  )
}

export function Sidebar({ name }: { name: string }) {
  const { open } = useTxForm()
  const { data: cards = [] } = useCards()
  const { pathname } = useLocation()
  const firstCard = cards.find((c) => !c.archived)
  const s = t().common.nav
  return (
    <aside className="side">
      <Link to="/" className="brand"><Mascot /><span>tally</span></Link>
      <button className="btn btn-primary" onClick={() => open({ kind: 'expense' })}><Plus size={20} /> {s.newEntry}</button>
      <nav aria-label={s.main}>
        <NavLink to="/" end><House size={20} /> {s.overview}</NavLink>
        <NavLink to="/lancamentos"><List size={20} /> {s.entries}</NavLink>
        <NavLink
          to={firstCard ? `/cartoes/${firstCard.id}` : '/configuracoes/contas#cartoes'}
          className={() => (pathname.startsWith('/cartoes/') ? 'active' : '')}
        >
          <CreditCard size={20} /> {s.invoices}
        </NavLink>
        <div className="lbl">{s.settings}</div>
        <NavLink to="/configuracoes/contas" className={() => (pathname.startsWith('/configuracoes/contas') || pathname.startsWith('/configuracoes/cartoes') ? 'active' : '')}>
          <Wallet size={20} /> {s.accountsAndCards}
        </NavLink>
        <NavLink to="/configuracoes/categorias"><Tag size={20} /> {s.categories}</NavLink>
        <NavLink to="/configuracoes/preferencias"><SlidersHorizontal size={20} /> {s.preferences}</NavLink>
      </nav>
      <div className="profile">
        <Link to="/perfil">
          <UserAvatar size={40} />
          <span style={{ minWidth: 0 }}><b>{name}</b><small>{s.myProfile}</small></span>
        </Link>
        <button className="icon-btn sm" aria-label={s.signOut} title={s.signOut} onClick={() => !DEMO && supabase.auth.signOut()}><LogOut size={16} /></button>
      </div>
    </aside>
  )
}
