import { CreditCard, Ellipsis, House, List, Plus } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useCards } from '../lib/queries'
import { useTxForm } from './TxFormContext'

/** The phone's bottom bar. It takes the sidebar's place below 760px (see styles.css). */
export function BottomTabs() {
  const { open } = useTxForm()
  const { data: cards = [] } = useCards()
  const { pathname } = useLocation()
  const firstCard = cards.find((c) => !c.archived)
  const inMore = pathname === '/mais' || pathname.startsWith('/configuracoes') || pathname === '/perfil'
  return (
    <nav className="tabbar" aria-label="Principal">
      <NavLink to="/" end><House size={21} />Início</NavLink>
      <NavLink to="/lancamentos"><List size={21} />Lançamentos</NavLink>
      <button className="tab-add" onClick={() => open({ kind: 'expense' })} aria-label="Novo lançamento"><Plus size={28} strokeWidth={2.5} /></button>
      <NavLink
        to={firstCard ? `/cartoes/${firstCard.id}` : '/configuracoes/contas#cartoes'}
        className={() => (pathname.startsWith('/cartoes/') ? 'active' : '')}
      >
        <CreditCard size={21} />Faturas
      </NavLink>
      <NavLink to="/mais" className={() => (inMore ? 'active' : '')}><Ellipsis size={21} />Mais</NavLink>
    </nav>
  )
}
