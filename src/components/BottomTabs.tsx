import { CreditCard, Ellipsis, House, List, Plus } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { t } from '../lib/i18n'
import { useCards } from '../lib/queries'
import { useTxForm } from './TxFormContext'

/** The phone's bottom bar. It takes the sidebar's place below 760px (see styles.css). */
export function BottomTabs() {
  const { open } = useTxForm()
  const { data: cards = [] } = useCards()
  const { pathname } = useLocation()
  const firstCard = cards.find((c) => !c.archived)
  const s = t().common.nav
  const inMore = pathname === '/mais' || pathname.startsWith('/configuracoes') || pathname === '/perfil'
  return (
    <nav className="tabbar" aria-label={s.main}>
      <NavLink to="/" end><House size={21} />{s.home}</NavLink>
      <NavLink to="/lancamentos"><List size={21} />{s.entries}</NavLink>
      <button className="tab-add" onClick={() => open({ kind: 'expense' })} aria-label={s.newEntry}><Plus size={28} strokeWidth={2.5} /></button>
      <NavLink
        to={firstCard ? `/cartoes/${firstCard.id}` : '/configuracoes/contas#cartoes'}
        className={() => (pathname.startsWith('/cartoes/') ? 'active' : '')}
      >
        <CreditCard size={21} />{s.invoicesTab}
      </NavLink>
      <NavLink to="/mais" className={() => (inMore ? 'active' : '')}><Ellipsis size={21} />{s.more}</NavLink>
    </nav>
  )
}
